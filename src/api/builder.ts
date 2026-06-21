// SPDX-License-Identifier: EPL-2.0

/**
 * Programmatic graph builder — constructs a Graph model without emitting DOT.
 *
 * Exposes lightweight typed handles (GvNode, GvEdge) that wrap internal
 * model references without leaking the mutable model classes (ADR-1, ADR-6,
 * ADR-8).
 *
 * @see lib/cgraph/graph.c:agopen
 * @see lib/cgraph/node.c:agnode
 * @see lib/cgraph/subg.c:agsubg
 */

import { Graph, type GraphKind } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import { agnode, agsubg, agsubnode } from '../model/cgraph-ops.js';
import { addEdge as cgraphAddEdge } from './edge-ops.js';

// ── Public interfaces ──────────────────────────────────────────────────────────

/** Options for createGraph. */
export interface CreateGraphOptions {
  directed?: boolean;
  strict?: boolean;
  name?: string;
}

/**
 * Opaque handle for a graph node.
 * @see lib/cgraph/cgraph.h:Agnode_s
 */
export interface GvNode {
  readonly name: string;
  setAttr(k: string, v: string): void;
  getAttr(k: string): string | undefined;
}

/**
 * Opaque handle for a graph edge.
 * @see lib/cgraph/cgraph.h:Agedge_s
 */
export interface GvEdge {
  readonly tail: string;
  readonly head: string;
  setAttr(k: string, v: string): void;
  getAttr(k: string): string | undefined;
}

/**
 * Builder returned by createGraph. Provides idiomatic programmatic
 * construction of a graph model.
 */
export interface GvGraphBuilder {
  addNode(name: string, attrs?: Record<string, string>): GvNode;
  addEdge(
    tail: GvNode | string,
    head: GvNode | string,
    attrs?: Record<string, string>,
  ): GvEdge;
  addSubgraph(name: string, attrs?: Record<string, string>): GvGraphBuilder;
  setAttr(k: string, v: string): void;
  getAttr(k: string): string | undefined;
  readonly graph: Graph;
}

// ── Internal handle implementations ──────────────────────────────────────────

/** Internal node handle — wraps Node ref without leaking the class. */
class NodeHandle implements GvNode {
  /** @internal */ readonly _node: Node;

  constructor(node: Node) {
    this._node = node;
  }

  get name(): string {
    return this._node.name;
  }

  setAttr(k: string, v: string): void {
    this._node.attrs.set(k, v);
  }

  getAttr(k: string): string | undefined {
    return this._node.attrs.get(k);
  }
}

/** Internal edge handle — wraps Edge ref without leaking the class. */
class EdgeHandle implements GvEdge {
  /** @internal */ readonly _edge: Edge;

  constructor(edge: Edge) {
    this._edge = edge;
  }

  get tail(): string {
    return this._edge.tail.name;
  }

  get head(): string {
    return this._edge.head.name;
  }

  setAttr(k: string, v: string): void {
    this._edge.attrs.set(k, v);
  }

  getAttr(k: string): string | undefined {
    return this._edge.attrs.get(k);
  }
}

// ── Builder implementation ─────────────────────────────────────────────────────

/** Resolve a GvNode handle or a name string to an internal Node. */
function resolveNode(g: Graph, ref: GvNode | string): Node {
  if (typeof ref === 'string') {
    const node = agnode(g, ref, true);
    if (node === null) {
      throw new Error(`Failed to resolve node '${ref}' in graph '${g.name}'`);
    }
    return node;
  }
  return (ref as NodeHandle)._node;
}

/** Apply an attrs Record to a Map. */
function applyAttrs(
  map: Map<string, string>,
  attrs: Record<string, string> | undefined,
): void {
  if (attrs === undefined) return;
  for (const [k, v] of Object.entries(attrs)) {
    map.set(k, v);
  }
}

/**
 * Builder backed by a Graph + optional subgraph context.
 * Root builder: _context === _graph (the root Graph).
 * Subgraph builder: _context is the subgraph; _graph is always the root.
 */
class GraphBuilder implements GvGraphBuilder {
  private readonly _graph: Graph;
  private readonly _context: Graph;

  constructor(graph: Graph, context: Graph) {
    this._graph = graph;
    this._context = context;
  }

  get graph(): Graph {
    return this._graph;
  }

  addNode(name: string, attrs?: Record<string, string>): GvNode {
    return addNodeToContext(this._graph, this._context, name, attrs);
  }

  addEdge(
    tail: GvNode | string,
    head: GvNode | string,
    attrs?: Record<string, string>,
  ): GvEdge {
    const tailNode = resolveNode(this._graph, tail);
    const headNode = resolveNode(this._graph, head);
    const edge = cgraphAddEdge(this._graph, tailNode, headNode);
    applyAttrs(edge.attrs, attrs);
    return new EdgeHandle(edge);
  }

  addSubgraph(name: string, attrs?: Record<string, string>): GvGraphBuilder {
    const sg = agsubg(this._context, name, true);
    if (sg === null) {
      throw new Error(`Failed to create subgraph '${name}'`);
    }
    applyAttrs(sg.attrs, attrs);
    return new GraphBuilder(this._graph, sg);
  }

  setAttr(k: string, v: string): void {
    this._context.attrs.set(k, v);
  }

  getAttr(k: string): string | undefined {
    return this._context.attrs.get(k);
  }
}

/**
 * Create a node in root and, when context is a subgraph, install it there too.
 * Extracted to keep GraphBuilder.addNode below the CCN/length threshold.
 */
function addNodeToContext(
  root: Graph,
  context: Graph,
  name: string,
  attrs: Record<string, string> | undefined,
): GvNode {
  const node = agnode(root, name, true);
  if (node === null) throw new Error(`Failed to create node '${name}'`);
  applyAttrs(node.attrs, attrs);
  if (context !== root) agsubnode(context, node, true);
  return new NodeHandle(node);
}

// ── GraphKind mapping ──────────────────────────────────────────────────────────

/**
 * Lookup table: [directed][strict] → GraphKind.
 * Per parser/builder.ts:272-274 (the canonical mapping in this codebase).
 * @see lib/cgraph/graph.c:Agdirected / Agstrictdirected / Agundirected / Agstrictundirected
 */
const KIND_TABLE: Record<string, GraphKind> = {
  'true:true': 'strict-directed',
  'true:false': 'directed',
  'false:true': 'strict-undirected',
  'false:false': 'undirected',
};

/** Derive GraphKind from CreateGraphOptions. */
function resolveKind(opts: CreateGraphOptions | undefined): GraphKind {
  const d = String(opts?.directed ?? true);
  const s = String(opts?.strict ?? false);
  return KIND_TABLE[`${d}:${s}`] ?? 'directed';
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Create a new programmatic graph builder.
 *
 * The builder's `.graph` is a fresh Graph ready for handoff to layout/render.
 * Defaults: directed=true, strict=false, name=''.
 *
 * @see lib/cgraph/graph.c:agopen
 */
export function createGraph(opts?: CreateGraphOptions): GvGraphBuilder {
  const g = new Graph(opts?.name ?? '', resolveKind(opts));
  return new GraphBuilder(g, g);
}
