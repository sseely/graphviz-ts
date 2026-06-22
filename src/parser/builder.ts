// SPDX-License-Identifier: EPL-2.0

/**
 * Converts a parsed DOT AST into the Graph model.
 *
 * @see lib/cgraph/grammar.y
 */

import { Graph, type GraphKind } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
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

  processEdgeStmt(stmt: EdgeStmt, graph: Graph, root: Graph): void {
    for (let i = 0; i < stmt.nodes.length - 1; i++) {
      this.processEdgePair(
        stmt.nodes[i],
        stmt.nodes[i + 1],
        stmt.attrs,
        graph,
        root,
      );
    }
  }

  processSubgraph(
    stmt: SubgraphStmt,
    graph: Graph,
    root: Graph,
    directed: boolean,
  ): void {
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
    const sg = new Graph(sgName, graph.kind);
    sg.parent = graph;
    sg.root = root;
    buildGraph(stmt.stmts, sg, root, directed, this);
    graph.subgraphs.set(sgName, sg);
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
      case 'edge':     this.processEdgeStmt(stmt, graph, root); break;
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

  private resolveEndpoint(item: NodeId | SubgraphStmt, root: Graph, scope: Graph): Node[] {
    if ('type' in item && item.type === 'subgraph') {
      return NameCollector.fromStmts(item.stmts).map(
        (n) => this.registry.ensure(n, root, scope),
      );
    }
    return [this.registry.ensure((item as NodeId).id, root, scope)];
  }

  private processEdgePair(
    tailItem: NodeId | SubgraphStmt,
    headItem: NodeId | SubgraphStmt,
    attrs: AttrPair[],
    graph: Graph,
    root: Graph,
  ): void {
    // DOT-syntax ports land in tailport/headport attrs; explicit attrs win.
    const tailPort = portStringOf(tailItem);
    const headPort = portStringOf(headItem);
    for (const tail of this.resolveEndpoint(tailItem, root, graph)) {
      for (const head of this.resolveEndpoint(headItem, root, graph)) {
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
