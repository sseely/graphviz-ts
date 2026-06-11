// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/common/postproc.c — gv_postprocess (coordinate
 * rotation + translation pass run after spline routing).
 *
 * Only the coordinate-transform functions are ported here; the label-placement
 * helpers (place_graph_label, place_flip_graph_label, addXLabels) live in
 * graph-label.ts and are handled by the dot pipeline before this function runs.
 *
 * @see lib/common/postproc.c:gv_postprocess
 * @see lib/common/postproc.c:map_point
 * @see lib/common/postproc.c:translate_bb
 * @see lib/common/postproc.c:translate_drawing
 */

import type { Graph } from '../model/graph.js';
import type { Point, Box } from '../model/geom.js';
import { ccwrotatepf } from '../model/geom.js';
import type { TextlabelT } from './types.js';
import { gvNodesize } from './poly-sizing.js';
import {
  RANKDIR_TB, RANKDIR_LR, RANKDIR_BT, RANKDIR_RL,
} from '../layout/dot/init.js';

// ---------------------------------------------------------------------------
// Module-level state (mirrors the C file-scope statics Rankdir, Flip, Offset)
// These are set once per gvPostprocess call and read by the helpers.
// @see lib/common/postproc.c:56-58
// ---------------------------------------------------------------------------

let Rankdir = 0;
let Offset: Point = { x: 0, y: 0 };

// ---------------------------------------------------------------------------
// map_point
// @see lib/common/postproc.c:90-96
// ---------------------------------------------------------------------------

/**
 * Apply the CCW rotation (Rankdir*90 degrees) then subtract Offset.
 * @see lib/common/postproc.c:map_point
 */
function mapPoint(p: Point): Point {
  const r = ccwrotatepf(p, Rankdir * 90);
  return { x: r.x - Offset.x, y: r.y - Offset.y };
}

// ---------------------------------------------------------------------------
// Label-position mapping helpers
// ---------------------------------------------------------------------------

/** Map pos on a TextlabelT in place if the label and its pos exist. */
function mapLabelPos(raw: unknown): void {
  const lab = raw as TextlabelT | undefined;
  if (lab?.pos !== undefined) lab.pos = mapPoint(lab.pos);
}

// ---------------------------------------------------------------------------
// Bezier / spline helpers
// @see lib/common/postproc.c:98-125 (map_edge)
// ---------------------------------------------------------------------------

/** Map all control points in one Bezier segment. */
function mapBezierPoints(bz: { list: Point[]; sflag: number; eflag: number; sp: Point; ep: Point }): void {
  for (let k = 0; k < bz.list.length; k++) {
    bz.list[k] = mapPoint(bz.list[k]);
  }
  if (bz.sflag) bz.sp = mapPoint(bz.sp);
  if (bz.eflag) bz.ep = mapPoint(bz.ep);
}

/** Map all spline segments on an edge. */
function mapSpl(spl: { list: Array<{ list: Point[]; sflag: number; eflag: number; sp: Point; ep: Point }> }): void {
  for (let j = 0; j < spl.list.length; j++) {
    mapBezierPoints(spl.list[j]);
  }
}

// ---------------------------------------------------------------------------
// map_edge
// @see lib/common/postproc.c:98-125
// ---------------------------------------------------------------------------

/** Map all points in a pre-computed arrowhead polygon (if present).
 *
 * The ccwrotatepf transforms used for BT (180°, {x,-y}) and RL (270°,
 * {y,x}) are reflections (determinant = -1), not proper rotations.
 * Reflections reverse the winding order of a polygon.  The C code computes
 * arrowhead polygons at render time from the already-rotated ep/sp
 * direction, so it naturally produces the correct winding.  We pre-compute
 * polygons as [rightBase, tip, leftBase] before postprocess; after a
 * reflection the visual chirality flips, turning rightBase into the visual
 * left and vice-versa.  Swap indices 0 and 2 to restore the expected order.
 *
 * TB (0°, identity, det = +1) and LR (90°, det = +1) are proper rotations
 * and do NOT reverse winding order, so no swap is needed for those cases.
 */
function mapArrowPts(info: Record<string, unknown>, key: string): void {
  const pts = info[key] as Point[] | undefined;
  if (!pts) return;
  const mapped = pts.map(mapPoint);
  const isReflection = Rankdir === RANKDIR_BT || Rankdir === RANKDIR_RL;
  if (isReflection && mapped.length === 3) {
    // Swap base points to correct winding reversal caused by the reflection.
    info[key] = [mapped[2], mapped[1], mapped[0]];
  } else {
    info[key] = mapped;
  }
}

/**
 * Map all spline control points, endpoint arrows, label positions, and
 * pre-computed arrowhead polygons for one edge.
 *
 * NOTE: The C port computes arrowhead polygons at render time from the
 * already-rotated ep/sp. The TypeScript port pre-computes them during
 * spline routing (in edge-route-chain.ts, edge-route.ts, splines-clip.ts)
 * as _arrowPts / _tailArrowPts. We must rotate them here so they match
 * the rotated coordinate space after gvPostprocess.
 *
 * @see lib/common/postproc.c:map_edge
 */
function mapEdge(e: { info: { spl?: { list: Array<{ list: Point[]; sflag: number; eflag: number; sp: Point; ep: Point }> }; label?: unknown; xlabel?: unknown; head_label?: unknown; tail_label?: unknown } }): void {
  const spl = e.info.spl;
  if (spl === undefined) return;
  mapSpl(spl);
  mapLabelPos(e.info.label);
  mapLabelPos(e.info.xlabel);
  mapLabelPos(e.info.head_label);
  mapLabelPos(e.info.tail_label);
  // Rotate pre-computed arrowhead polygon points (TS-only: C computes at render time).
  const info = e.info as unknown as Record<string, unknown>;
  mapArrowPts(info, '_arrowPts');
  mapArrowPts(info, '_tailArrowPts');
}

// ---------------------------------------------------------------------------
// translate_bb — bounding-box rotation per rankdir
// @see lib/common/postproc.c:127-146
// ---------------------------------------------------------------------------

/** Compute the new bb after mapping corners (LR/BT swap corners first). */
function rotateBb(bb: Box, rankdir: number): Box {
  if (rankdir === RANKDIR_LR || rankdir === RANKDIR_BT) {
    return {
      ll: mapPoint({ x: bb.ll.x, y: bb.ur.y }),
      ur: mapPoint({ x: bb.ur.x, y: bb.ll.y }),
    };
  }
  return {
    ll: mapPoint({ x: bb.ll.x, y: bb.ll.y }),
    ur: mapPoint({ x: bb.ur.x, y: bb.ur.y }),
  };
}

/**
 * Rotate the bounding box of a graph (and its clusters, recursively).
 * @see lib/common/postproc.c:translate_bb
 */
export function translateBb(g: Graph, rankdir: number): void {
  g.info.bb = rotateBb(g.info.bb, rankdir);
  mapLabelPos(g.info.label);
  const nc = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  for (let c = 1; c <= nc; c++) {
    if (clust?.[c - 1]) translateBb(clust[c - 1], rankdir);
  }
}

// ---------------------------------------------------------------------------
// Node-size reset helper
// @see lib/common/utils.c:gv_nodesize (flip=false branch)
// ---------------------------------------------------------------------------

/** Reset node lw/rw/ht to unflipped (width-based) values. */
function resetNodeSize(v: { info: { width?: number; height?: number; lw?: number; rw?: number; ht?: number } }): void {
  const widthPts  = v.info.width  !== undefined ? v.info.width  * 72 : (v.info.lw ?? 0) + (v.info.rw ?? 0);
  const heightPts = v.info.height !== undefined ? v.info.height * 72 : (v.info.ht ?? 0);
  const ns = gvNodesize(widthPts, heightPts, false);
  v.info.lw = ns.lw;
  v.info.rw = ns.rw;
  v.info.ht = ns.ht;
}

/** Map coord + xlabel for one node; resize if rankdir is non-TB. */
function mapNode(v: { info: { coord?: Point; xlabel?: unknown; width?: number; height?: number; lw?: number; rw?: number; ht?: number } }): void {
  if (Rankdir) resetNodeSize(v);
  v.info.coord = mapPoint(v.info.coord ?? { x: 0, y: 0 });
  mapLabelPos(v.info.xlabel);
}

// ---------------------------------------------------------------------------
// translate_drawing
// @see lib/common/postproc.c:153-172
// ---------------------------------------------------------------------------

/**
 * Translate and/or rotate nodes, splines, and bbox info.
 *
 * NOTE: The C comment says "if Rankdir (!= RANKDIR_BT), reset ND_lw/rw/ht"
 * but the code calls gv_nodesize(v, false) whenever Rankdir != 0.
 * We follow the code.
 *
 * @see lib/common/postproc.c:translate_drawing
 */
function translateDrawing(g: Graph): void {
  const shift = Offset.x !== 0 || Offset.y !== 0;
  if (!shift && !Rankdir) return;

  for (const v of g.nodes.values()) {
    mapNode(v);
    // State == GVSPLINES is always true post-spline-routing in the dot pipeline
    for (const e of g.edges) {
      if (e.tail === v) mapEdge(e);
    }
  }
  translateBb(g, g.info.rankdir & 0x3);
}

// ---------------------------------------------------------------------------
// Offset computation per rankdir
// @see lib/common/postproc.c:657-672
// ---------------------------------------------------------------------------

/** Compute Offset from the current bb for the given rankdir. */
function computeOffset(bb: Box, rankdir: number): Point {
  switch (rankdir) {
    case RANKDIR_TB: return { x: bb.ll.x, y: bb.ll.y };
    case RANKDIR_LR: return { x: -bb.ur.y, y: bb.ll.x };
    case RANKDIR_BT: return { x: bb.ll.x, y: -bb.ur.y };
    case RANKDIR_RL: return { x: bb.ll.y, y: bb.ll.x };
    default:         return { x: 0, y: 0 };
  }
}

// ---------------------------------------------------------------------------
// gvPostprocess
// @see lib/common/postproc.c:599-687
// ---------------------------------------------------------------------------

/**
 * Port of gv_postprocess with allowTranslation=1 (dotneato_postprocess path).
 *
 * Sets Rankdir from g.info.rankdir, computes the per-rankdir Offset,
 * then calls translateDrawing to rotate+shift all coordinates.
 *
 * Label placement (place_graph_label, addXLabels, place_root_label) is handled
 * by the dot pipeline's existing graph-label.ts pass before this call.
 *
 * @see lib/common/postproc.c:gv_postprocess
 * @see lib/common/postproc.c:dotneato_postprocess
 */
export function gvPostprocess(g: Graph): void {
  Rankdir = g.info.rankdir & 0x3;
  Offset = computeOffset(g.info.bb, Rankdir);
  translateDrawing(g);
}
