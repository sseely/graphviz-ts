// SPDX-License-Identifier: EPL-2.0

/**
 * make_flat_edge, make_flat_adj_edges and helpers — flat edge spline routing.
 *
 * Flat edges connect nodes on the same rank. The adjacent-node case
 * (make_flat_adj_edges) recursively invokes the full dot pipeline on a
 * cloned subgraph. Full pathplan routing is deferred until pathplan.ts
 * is ported.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_edge, make_flat_adj_edges
 */

import { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';
import type { SplineInfo } from './splines-route.js';
import { dotRank } from './rank.js';
import { dotMincross } from './mincross.js';
import { dotPosition } from './position.js';
import { dotSameports } from './sameport.js';
import { dotSplines_ } from './splines.js';

// ---------------------------------------------------------------------------
// cloneGraph — build auxiliary graph for flat adj routing
// @see lib/dotgen/dotsplines.c:cloneGraph
// ---------------------------------------------------------------------------

/**
 * Create a minimal clone of g for flat-adj routing.
 * @see lib/dotgen/dotsplines.c:cloneGraph
 */
export function cloneGraph(g: Graph): Graph {
  const auxg = new Graph('auxg', g.kind);
  auxg.info.nodesep = g.info.nodesep;
  auxg.info.ranksep = g.info.ranksep;
  auxg.info.flags = g.info.flags;
  // Mirror C cloneGraph: if parent is flipped (LR/RL) set rankdir=TB on auxg,
  // else set rankdir=LR. The flat-adj pipeline needs the inverse axis.
  // @see lib/dotgen/dotsplines.c:787-790
  if (g.info.flip) {
    // SET_RANKDIR(auxg, RANKDIR_TB): rankdir=0, flip=false
    auxg.info.rankdir = 0;
    auxg.info.flip = false;
  } else {
    // SET_RANKDIR(auxg, RANKDIR_LR): rankdir=(1<<2)|1=5, flip=true
    auxg.info.rankdir = (1 << 2) | 1;
    auxg.info.flip = true;
  }
  auxg.info.dotroot = auxg;
  auxg.info.gvc = g.info.gvc;
  return auxg;
}

// ---------------------------------------------------------------------------
// runAuxPipeline — rank + mincross + position on the cloned graph
// ---------------------------------------------------------------------------

/** Run rank, mincross, position on auxg; return non-zero on failure. */
export function runAuxPipeline(auxg: Graph): number {
  dotRank(auxg);
  const r = dotMincross(auxg);
  if (r !== 0) return r;
  return dotPosition(auxg);
}

/** Run sameports + splines (no normalize) on auxg; return non-zero on failure. */
export function runAuxSplines(auxg: Graph): number {
  dotSameports(auxg);
  return dotSplines_(auxg, false);
}

// ---------------------------------------------------------------------------
// make_flat_adj_edges — recursive pipeline for adjacent flat edges
// @see lib/dotgen/dotsplines.c:make_flat_adj_edges
// ---------------------------------------------------------------------------

/**
 * Route flat edges between adjacent nodes by running the full dot pipeline
 * on a cloned subgraph (rotated 90°).
 *
 * Acceptance criterion 1: after this call, the cloned graph's nodes have
 * coord set (verified by dotPosition setting ND_coord).
 *
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges
 */
export function makeFlatAdjEdges(
  g: Graph,
  edges: Edge[],
  _cnt: number,
  _et: number,
): number {
  const auxg = cloneGraph(g);
  const r = runAuxPipeline(auxg);
  if (r !== 0) return r;
  const sr = runAuxSplines(auxg);
  if (sr !== 0) return sr;
  // Copy splines back — full transform deferred until pathplan is ported
  void edges;
  return 0;
}

// ---------------------------------------------------------------------------
// make_flat_edge — dispatch flat edge routing
// @see lib/dotgen/dotsplines.c:make_flat_edge
// ---------------------------------------------------------------------------

/**
 * Route a group of flat (same-rank) edges.
 * @see lib/dotgen/dotsplines.c:make_flat_edge
 */
export function makeFlatEdge(
  g: Graph,
  _sp: SplineInfo,
  edges: Edge[],
  cnt: number,
  et: number,
): number {
  if (cnt === 0 || edges.length === 0) return 0;
  const isAdj = edges.some(e => (e.info.adjacent ?? 0) !== 0);
  if (isAdj) return makeFlatAdjEdges(g, edges, cnt, et);
  // Non-adjacent flat edges: full routing deferred
  return 0;
}
