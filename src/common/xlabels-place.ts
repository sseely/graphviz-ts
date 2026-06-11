// SPDX-License-Identifier: EPL-2.0

/**
 * addXLabels and its helpers — ported from lib/common/postproc.c:202-590.
 *
 * Split from postproc.ts to keep that file under 500 lines.
 * Spline midpoint helpers live in spline-midpoint.ts.
 *
 * @see lib/common/postproc.c:addXLabels
 */

import type { Graph } from '../model/graph.js';
import type { Point } from '../model/geom.js';
import type { TextlabelT } from './types.js';
import {
  EDGE_LABEL, HEAD_LABEL, TAIL_LABEL, NODE_XLABEL, EDGE_XLABEL, mapbool,
} from '../layout/dot/rank.js';
import { GRAPH_LABEL } from '../layout/dot/graph-label.js';
import {
  edgeType, EDGETYPE_NONE, EDGETYPE_SPLINE, EDGETYPE_CURVED,
} from '../layout/dot/splines.js';
import { placeLabels } from '../label/xlabels.js';
import type { XLabelT, ObjectT, LabelParamsT } from '../label/xlabels.js';
import {
  dist2, dotneatoClosest, polylineMidpoint, splEndPoints, type SplLike,
} from './spline-midpoint.js';

// ---------------------------------------------------------------------------
// Constants. @see lib/common/geom.h:INCH2PS
// ---------------------------------------------------------------------------

const INCH2PS_PP = 72.0;
const MILLIPOINT = 0.001;

// ---------------------------------------------------------------------------
// centerPt — @see lib/common/postproc.c:202-215
// ---------------------------------------------------------------------------

/**
 * Calculate center from an xlabel's lower-left pos + size.
 * @see lib/common/postproc.c:centerPt
 */
export function centerPt(xlp: XLabelT): Point {
  return { x: xlp.pos.x + xlp.sz.x / 2.0, y: xlp.pos.y + xlp.sz.y / 2.0 };
}

// ---------------------------------------------------------------------------
// adjustBB — @see lib/common/postproc.c:282-296
// ---------------------------------------------------------------------------

function adjustBB(
  objp: ObjectT,
  bb: { ll: Point; ur: Point },
): { ll: Point; ur: Point } {
  return {
    ll: { x: Math.min(bb.ll.x, objp.pos.x), y: Math.min(bb.ll.y, objp.pos.y) },
    ur: {
      x: Math.max(bb.ur.x, objp.pos.x + objp.sz.x),
      y: Math.max(bb.ur.y, objp.pos.y + objp.sz.y),
    },
  };
}

// ---------------------------------------------------------------------------
// XLabelCtx — shared context for the fill pass
// ---------------------------------------------------------------------------

/** Shared mutable context threaded through the object/label fill pass. */
export interface XLabelCtx {
  objs: ObjectT[];
  lbls: XLabelT[];
  flip: boolean;
  oi: number;
  xi: number;
  bb: { ll: Point; ur: Point };
}

// ---------------------------------------------------------------------------
// addXLabel — @see lib/common/postproc.c:298-319
// ---------------------------------------------------------------------------

/**
 * Set up xlabel_t object and connect with related object.
 * @see lib/common/postproc.c:addXLabel
 */
export function addXLabel(
  lp: TextlabelT,
  ctx: XLabelCtx,
  initObj: boolean,
  pos: Point,
): void {
  const objp = ctx.objs[ctx.oi];
  const xlp = ctx.lbls[ctx.xi];
  if (initObj) {
    objp.pos = { x: pos.x, y: pos.y };
    objp.sz = { x: 0, y: 0 };
    objp.lbl = null;
  }
  xlp.sz = ctx.flip
    ? { x: lp.dimen.y, y: lp.dimen.x }
    : { x: lp.dimen.x, y: lp.dimen.y };
  xlp.lbl = lp;
  xlp.set = 0;
  objp.lbl = xlp;
  ctx.xi++;
}

// ---------------------------------------------------------------------------
// addLabelObj — @see lib/common/postproc.c:321-343
// ---------------------------------------------------------------------------

/**
 * Set up obstacle object based on a set external label.
 * @see lib/common/postproc.c:addLabelObj
 */
export function addLabelObj(
  lp: TextlabelT,
  objp: ObjectT,
  bb: { ll: Point; ur: Point },
  flip: boolean,
): { ll: Point; ur: Point } {
  objp.sz = flip
    ? { x: lp.dimen.y, y: lp.dimen.x }
    : { x: lp.dimen.x, y: lp.dimen.y };
  objp.pos = { x: lp.pos.x - objp.sz.x / 2.0, y: lp.pos.y - objp.sz.y / 2.0 };
  objp.lbl = null;
  return adjustBB(objp, bb);
}

// ---------------------------------------------------------------------------
// addNodeObj — @see lib/common/postproc.c:344-366
// ---------------------------------------------------------------------------

/**
 * Set up obstacle object based on a node.
 * @see lib/common/postproc.c:addNodeObj
 */
export function addNodeObj(
  np: { info: { coord?: Point; width?: number; height?: number } },
  objp: ObjectT,
  bb: { ll: Point; ur: Point },
  flip: boolean,
): { ll: Point; ur: Point } {
  const wIn = np.info.width ?? 0;
  const hIn = np.info.height ?? 0;
  objp.sz = flip
    ? { x: INCH2PS_PP * hIn, y: INCH2PS_PP * wIn }
    : { x: INCH2PS_PP * wIn, y: INCH2PS_PP * hIn };
  const coord = np.info.coord ?? { x: 0, y: 0 };
  objp.pos = {
    x: coord.x - objp.sz.x / 2.0,
    y: coord.y - objp.sz.y / 2.0,
  };
  objp.lbl = null;
  return adjustBB(objp, bb);
}

// ---------------------------------------------------------------------------
// countClusterLabels + addClusterObj — @see lib/common/postproc.c:368-396
// ---------------------------------------------------------------------------

interface CinfoT { bb: { ll: Point; ur: Point }; objpIdx: number }

/** @see lib/common/postproc.c:countClusterLabels */
export function countClusterLabels(
  g: Graph,
  isRoot: (h: Graph) => boolean,
): number {
  const selfCount =
    (!isRoot(g) && g.info.label && (g.info.label as TextlabelT).set) ? 1 : 0;
  const nc = g.info.n_cluster ?? 0;
  let i = selfCount;
  for (let c = 1; c <= nc; c++) {
    const sub = g.info.clust?.[c - 1];
    if (sub) i += countClusterLabels(sub, isRoot);
  }
  return i;
}

/** @see lib/common/postproc.c:addClusterObj */
export function addClusterObj(
  g: Graph,
  objs: ObjectT[],
  info: CinfoT,
  isRoot: (h: Graph) => boolean,
  flip: boolean,
): CinfoT {
  const nc = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nc; c++) {
    const sub = g.info.clust?.[c - 1];
    if (sub) info = addClusterObj(sub, objs, info, isRoot, flip);
  }
  if (!isRoot(g) && g.info.label && (g.info.label as TextlabelT).set) {
    info.bb = addLabelObj(
      g.info.label as TextlabelT, objs[info.objpIdx], info.bb, flip,
    );
    info.objpIdx++;
  }
  return info;
}

// ---------------------------------------------------------------------------
// getSplinePoints — @see lib/common/splines.c:1363-1374
// ---------------------------------------------------------------------------

type BezLike2 = { list: Point[]; sflag: number; eflag: number; sp: Point; ep: Point };
export type ELike = {
  info: {
    spl?: { list: BezLike2[] };
    edge_type?: number;
    to_orig?: ELike;
    label?: TextlabelT;
    tail_label?: TextlabelT;
    head_label?: TextlabelT;
    xlabel?: TextlabelT;
  }
};

/**
 * Follow to_orig until a spline is found.
 * @see lib/common/splines.c:getsplinepoints
 */
export function getSplinePoints(e: ELike): SplLike | null {
  let le = e;
  while (!le.info.spl && le.info.edge_type !== 0) {
    const orig = le.info.to_orig;
    if (!orig) break;
    le = orig;
  }
  return (le.info.spl as SplLike | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// edgeTailpoint / edgeHeadpoint — @see lib/common/postproc.c:242-278
// ---------------------------------------------------------------------------

/** @see lib/common/postproc.c:edgeTailpoint */
export function edgeTailpoint(e: ELike): Point {
  const spl = getSplinePoints(e);
  if (!spl) return { x: 0, y: 0 };
  const bez = spl.list[0];
  return bez.sflag ? { x: bez.sp.x, y: bez.sp.y } : { x: bez.list[0].x, y: bez.list[0].y };
}

/** @see lib/common/postproc.c:edgeHeadpoint */
export function edgeHeadpoint(e: ELike): Point {
  const spl = getSplinePoints(e);
  if (!spl) return { x: 0, y: 0 };
  const last = spl.list[spl.list.length - 1];
  if (last.eflag) return { x: last.ep.x, y: last.ep.y };
  const pts = last.list;
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
}

// ---------------------------------------------------------------------------
// edgeMidpoint — @see lib/common/splines.c:1283-1301
// ---------------------------------------------------------------------------

/** @see lib/common/splines.c:edgeMidpoint */
export function edgeMidpoint(g: Graph, e: ELike): Point {
  const spl = getSplinePoints(e);
  if (!spl || spl.list.length === 0) return { x: 0, y: 0 };
  const { p, q } = splEndPoints(spl);
  if (dist2(p, q) < MILLIPOINT * MILLIPOINT) return { x: p.x, y: p.y };
  const et = edgeType(g);
  if (et === EDGETYPE_SPLINE || et === EDGETYPE_CURVED) {
    return dotneatoClosest(spl, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  }
  return polylineMidpoint(spl);
}

// ---------------------------------------------------------------------------
// haveEdge / updateBBForLabel
// ---------------------------------------------------------------------------

function haveEdge(et: number, e: { info: { spl?: unknown } }): boolean {
  return et !== EDGETYPE_NONE && e.info.spl !== undefined;
}

function updateBBForLabel(g: Graph, lp: TextlabelT): void {
  const bb = g.info.bb;
  const hw = lp.dimen.x / 2;
  const hh = lp.dimen.y / 2;
  if (lp.pos.x - hw < bb.ll.x) bb.ll.x = lp.pos.x - hw;
  if (lp.pos.y - hh < bb.ll.y) bb.ll.y = lp.pos.y - hh;
  if (lp.pos.x + hw > bb.ur.x) bb.ur.x = lp.pos.x + hw;
  if (lp.pos.y + hh > bb.ur.y) bb.ur.y = lp.pos.y + hh;
}

// ---------------------------------------------------------------------------
// addXLabels helpers — split to keep addXLabels CCN low
// ---------------------------------------------------------------------------

/** Count unset/set label slots for one edge. */
function countEdgeSlots(
  ep: { info: { xlabel?: TextlabelT; head_label?: TextlabelT; tail_label?: TextlabelT; label?: TextlabelT; spl?: unknown } },
  et: number,
): { nElbls: number; nSetLbls: number } {
  let nElbls = 0; let nSetLbls = 0;
  const slot = (lp: TextlabelT | undefined): void => {
    if (!lp) return;
    if (lp.set) nSetLbls++; else if (haveEdge(et, ep)) nElbls++;
  };
  slot(ep.info.label);
  slot(ep.info.tail_label);
  slot(ep.info.head_label);
  slot(ep.info.xlabel);
  return { nElbls, nSetLbls };
}

/** Fill one label slot into ctx; advance oi (and xi if unset). */
function fillOne(
  lp: TextlabelT | undefined,
  ep: { info: { spl?: unknown } },
  et: number,
  ctx: XLabelCtx,
  posFn: () => Point,
): void {
  if (!lp) return;
  if (lp.set) {
    ctx.bb = addLabelObj(lp, ctx.objs[ctx.oi], ctx.bb, ctx.flip);
    ctx.oi++;
  } else if (haveEdge(et, ep)) {
    addXLabel(lp, ctx, true, posFn());
    ctx.oi++;
  }
}

/** Fill objs/lbls for one edge's four label slots. */
function fillEdge(
  gp: Graph,
  ep: ELike,
  et: number,
  ctx: XLabelCtx,
): void {
  fillOne(ep.info.label,      ep, et, ctx, () => edgeMidpoint(gp, ep));
  fillOne(ep.info.tail_label, ep, et, ctx, () => edgeTailpoint(ep));
  fillOne(ep.info.head_label, ep, et, ctx, () => edgeHeadpoint(ep));
  fillOne(ep.info.xlabel,     ep, et, ctx, () => edgeMidpoint(gp, ep));
}

/** Count label slots across all nodes and edges; return totals. */
function countAllSlots(
  gp: Graph,
  et: number,
): { nNlbls: number; nElbls: number; nSetLbls: number } {
  let nNlbls = 0; let nElbls = 0; let nSetLbls = 0;
  for (const np of gp.nodes.values()) {
    const nxl = np.info.xlabel as TextlabelT | undefined;
    if (nxl) { if (nxl.set) nSetLbls++; else nNlbls++; }
    for (const ep of gp.edges) {
      if (ep.tail !== np) continue;
      const c = countEdgeSlots(ep, et);
      nElbls += c.nElbls; nSetLbls += c.nSetLbls;
    }
  }
  return { nNlbls, nElbls, nSetLbls };
}

/** Build objs/lbls arrays and fill them from the graph traversal. */
function buildArrays(
  gp: Graph,
  nObjs: number,
  nLbls: number,
  nClbls: number,
  et: number,
): { ctx: XLabelCtx } {
  const objs: ObjectT[] = Array.from(
    { length: nObjs },
    () => ({ pos: { x: 0, y: 0 }, sz: { x: 0, y: 0 }, lbl: null }),
  );
  const lbls: XLabelT[] = Array.from(
    { length: nLbls },
    () => ({ sz: { x: 0, y: 0 }, pos: { x: 0, y: 0 }, lbl: null, set: 0 }),
  );
  const flip = gp.info.flip ?? false;
  const ctx: XLabelCtx = {
    objs, lbls, flip, oi: 0, xi: 0,
    bb: {
      ll: { x: Number.MAX_VALUE, y: Number.MAX_VALUE },
      ur: { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE },
    },
  };

  for (const np of gp.nodes.values()) {
    ctx.bb = addNodeObj(np, objs[ctx.oi], ctx.bb, flip);
    const nxl = np.info.xlabel as TextlabelT | undefined;
    if (nxl) {
      if (nxl.set) {
        ctx.oi++;
        ctx.bb = addLabelObj(nxl, objs[ctx.oi], ctx.bb, flip);
      } else {
        addXLabel(nxl, ctx, false, { x: 0, y: 0 });
      }
    }
    ctx.oi++;
    for (const ep of gp.edges) {
      if (ep.tail !== np) continue;
      fillEdge(gp, ep as ELike, et, ctx);
    }
  }

  if (nClbls) {
    const r = addClusterObj(
      gp, objs, { bb: ctx.bb, objpIdx: ctx.oi }, (h) => h === gp, flip,
    );
    ctx.bb = r.bb;
  }

  return { ctx };
}

/** Write placed label positions back to the graph; update bb. */
function writeBackLabels(gp: Graph, lbls: XLabelT[], nLbls: number): void {
  for (let i = 0; i < nLbls; i++) {
    const xlp = lbls[i];
    if (xlp.set) {
      const lp = xlp.lbl as TextlabelT;
      lp.set = true;
      lp.pos = centerPt(xlp);
      updateBBForLabel(gp, lp);
    }
  }
}

// ---------------------------------------------------------------------------
// addXLabels — @see lib/common/postproc.c:405-590
// ---------------------------------------------------------------------------

const XLABEL_WORK_MASK = NODE_XLABEL | EDGE_XLABEL | TAIL_LABEL | HEAD_LABEL;

/** True when the graph has xlabel/edge-label work that needs placement. */
function needsXLabelWork(gp: Graph): boolean {
  const h = gp.info.has_labels ?? 0;
  if (h & XLABEL_WORK_MASK) return true;
  return !!(h & EDGE_LABEL) && !(gp.info.edgeLabelsDone ?? false);
}

/** Run one placeLabels pass: count slots, build arrays, place, write back. */
function runPlacement(gp: Graph): void {
  const hasLabels = gp.info.has_labels ?? 0;
  const et = edgeType(gp);
  const { nNlbls, nElbls, nSetLbls } = countAllSlots(gp, et);
  const nClbls = (hasLabels & GRAPH_LABEL)
    ? countClusterLabels(gp, (h) => h === gp)
    : 0;
  const nLbls = nNlbls + nElbls;
  if (nLbls === 0) return;
  const nObjs = gp.nodes.size + nSetLbls + nClbls + nElbls;
  const { ctx } = buildArrays(gp, nObjs, nLbls, nClbls, et);
  const forceStr = gp.attrs.get('forcelabels');
  const force = forceStr === undefined ? true : mapbool(forceStr);
  const params: LabelParamsT = { bb: { ll: ctx.bb.ll, ur: ctx.bb.ur }, force };
  placeLabels(ctx.objs, ctx.lbls, params);
  writeBackLabels(gp, ctx.lbls, nLbls);
}

/**
 * Position xlabels and any unpositioned edge labels using the placement
 * algorithm to avoid overlap.
 *
 * @see lib/common/postproc.c:addXLabels
 */
export function addXLabels(gp: Graph): void {
  if (!needsXLabelWork(gp)) return;
  runPlacement(gp);
}
