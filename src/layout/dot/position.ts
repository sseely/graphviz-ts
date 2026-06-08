// SPDX-License-Identifier: EPL-2.0

/**
 * Dot position phase entry point: x-coordinate assignment, graph connectivity,
 * leaf expansion stubs, and the main dot_position function.
 * @see lib/dotgen/position.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { virtualNode, NORMAL } from './fastgr.js';
import { SLACKNODE, LEAFSET } from './rank.js';
import { rank } from './ns.js';
import { markLowclusters } from './cluster.js';
import {
  makeAuxEdge, createAuxEdges, removeAuxEdges,
  graphMinrank, graphMaxrank, nodeRank, nodeUfSize,
} from './position-aux.js';
import { posClusters, compressGraph } from './position-cluster.js';
import { setYcoords } from './position-ycoords.js';
import { setAspect } from './position-bbox.js';
import { dotConcentrate } from './conc.js';

// ---------------------------------------------------------------------------
// set_xcoords — AD-8 critical: ND_rank holds x-coord; restore to rank index
// ---------------------------------------------------------------------------

/**
 * Reads ND_rank (set to x-coordinate by network simplex), writes to
 * ND_coord.x, then RESTORES ND_rank = i (actual rank index).
 *
 * AD-8: This is the critical dual-use restoration point.
 * After this function, ND_rank is valid again as a rank index.
 *
 * @see lib/dotgen/position.c:set_xcoords
 */
/** @see lib/dotgen/position.c:set_xcoords (rank→coord copy + rank restore) */
export function setXcoordsFromRank(g: Graph): void {
  const rankArr = g.info.rank!;
  for (let i = graphMinrank(g); i <= graphMaxrank(g); i++) {
    const rk = rankArr[i];
    for (let j = 0; j < rk.n; j++) {
      const v = rk.v[j];
      v.info.coord.x = nodeRank(v);
      v.info.rank = i;
    }
  }
}

/** Minimum left-edge x over all NORMAL nodes; INT_MAX if none. */
export function minNormalLeftX(g: Graph): number {
  const rankArr = g.info.rank!;
  let minX = Number.MAX_SAFE_INTEGER;
  for (let i = graphMinrank(g); i <= graphMaxrank(g); i++) {
    const rk = rankArr[i];
    for (let j = 0; j < rk.n; j++) {
      const v = rk.v[j];
      if ((v.info.node_type ?? 0) !== NORMAL) continue;
      const lx = v.info.coord.x - (v.info.lw ?? 0);
      if (lx < minX) minX = lx;
    }
  }
  return minX;
}

/** Subtract delta from every node's coord.x across all ranks. */
export function shiftAllXcoords(g: Graph, delta: number): void {
  const rankArr = g.info.rank!;
  for (let i = graphMinrank(g); i <= graphMaxrank(g); i++) {
    const rk = rankArr[i];
    for (let j = 0; j < rk.n; j++) rk.v[j].info.coord.x -= delta;
  }
}

/**
 * Shift all node x-coords so the leftmost NORMAL node's left edge is at x=0.
 * Matches C: left boundary virtual node (GD_ln) ends at rank=0 after NS,
 * so the leftmost real node sits at x=lw (left edge=0).
 */
export function normalizeXcoords(g: Graph): void {
  const minX = minNormalLeftX(g);
  if (minX !== Number.MAX_SAFE_INTEGER && minX !== 0) shiftAllXcoords(g, minX);
}

/** @see lib/dotgen/position.c:set_xcoords */
export function setXcoords(g: Graph): void {
  setXcoordsFromRank(g);
  g.info.rankIsXCoord = false;
}

// ---------------------------------------------------------------------------
// connectGraph — @see lib/dotgen/position.c:connectGraph
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:connectGraph (check edge list for cross-rank edge) */
export function edgeListCrossesRank(
  el: { list: Edge[]; size: number } | undefined,
  r: number,
): boolean {
  if (!el) return false;
  for (let j = 0; j < el.size; j++) {
    const e = el.list[j];
    if ((e.head.info.rank ?? 0) > r || (e.tail.info.rank ?? 0) > r) return true;
  }
  return false;
}

/** @see lib/dotgen/position.c:connectGraph (find node with cross-rank edge in rank) */
export function rankHasCrossEdge(rk: { v: Node[]; n: number }, r: number): boolean {
  for (let i = 0; i < rk.n; i++) {
    const tp = rk.v[i];
    if (edgeListCrossesRank(tp.info.save_out, r)) return true;
    if (edgeListCrossesRank(tp.info.save_in, r)) return true;
  }
  return false;
}

/** @see lib/dotgen/position.c:connectGraph */
export function connectGraph(g: Graph): void {
  const rankArr = g.info.rank!;
  for (let r = graphMinrank(g); r <= graphMaxrank(g); r++) {
    const rp = rankArr[r];
    if (rp.n === 0 || rankHasCrossEdge(rp, r)) continue;
    const anchor = rp.v[0];
    const neighbor = r < graphMaxrank(g) ? rankArr[r + 1].v[0] : rankArr[r - 1].v[0];
    if (!neighbor) continue;
    const sn = virtualNode(g);
    sn.info.node_type = SLACKNODE;
    makeAuxEdge(sn, anchor, 0, 0);
    makeAuxEdge(sn, neighbor, 0, 0);
    sn.info.rank = Math.min(nodeRank(anchor), nodeRank(neighbor));
  }
}

// ---------------------------------------------------------------------------
// nsiter2 — @see lib/dotgen/position.c:nsiter2
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:nsiter2 — nslimit attribute not yet ported */
export function nsiter2(_g: Graph): number { return 2147483647; }

// ---------------------------------------------------------------------------
// make_leafslots / expand_leaves — @see lib/dotgen/position.c
// ---------------------------------------------------------------------------

/** @internal — expand rank slot array for leaf nodes */
export function expandRankSlots(rk: { v: Node[]; n: number }, newN: number): void {
  const newV: Node[] = new Array(newN + 1);
  for (let i = rk.n - 1; i >= 0; i--) {
    const v = rk.v[i];
    newV[v.info.order!] = v;
  }
  rk.n = newN;
  rk.v = newV;
}

/** @see lib/dotgen/position.c:make_leafslots */
export function makeLeafslots(g: Graph): void {
  const rankArr = g.info.rank!;
  for (let r = graphMinrank(g); r <= graphMaxrank(g); r++) {
    const rk = rankArr[r];
    let j = 0;
    for (let i = 0; i < rk.n; i++) {
      const v = rk.v[i];
      v.info.order = j;
      j += (v.info.ranktype === LEAFSET) ? nodeUfSize(v) : 1;
    }
    if (j > rk.n) expandRankSlots(rk, j);
  }
}

/** @see lib/dotgen/position.c:expand_leaves — stub (T36) */
export function expandLeaves(_g: Graph): void {
  /* TODO T36: port expand_leaves / flat edge leaf slot adjustment */
}

// ---------------------------------------------------------------------------
// flat_edges (stub, T36)
// ---------------------------------------------------------------------------

/** @see lib/dotgen/flat.c:flat_edges — stub (T36) */
export function flatEdges(_g: Graph): boolean { return false; }


// ---------------------------------------------------------------------------
// dot_position — @see lib/dotgen/position.c:dot_position
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:dot_position */
export function dotPosition(g: Graph): number {
  if (g.info.nlist === undefined) return 0;
  markLowclusters(g);
  setYcoords(g);
  if (g.info.drawing?.concentrate) {
    const rc = dotConcentrate(g);
    if (rc !== 0) return rc;
  }
  expandLeaves(g);
  if (flatEdges(g)) setYcoords(g);
  createAuxEdges(g, posClusters, compressGraph);
  g.info.rankIsXCoord = true;
  if (rank(g, 2, nsiter2(g))) {
    connectGraph(g);
    rank(g, 2, nsiter2(g));
  }
  setXcoords(g);
  normalizeXcoords(g);
  setAspect(g);
  /* remove_aux_edges must come after set_aspect: GD_ln/GD_rn used for bbox width */
  removeAuxEdges(g);
  return 0;
}
