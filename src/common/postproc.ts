// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/common/postproc.c — gv_postprocess (coordinate
 * rotation + translation pass run after spline routing).
 *
 * addXLabels logic lives in xlabels-place.ts to keep this file under the
 * 500-line limit. It is called from gvPostprocess at the C point
 * (postproc.c:616 — after graph-label placement, before the bb adjustment).
 *
 * @see lib/common/postproc.c:gv_postprocess
 * @see lib/common/postproc.c:map_point
 * @see lib/common/postproc.c:translate_bb
 * @see lib/common/postproc.c:translate_drawing
 * @see lib/common/postproc.c:addXLabels
 */

import type { Graph } from '../model/graph.js';
import type { Point, Box } from '../model/geom.js';
import { ccwrotatepf } from '../model/geom.js';
import type { ArrowDrawOp } from './arrows-types.js';
import { mapArrowOpPoints } from './arrows-shapes-util.js';
import type { TextlabelT } from './types.js';
import { gvNodesize } from './poly-sizing.js';
import {
  RANKDIR_TB, RANKDIR_LR, RANKDIR_BT, RANKDIR_RL,
} from '../layout/dot/init.js';
import { addXLabels } from './xlabels-place.js';

/** Concentrated multi-edge duplicate — never drawn. @see lib/common/const.h:IGNORED */
const IGNORED_EDGE = 6;

// ---------------------------------------------------------------------------
// Module-level state (mirrors the C file-scope statics Rankdir, Flip, Offset)
// These are set once per gvPostprocess call and read by the helpers.
// @see lib/common/postproc.c:56-58
// ---------------------------------------------------------------------------

let Rankdir = 0;
let Offset: Point = { x: 0, y: 0 };

/** The edge-info shape map_edge reads/writes (spline, labels, arrow ops). */
interface EdgeArrowInfo {
  spl?: { list: Array<{ list: Point[]; sflag: number; eflag: number; sp: Point; ep: Point }> };
  label?: unknown;
  xlabel?: unknown;
  head_label?: unknown;
  tail_label?: unknown;
  headArrowOps?: ArrowDrawOp[];
  tailArrowOps?: ArrowDrawOp[];
}

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

/** Rotate the stored arrow draw-ops for the rankdir transform.
 * BT (180°) and RL (270°) are reflections (det = -1): they reverse polygon
 * winding, so each polygon's vertices are reversed to match the order the C
 * render-time generator produces. TB (0°) and LR (90°) are proper rotations
 * (det = +1) and need no reversal. @see lib/common/postproc.c:map_edge
 */
function mapArrowOps(ops: ArrowDrawOp[] | undefined): ArrowDrawOp[] | undefined {
  if (!ops) return ops;
  const isReflection = Rankdir === RANKDIR_BT || Rankdir === RANKDIR_RL;
  return ops.map((op) => {
    const m = mapArrowOpPoints(op, mapPoint);
    if (isReflection && m.kind === 'polygon') return { ...m, points: [...m.points].reverse() };
    return m;
  });
}

/** The edge-info shape map_edge reads/writes (spline, labels, arrow ops). */
interface EdgeArrowInfo {
  spl?: { list: Array<{ list: Point[]; sflag: number; eflag: number; sp: Point; ep: Point }> };
  label?: unknown;
  xlabel?: unknown;
  head_label?: unknown;
  tail_label?: unknown;
  headArrowOps?: ArrowDrawOp[];
  tailArrowOps?: ArrowDrawOp[];
}

/**
 * Map spline control points, label positions, and pre-computed arrow draw-ops
 * for one edge. The C port regenerates arrowheads at render time from the
 * rotated ep/sp; this port pre-computes them during routing, so they are
 * rotated here to match the post-gvPostprocess coordinate space.
 * @see lib/common/postproc.c:map_edge
 */
function mapEdge(e: { info: EdgeArrowInfo }): void {
  const spl = e.info.spl;
  if (spl === undefined) return;
  mapSpl(spl);
  mapLabelPos(e.info.label);
  mapLabelPos(e.info.xlabel);
  mapLabelPos(e.info.head_label);
  mapLabelPos(e.info.tail_label);
  // Rotate pre-computed arrowhead draw-ops (TS-only: C computes at render time).
  e.info.headArrowOps = mapArrowOps(e.info.headArrowOps);
  e.info.tailArrowOps = mapArrowOps(e.info.tailArrowOps);
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
      if (e.tail !== v) continue;
      // C map_edge: a spline-less (non-concentrate, non-IGNORED) edge was
      // LOST during routing — warn and skip, exactly as native dot.
      // @see lib/common/postproc.c:map_edge ("lost %s %s edge")
      if (e.info.spl === undefined) {
        if (!(g.info.concentrate ?? false) && (e.info.edge_type ?? 0) !== IGNORED_EDGE) {
          console.warn(`lost ${e.tail.name} ${e.head.name} edge`);
        }
        continue;
      }
      mapEdge(e);
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
// LABEL_AT constants
// @see lib/common/const.h:LABEL_AT_BOTTOM / LABEL_AT_TOP / LABEL_AT_LEFT / LABEL_AT_RIGHT
// ---------------------------------------------------------------------------

/** @see lib/common/const.h:LABEL_AT_BOTTOM */
const LABEL_AT_BOTTOM = 0;
/** @see lib/common/const.h:LABEL_AT_TOP */
const LABEL_AT_TOP = 1;
/** @see lib/common/const.h:LABEL_AT_LEFT */
const LABEL_AT_LEFT = 2;
/** @see lib/common/const.h:LABEL_AT_RIGHT */
const LABEL_AT_RIGHT = 4;

/** PAD constants (GAP=4): x += 4*GAP=16, y += 2*GAP=8. @see lib/common/macros.h:PAD */
const XPAD_AMOUNT = 16;
const YPAD_AMOUNT = 8;

// ---------------------------------------------------------------------------
// rootLabelPos — read label position flags directly from graph attrs
// Used when doGraphLabel hasn't set label_pos on the root graph.
// @see lib/common/input.c:do_graph_label:866-877
// ---------------------------------------------------------------------------

/**
 * Compute the label-position flag for the root graph from its attributes.
 * Root default is LABEL_AT_BOTTOM (unlike clusters which default to TOP).
 * @see lib/common/input.c:do_graph_label:866-877
 */
function rootLabelPos(g: Graph): number {
  const loc = g.attrs.get('labelloc');
  let pos: number = loc && loc[0] === 't' ? LABEL_AT_TOP : LABEL_AT_BOTTOM;
  const just = g.attrs.get('labeljust');
  if (just) {
    if (just[0] === 'l') pos |= LABEL_AT_LEFT;
    else if (just[0] === 'r') pos |= LABEL_AT_RIGHT;
  }
  return pos;
}

// ---------------------------------------------------------------------------
// expandBbForRootLabel — expand bounding box for unplaced root graph label
// @see lib/common/postproc.c:619-655
// ---------------------------------------------------------------------------

/**
 * If the root graph has an unset label, expand the bounding box to make
 * room for it and return the padded dimen. Returns {x:0, y:0} otherwise.
 *
 * Called after addXLabels (postproc.c:616), before Offset/translateDrawing.
 *
 * @see lib/common/postproc.c:619-655
 */
function expandBbForRootLabel(g: Graph): { x: number; y: number } {
  const label = g.info.label as TextlabelT | undefined;
  if (!label || label.set) return { x: 0, y: 0 };

  const dimen = { x: label.dimen.x + XPAD_AMOUNT, y: label.dimen.y + YPAD_AMOUNT };
  const labelPos = rootLabelPos(g);
  const flip = g.info.flip ?? false;
  const bb = g.info.bb;

  if (flip) {
    expandBbFlip(bb, dimen, labelPos);
  } else {
    expandBbNoFlip(bb, dimen, labelPos, Rankdir);
  }
  return dimen;
}

/** @see lib/common/postproc.c:622-634 (Flip branch) */
function expandBbFlip(bb: { ll: { x: number; y: number }; ur: { x: number; y: number } }, dimen: { x: number; y: number }, labelPos: number): void {
  if (labelPos & LABEL_AT_TOP) {
    bb.ur.x += dimen.y;
  } else {
    bb.ll.x -= dimen.y;
  }
  const span = bb.ur.y - bb.ll.y;
  if (dimen.x > span) {
    const diff = (dimen.x - span) / 2;
    bb.ll.y -= diff;
    bb.ur.y += diff;
  }
}

/** Expand bb y-axis for label height in the non-flip case. @see lib/common/postproc.c:636-646 */
function expandBbNoFlipY(bb: { ll: { x: number; y: number }; ur: { x: number; y: number } }, dy: number, labelPos: number, rankdir: number): void {
  if (labelPos & LABEL_AT_TOP) {
    if (rankdir === RANKDIR_TB) bb.ur.y += dy; else bb.ll.y -= dy;
  } else {
    if (rankdir === RANKDIR_TB) bb.ll.y -= dy; else bb.ur.y += dy;
  }
}

/** @see lib/common/postproc.c:635-654 (non-Flip branch) */
function expandBbNoFlip(bb: { ll: { x: number; y: number }; ur: { x: number; y: number } }, dimen: { x: number; y: number }, labelPos: number, rankdir: number): void {
  expandBbNoFlipY(bb, dimen.y, labelPos, rankdir);
  const span = bb.ur.x - bb.ll.x;
  if (dimen.x > span) {
    const diff = (dimen.x - span) / 2;
    bb.ll.x -= diff;
    bb.ur.x += diff;
  }
}

// ---------------------------------------------------------------------------
// place_root_label
// @see lib/common/postproc.c:174-200
// ---------------------------------------------------------------------------

/** Label x-coordinate per justification flags. @see lib/common/postproc.c:184-190 */
function rootLabelX(bb: Box, labelPos: number, dimX: number): number {
  if (labelPos & LABEL_AT_RIGHT) return bb.ur.x - dimX / 2;
  if (labelPos & LABEL_AT_LEFT)  return bb.ll.x + dimX / 2;
  return (bb.ll.x + bb.ur.x) / 2;
}

/** Label y-coordinate per position flag. @see lib/common/postproc.c:192-196 */
function rootLabelY(bb: Box, labelPos: number, dimY: number): number {
  if (labelPos & LABEL_AT_TOP) return bb.ur.y - dimY / 2;
  return bb.ll.y + dimY / 2;
}

/**
 * Set the position of the root graph label.
 * Called after translate_drawing so the bb is already in output space;
 * no flip/rotation compensation is needed here.
 *
 * @see lib/common/postproc.c:place_root_label
 */
export function placeRootLabel(g: Graph, dimen: { x: number; y: number }): void {
  const label = g.info.label as TextlabelT | undefined;
  if (!label) return;
  const labelPos = rootLabelPos(g);
  const bb = g.info.bb;
  label.pos = { x: rootLabelX(bb, labelPos, dimen.x), y: rootLabelY(bb, labelPos, dimen.y) };
  label.set = true;
}

// ---------------------------------------------------------------------------
// gvPostprocess
// @see lib/common/postproc.c:599-687
// ---------------------------------------------------------------------------

/**
 * Port of gv_postprocess with allowTranslation=1 (dotneato_postprocess path).
 *
 * Order matches C: addXLabels → expand bb for root label → compute Offset →
 * translateDrawing → place_root_label.
 *
 * addXLabels is called at postproc.c:616 — after place_graph_label (cluster
 * labels handled elsewhere), before bb adjustment.
 * Root graph label is placed at postproc.c:675-676, after translateDrawing.
 *
 * @see lib/common/postproc.c:gv_postprocess
 * @see lib/common/postproc.c:dotneato_postprocess
 */
export function gvPostprocess(g: Graph): void {
  Rankdir = g.info.rankdir & 0x3;
  // addXLabels at postproc.c:616 — after place_graph_label, before bb adjust.
  addXLabels(g);
  // Expand bb to make room for root graph label (postproc.c:619-655).
  const dimen = expandBbForRootLabel(g);
  // Compute Offset from the (possibly expanded) bb, then translate.
  Offset = computeOffset(g.info.bb, Rankdir);
  translateDrawing(g);
  // Place root graph label after translation (postproc.c:675-676).
  const rootLabel = g.info.label as TextlabelT | undefined;
  if (rootLabel && !rootLabel.set) {
    placeRootLabel(g, dimen);
  }
}
