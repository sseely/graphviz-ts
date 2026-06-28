// SPDX-License-Identifier: EPL-2.0

/**
 * Converts a parsed DOT AST into the Graph model.
 *
 * @see lib/cgraph/grammar.y
 */

import { Graph, type GraphKind } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import { assignSubgSeq } from '../model/cgraph-ops.js';
import type {
  AttrPair,
  NodeId,
  NodeStmt,
  EdgeStmt,
  AttrStmt,
  AssignStmt,
  SubgraphStmt,
  ParsedStmt,
  ParsedGraph,
} from './ast.js';

// ── Attribute helpers ─────────────────────────────────────────────────────────

/**
 * Normalise an attribute value. HTML strings arrive from the grammar
 * already prefixed with the HTML marker (cgraph's aghtmlstr flag).
 */
export function normaliseAttrValue(value: string): string {
  return value;
}

export function applyAttrs(
  pairs: AttrPair[],
  target: Map<string, string>,
): void {
  for (const { key, value } of pairs) {
    target.set(key, normaliseAttrValue(value));
  }
}

/**
 * The port string a NodeId endpoint contributes to the edge's
 * tailport/headport attr: "port" or "port:compass". Subgraph endpoints and
 * port-less nodes contribute nothing. Mirrors C's mkport writing the
 * tailport/headport attr from `A:port:compass` DOT syntax.
 * @see lib/cgraph/grammar.y:396 (mkport)
 */
function portStringOf(item: NodeId | SubgraphStmt): string {
  if ('type' in item && item.type === 'subgraph') return '';
  const ni = item as NodeId;
  if (ni.port === null || ni.port === '') return '';
  return ni.compass ? ni.port + ':' + ni.compass : ni.port;
}

// ── Node registry ─────────────────────────────────────────────────────────────

/**
 * Collect the node-attribute defaults in effect at `scope`: walk scope -> root,
 * inner overriding outer (first-found wins). Returns a fresh map so later
 * node[...] statements that mutate a graph's nodeDefaults do not change an
 * already-created node's snapshot.
 */
function effectiveNodeDefaults(scope: Graph): Map<string, string> {
  const eff = new Map<string, string>();
  for (let g: Graph | null = scope; g !== null; g = g.parent) {
    for (const [k, v] of g.nodeDefaults) {
      if (!eff.has(k)) eff.set(k, v);
    }
  }
  return eff;
}

/** Graph-attr keys do_graph_label inherits; seeded into subgraph attrs so the
 *  inherited value survives the layout's cluster rebuilds. */
const GRAPH_LABEL_INHERIT_KEYS = ['label', 'fontname', 'fontsize', 'fontcolor'] as const;

/**
 * Collect the graph-attribute defaults in effect at `scope`: walk scope -> root,
 * inner overriding outer (first-found wins), reading each graph's own `attrs`.
 * Snapshotted when a subgraph opens so an ancestor attribute set LATER in
 * statement order does not retroactively apply (DOT's order-sensitive defaults).
 */
function effectiveGraphDefaults(scope: Graph): Map<string, string> {
  const eff = new Map<string, string>();
  for (let g: Graph | null = scope; g !== null; g = g.parent) {
    for (const [k, v] of g.attrs) {
      if (!eff.has(k)) eff.set(k, v);
    }
  }
  return eff;
}

/** Manages the per-parse node ID counter and node creation. */
export class NodeRegistry {
  private nextId = 0;

  reset(): void {
    this.nextId = 0;
  }

  ensure(name: string, root: Graph, scope: Graph = root): Node {
    const existing = root.nodes.get(name);
    if (existing !== undefined) return existing;
    const node = new Node(this.nextId++, name, root);
    // Snapshot the node-attribute defaults active in this scope at creation, in
    // statement order — a node[...] declared later does not apply to this node.
    // @see nodeAttr (poly-init), snapshotEdgeDefaults (edges do the same).
    node.nodeDefaultsSnapshot = effectiveNodeDefaults(scope);
    root.nodes.set(name, node);
    return node;
  }
}

// ── Endpoint / name collection ────────────────────────────────────────────────

/** Collects node names from AST statement lists (for edge endpoint expansion). */
export class NameCollector {
  static fromStmts(stmts: ParsedStmt[]): string[] {
    const out: string[] = [];
    for (const s of stmts) NameCollector.fromStmt(s, out);
    return out;
  }

  static fromStmt(stmt: ParsedStmt, out: string[]): void {
    if (stmt.type === 'node') {
      out.push(stmt.id.id);
    } else if (stmt.type === 'edge') {
      for (const item of stmt.nodes) NameCollector.fromEndpoint(item, out);
    } else if (stmt.type === 'subgraph') {
      out.push(...NameCollector.fromStmts(stmt.stmts));
    }
  }

  static fromEndpoint(item: NodeId | SubgraphStmt, out: string[]): void {
    if ('type' in item && item.type === 'subgraph') {
      out.push(...NameCollector.fromStmts(item.stmts));
    } else {
      out.push((item as NodeId).id);
    }
  }
}

// ── Statement processors ──────────────────────────────────────────────────────

/** Processes individual parsed statements into graph model objects. */
export class StmtProcessor {
  /**
   * cgraph's anonymous-object id counter, shared across the whole parse. Every
   * anonymous object — the unnamed root graph, each anonymous subgraph, and each
   * keyless edge — consumes `id = 2*counter+1` in creation order and advances
   * the counter; named objects (named graphs/subgraphs/nodes, keyed edges) get
   * pointer-based even ids and do NOT advance it. The id is only materialized as
   * a `%N` name for subgraphs (the sole anon objects that surface a `<title>` in
   * SVG); edges and the root advance the counter silently so siblings get
   * cgraph's exact numbering (e.g. 2475_2: %3, %9, %17 … as keyless edges fall
   * between the cluster subgraphs).
   * @see lib/cgraph/id.c:idmap (anon branch `*id = st->counter*2+1; ++counter`)
   * @see lib/cgraph/id.c:agnameof (`'%' + id`)
   */
  private anonCounter = 0;

  constructor(private readonly registry: NodeRegistry) {}

  /** Consume one anonymous id, returning cgraph's `2*counter+1`. */
  private nextAnonId(): number {
    return this.anonCounter++ * 2 + 1;
  }

  /**
   * Advance the shared anon-id counter without materializing a name — the
   * unnamed root graph and each keyless edge consume an id slot so later
   * anonymous subgraphs land on cgraph's exact `%N`.
   * @see lib/cgraph/id.c:idmap
   */
  advanceAnonId(): void {
    this.anonCounter++;
  }

  processAssign(stmt: AssignStmt, graph: Graph): void {
    graph.attrs.set(stmt.key, normaliseAttrValue(stmt.value));
  }

  processAttr(stmt: AttrStmt, graph: Graph): void {
    if (stmt.target === 'graph') {
      applyAttrs(stmt.attrs, graph.attrs);
    } else if (stmt.target === 'node') {
      applyAttrs(stmt.attrs, graph.nodeDefaults);
    } else {
      applyAttrs(stmt.attrs, graph.edgeDefaults);
    }
  }

  processNodeStmt(stmt: NodeStmt, graph: Graph, root: Graph): void {
    const node = this.registry.ensure(stmt.id.id, root, graph);
    applyAttrs(stmt.attrs, node.attrs);
    // cgraph: a node in a subgraph is a member of every enclosing graph.
    // @see lib/cgraph/node.c:agnode
    for (let g: Graph | null = graph; g !== null && g !== root; g = g.parent) {
      g.nodes.set(node.name, node);
    }
  }

  processEdgeStmt(stmt: EdgeStmt, graph: Graph, root: Graph, directed: boolean): void {
    // Resolve every endpoint ONCE before pairing. A subgraph endpoint is created
    // as a real subgraph here (consuming its anon-id/AGSEQ); an interior one
    // (A -> {S} -> B) appears in two adjacent pairs, so resolving once avoids
    // double-creating it. Endpoints (incl. subgraphs) open before any edge of the
    // statement is built — matching cgraph's grammar. @see lib/cgraph/grammar.y
    const ends = stmt.nodes.map((item) => ({
      nodes: this.resolveEndpoint(item, root, graph, directed),
      port: portStringOf(item),
    }));
    for (let i = 0; i < ends.length - 1; i++) {
      this.connectEndpoints(ends[i], ends[i + 1], stmt.attrs, graph, root);
    }
  }

  processSubgraph(
    stmt: SubgraphStmt,
    graph: Graph,
    root: Graph,
    directed: boolean,
  ): Graph {
    // cgraph names anonymous subgraphs `%N` so siblings stay distinct; an empty
    // name would collide in graph.subgraphs (a Map), silently dropping all but
    // the last — e.g. `subgraph {…} subgraph {…}` losing the first and any
    // cluster nested in it (nestedclust: cluster_ss81). The `%` prefix is not a
    // valid DOT identifier start, so it cannot clash with a user name. The id is
    // cgraph's shared anonymous counter (2*counter+1), allocated when the
    // subgraph opens (before its body), so keyless edges parsed earlier in the
    // enclosing scope have already advanced it — matching native's %N exactly.
    // @see lib/cgraph/graph.c:agsubg, lib/cgraph/id.c:idmap
    const sgName = stmt.id ?? `%${this.nextAnonId()}`;
    // AGSEQ is assigned when the subgraph opens, before its body — matching C's
    // agopen, which calls agnextseq before processing the subgraph contents.
    // A reopened named subgraph (`subgraph X {…} … subgraph X {…}`) consumes no
    // new AGSEQ in cgraph, so reuse the prior seq rather than re-incrementing.
    // (Content still overwrites; merge semantics are unchanged and out of scope.)
    const prior = graph.subgraphs.get(sgName);
    const sg = new Graph(sgName, graph.kind);
    sg.parent = graph;
    sg.root = root;
    if (prior !== undefined) sg.seq = prior.seq;
    else assignSubgSeq(graph, sg);
    // Snapshot the enclosing graph-attribute defaults at OPEN time (before the
    // body) so a later ancestor `graph [label=…]` does not apply to this
    // subgraph — matching cgraph's parse-time defval copy (order-sensitive).
    sg.graphDefaultsSnapshot = effectiveGraphDefaults(graph);
    buildGraph(stmt.stmts, sg, root, directed, this);
    // Seed the order-correct inherited label-family defaults into the subgraph's
    // OWN attrs (body wins) so they survive the layout's cluster rebuilds, which
    // copy attrs but not the snapshot. Mirrors cgraph's agsubg defval copy; kept
    // to the keys do_graph_label reads so the blast radius stays in label render.
    // @see lib/common/input.c:do_graph_label (agget label/font*)
    for (const key of GRAPH_LABEL_INHERIT_KEYS) {
      const v = sg.graphDefaultsSnapshot.get(key);
      if (v !== undefined && !sg.attrs.has(key)) sg.attrs.set(key, v);
    }
    graph.subgraphs.set(sgName, sg);
    return sg;
  }

  dispatch(
    stmt: ParsedStmt,
    graph: Graph,
    root: Graph,
    directed: boolean,
  ): void {
    switch (stmt.type) {
      case 'assign':   this.processAssign(stmt, graph); break;
      case 'attr':     this.processAttr(stmt, graph); break;
      case 'node':     this.processNodeStmt(stmt, graph, root); break;
      case 'edge':     this.processEdgeStmt(stmt, graph, root, directed); break;
      case 'subgraph': this.processSubgraph(stmt, graph, root, directed); break;
    }
  }

  /**
   * Snapshot the edge-attribute defaults active in `scope` at edge creation:
   * walk scope -> root (inner overriding outer), filling only keys the edge
   * does not set explicitly. Edges read attrs from their own map only, and
   * DOT's edge[...] defaults apply to edges created after the statement in that
   * scope, so the snapshot must happen at creation, in statement order.
   */
  private snapshotEdgeDefaults(edge: Edge, scope: Graph): void {
    for (let g: Graph | null = scope; g !== null; g = g.parent) {
      for (const [k, v] of g.edgeDefaults) {
        if (!edge.attrs.has(k)) edge.attrs.set(k, v);
      }
    }
  }

  private resolveEndpoint(
    item: NodeId | SubgraphStmt,
    root: Graph,
    scope: Graph,
    directed: boolean,
  ): Node[] {
    if ('type' in item && item.type === 'subgraph') {
      // Create the subgraph as a first-class object so its rank-set attr
      // (rank=same/min/max/source/sink), node membership, and anon-id/AGSEQ are
      // registered for collapse_sets; then expand the edge over its node names.
      this.processSubgraph(item, scope, root, directed);
      // Ensure (create/look-up) the member nodes in written order, so NEW nodes
      // take their AGSEQ in source order — then iterate them in AGSEQ (node id)
      // order for edge creation. C builds `tail -> {set}` edges by walking the
      // endpoint subgraph's node dictionary (sequence-ordered), not the written
      // order; iterating out of order assigns the wrong graphSeq (SVG edge id)
      // when the set lists pre-existing nodes out of creation order (graphs-world
      // `37 -> {39;41;38;40}`: heads 38,40,39,41 by AGSEQ, not 39,41,38,40).
      // @see lib/cgraph/edge.c:agedge — edges follow agfstnode/agnxtnode order
      const nodes = NameCollector.fromStmts(item.stmts).map(
        (n) => this.registry.ensure(n, root, scope),
      );
      return nodes.sort((a, b) => a.id - b.id);
    }
    return [this.registry.ensure((item as NodeId).id, root, scope)];
  }

  private connectEndpoints(
    tailEnd: { nodes: Node[]; port: string },
    headEnd: { nodes: Node[]; port: string },
    attrs: AttrPair[],
    graph: Graph,
    root: Graph,
  ): void {
    // DOT-syntax ports land in tailport/headport attrs; explicit attrs win.
    const tailPort = tailEnd.port;
    const headPort = headEnd.port;
    for (const tail of tailEnd.nodes) {
      for (const head of headEnd.nodes) {
        const edge = new Edge(tail, head, '');
        this.advanceAnonId(); // keyless edge = anonymous cgraph id (see method)
        applyAttrs(attrs, edge.attrs);
        this.snapshotEdgeDefaults(edge, graph);
        if (tailPort && !edge.attrs.has('tailport')) edge.attrs.set('tailport', tailPort);
        if (headPort && !edge.attrs.has('headport')) edge.attrs.set('headport', headPort);
        root.edges.push(edge);
        edge.graphSeq = root.edges.length;
        // cgraph: nodes and edges belong to every enclosing graph.
        // @see lib/cgraph/edge.c:agedge
        for (let g: Graph | null = graph; g !== null && g !== root; g = g.parent) {
          g.nodes.set(tail.name, tail);
          g.nodes.set(head.name, head);
          g.edges.push(edge);
        }
      }
    }
  }
}

// ── Graph builder ─────────────────────────────────────────────────────────────

/** Walk a statement list and populate graph / root using the given processor. */
export function buildGraph(
  stmts: ParsedStmt[],
  graph: Graph,
  root: Graph,
  directed: boolean,
  processor: StmtProcessor,
): void {
  for (const stmt of stmts) {
    processor.dispatch(stmt, graph, root, directed);
  }
}

/** Build a Graph model from a fully-parsed AST. */
export function buildFromAst(ast: ParsedGraph): Graph {
  const registry = new NodeRegistry();
  const processor = new StmtProcessor(registry);
  let kind: GraphKind;
  if (ast.directed && ast.strict) kind = 'strict-directed';
  else if (ast.directed) kind = 'directed';
  else if (ast.strict) kind = 'strict-undirected';
  else kind = 'undirected';
  const graph = new Graph(ast.id ?? '', kind);
  // An unnamed root graph is itself anonymous in cgraph (agopen with no name),
  // consuming anon id 1 before any statement — so the first anonymous subgraph is
  // %3, not %1 (a named root leaves the counter at 0 → first subgraph %1).
  // @see lib/cgraph/graph.c:agopen, lib/cgraph/id.c:idmap
  if (!ast.id) processor.advanceAnonId();
  buildGraph(ast.stmts, graph, graph, ast.directed, processor);
  return graph;
}
