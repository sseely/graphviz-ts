// SPDX-License-Identifier: EPL-2.0

/**
 * Safe edge-creation helper — the `agedge` equivalent for programmatic graph
 * construction. Mirrors the parser's dual-list insertion and adds the
 * strict-graph deduplication mandated by cgraph.
 *
 * @see lib/cgraph/edge.c:agedge
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';

/** @see lib/cgraph/cgraph.h:agisundirected */
function isUndirected(g: Graph): boolean {
  const k = g.root.kind;
  return k === 'undirected' || k === 'strict-undirected';
}

/** @see lib/cgraph/cgraph.h:agisstrict */
function isStrict(g: Graph): boolean {
  const k = g.root.kind;
  return k === 'strict-directed' || k === 'strict-undirected';
}

/**
 * Probe root.edges for an existing (tail,head) pair.
 * For undirected graphs, (h,t) matches (t,h) — mirrors the C wildcard
 * key probe in ok_to_make_edge / agedge pre-creation check.
 * @see lib/cgraph/edge.c:ok_to_make_edge
 */
function findExistingEdge(
  root: Graph,
  tail: Node,
  head: Node,
  undirected: boolean,
): Edge | null {
  for (const e of root.edges) {
    if (e.tail === tail && e.head === head) return e;
    if (undirected && e.tail === head && e.head === tail) return e;
  }
  return null;
}

/**
 * Insert edge into root.edges and walk the subgraph chain toward root,
 * adding the edge (and its endpoint nodes) to every enclosing graph.
 * Mirrors processEdgePair's enclosing-graph loop and installedge.
 * @see lib/cgraph/edge.c:installedge
 * @see src/parser/builder.ts:238-246
 */
function insertEdge(g: Graph, root: Graph, edge: Edge): void {
  root.edges.push(edge);
  edge.graphSeq = root.edges.length;
  for (let cur: Graph | null = g; cur !== null && cur !== root; cur = cur.parent) {
    cur.nodes.set(edge.tail.name, edge.tail);
    cur.nodes.set(edge.head.name, edge.head);
    cur.edges.push(edge);
  }
}

/**
 * Create and insert an edge from `tail` to `head` in graph `g`.
 *
 * In a strict graph, at most one edge between any (tail, head) pair exists
 * (symmetric for undirected). When a match is found the existing edge is
 * returned without modification. This matches C `agedge` with `cflag=1`.
 *
 * @param g    - Owning graph or subgraph; root derived via `g.root`.
 * @param tail - Source node (AGTAIL). @see lib/cgraph/cgraph.h:AGTAIL
 * @param head - Destination node (AGHEAD). @see lib/cgraph/cgraph.h:AGHEAD
 * @param name - Edge key; defaults to empty string for anonymous edges.
 *               Ignored for strict-graph dedup (wildcard match).
 * @returns The new (or existing, for strict graphs) edge.
 * @see lib/cgraph/edge.c:agedge
 */
export function addEdge(
  g: Graph,
  tail: Node,
  head: Node,
  name?: string,
): Edge {
  const root = g.root;
  const undirected = isUndirected(g);

  if (isStrict(g)) {
    const existing = findExistingEdge(root, tail, head, undirected);
    if (existing !== null) return existing;
  }

  const edge = new Edge(tail, head, name ?? '');
  insertEdge(g, root, edge);
  return edge;
}
