// SPDX-License-Identifier: EPL-2.0

/**
 * Connected-component finder for fdp layout.
 *
 * DFS-based component discovery that merges all components containing a
 * pinned node into component 0. Port nodes are treated equivalently to
 * pinned nodes for component merging purposes.
 *
 * @see lib/fdpgen/comp.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';

// ---------------------------------------------------------------------------
// DFS helper
// ---------------------------------------------------------------------------

/**
 * Depth-first traversal from node n, adding all reachable nodes to comp.
 * Marks visited nodes via the marks Set.
 *
 * @see lib/fdpgen/comp.c:dfs
 */
export function dfs(
  g: Graph,
  n: Node,
  comp: Node[],
  marks: Set<Node>,
): void {
  marks.add(n);
  comp.push(n);
  for (const e of g.edges) {
    const other = e.tail === n ? e.head : (e.head === n ? e.tail : null);
    if (other === null) continue;
    if (!marks.has(other)) dfs(g, other, comp, marks);
  }
}

// ---------------------------------------------------------------------------
// Component builder — single-pass extraction
// ---------------------------------------------------------------------------

/**
 * Collects the component containing startNode and any further unvisited
 * nodes reachable from it. Mutates marks and appends to comps.
 *
 * @see lib/fdpgen/comp.c:findCComp (inner loop body)
 */
export function collectComp(
  g: Graph,
  startNode: Node,
  marks: Set<Node>,
  comps: Node[][],
  targetIdx: number,
): void {
  if (!comps[targetIdx]) comps[targetIdx] = [];
  dfs(g, startNode, comps[targetIdx], marks);
}

// ---------------------------------------------------------------------------
// findCComp — public API
// ---------------------------------------------------------------------------

/**
 * Finds generalized connected components of graph g.
 *
 * All components containing a pinned node (info.pinned === true) are merged
 * into component 0. The returned fixed[i] is true when component i must not
 * be moved during packing (i.e. it contains pinned nodes).
 *
 * Assumes nodes have unique integer ids (node.id) in range [0, n-1].
 *
 * @returns comps  - Array of components; each component is a Node[].
 * @returns fixed  - fixed[i] true when component i is anchored.
 *
 * @see lib/fdpgen/comp.c:findCComp
 */
export function findCComp(g: Graph): {
  comps: Node[][];
  fixed: boolean[];
} {
  const marks = new Set<Node>();
  const comps: Node[][] = [];
  let hasPinned = false;

  // Pass 1: DFS from all pinned nodes into component 0.
  for (const n of g.nodes.values()) {
    if (!n.info.pinned) continue;
    if (marks.has(n)) continue;
    hasPinned = true;
    collectComp(g, n, marks, comps, 0);
  }

  // Pass 2: remaining unvisited nodes each start a new component.
  for (const n of g.nodes.values()) {
    if (marks.has(n)) continue;
    comps.push([]);
    dfs(g, n, comps[comps.length - 1], marks);
  }

  // Build fixed array: component 0 is fixed when it was seeded by pinned nodes.
  const fixed: boolean[] = comps.map((_, idx) => idx === 0 && hasPinned);

  return { comps, fixed };
}
