// SPDX-License-Identifier: EPL-2.0

/**
 * Rank geometry extraction for edge routing.
 *
 * Computes the RankEdgeInfo needed by routeWithRank by reading the
 * graph's rank table and deriving left/right bounds from node extents.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (rank geometry access)
 * @see lib/dotgen/dotsplines.c:sd.LeftBound / sd.RightBound
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { RankEdgeInfo } from './edge-route-routing.js';

/** Minimum edge routing width. @see lib/dotgen/dotsplines.c:MINW */
const MINW = 16;

/** Minimum x extent across all nodes minus MINW. @see lib/dotgen/dotsplines.c:sd.LeftBound */
export function computeLeftBound(g: Graph): number {
  const ranks = g.info.rank;
  if (ranks === undefined) return -32;
  const minr = g.info.minrank ?? 0;
  const maxr = g.info.maxrank ?? ranks.length - 1;
  let lb = 0;
  for (let i = minr; i <= maxr; i++) {
    const n = ranks[i]?.v[0];
    if (n) lb = Math.min(lb, n.info.coord.x - n.info.lw);
    lb -= MINW;
  }
  return lb;
}

/** Maximum x extent across all nodes plus MINW. @see lib/dotgen/dotsplines.c:sd.RightBound */
export function computeRightBound(g: Graph): number {
  const ranks = g.info.rank;
  if (ranks === undefined) return 60;
  const minr = g.info.minrank ?? 0;
  const maxr = g.info.maxrank ?? ranks.length - 1;
  let rb = 0;
  for (let i = minr; i <= maxr; i++) {
    const rk = ranks[i];
    const n = rk !== undefined && rk.n > 0 ? rk.v[rk.n - 1] : undefined;
    if (n) rb = Math.max(rb, n.info.coord.x + n.info.rw);
    rb += MINW;
  }
  return rb;
}

/** Default a rank half-height to node half-height when the rank value is unset. */
export function rankHt(rankVal: number, nodeHt: number): number {
  return rankVal > 0 ? rankVal : nodeHt / 2;
}

/**
 * Extract RankEdgeInfo from the graph's rank table for an edge.
 * Returns undefined if rank geometry is not available.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (rank geometry access)
 */
export function rankEdgeInfoOf(
  g: Graph,
  tailNode: Node,
  headNode: Node,
): RankEdgeInfo | undefined {
  const rankTable = g.info.rank;
  if (rankTable === undefined) return undefined;
  const tailRank = tailNode.info.rank;
  const headRank = headNode.info.rank;
  if (tailRank === undefined || headRank === undefined) return undefined;
  const tr = rankTable[tailRank];
  const hr = rankTable[headRank];
  if (tr === undefined || hr === undefined) return undefined;
  return {
    leftBound:  computeLeftBound(g),
    rightBound: computeRightBound(g),
    tailHt1: rankHt(tr.ht1, tailNode.info.ht),
    tailHt2: rankHt(tr.ht2, tailNode.info.ht),
    headHt1: rankHt(hr.ht1, headNode.info.ht),
    headHt2: rankHt(hr.ht2, headNode.info.ht),
  };
}
