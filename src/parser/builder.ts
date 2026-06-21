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
    // Record the declaring subgraph so node-attribute defaults set in that
    // scope (and ancestors) resolve for this node. @see nodeAttr (poly-init).
    if (scope !== root) node.subg = scope;
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
  constructor(private readonly registry: NodeRegistry) {}

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
    const sgName = stmt.id ?? '';
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
    // @see lib/common/utils.c:common_init_edge (reads these via chkPort)
    const tailPort = portStringOf(tailItem);
    const headPort = portStringOf(headItem);
    for (const tail of this.resolveEndpoint(tailItem, root, graph)) {
      for (const head of this.resolveEndpoint(headItem, root, graph)) {
        const edge = new Edge(tail, head, '');
        applyAttrs(attrs, edge.attrs);
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
  buildGraph(ast.stmts, graph, graph, ast.directed, processor);
  return graph;
}
