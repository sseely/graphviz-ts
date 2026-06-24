// SPDX-License-Identifier: EPL-2.0

/**
 * Faithful adjacent-rank regular-edge routing for dot.
 *
 * Assembles the `beginPath → completeRegularPath → routeSplines` box-channel
 * pipeline that C's `make_regular_edge` uses. This is the sequence the
 * simplified active fitter (`buildRankCorridor`/`computeSpline`) bypasses;
 * the simplified fitter truncates the non-monotonic loop corridor a steering
 * port needs (tail exits the TOP face while the head is below). routeSplines
 * routes that corridor completely.
 *
 * SR2 scope: regular **adjacent-rank** edges only. Returns the spline control
 * points in graphviz-internal y-up coordinates (the frame dot's router runs
 * in; SVG y-negation is a later render pass). `clipAndInstall` + arrows +
 * `routeOneEdge` wiring is SR3 — this module does not install anything.
 *
 * Deviations from C, journaled in decision-journal.md (SR2):
 * - Cluster bounds (`cl_bound`) in maximal_bbox are not ported; no batch-2/3
 *   test graph has clusters. The neighbor branch uses node extents only.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 * @see lib/dotgen/dotsplines.c:completeregularpath
 * @see lib/dotgen/dotsplines.c:adjustregularpath
 * @see lib/dotgen/dotsplines.c:makeregularend
 * @see lib/dotgen/dotsplines.c:maximal_bbox
 * @see lib/dotgen/dotsplines.c:rank_box
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Box, Point } from '../../model/geom.js';
import type { Path, PathendT } from '../../common/types.js';
import { makePort } from '../../model/edgeInfo.js';
import { beginPath } from '../../common/splines-path-begin.js';
import { endPath } from '../../common/splines-path-end.js';
import { routeRegularByType } from './splines-route-type.js';
import { edgeType } from './splines.js';
import { addBox } from '../../common/splines-path-shared.js';
import { TOP, BOTTOM, REGULAREDGE } from '../../common/splines-constants.js';
import { VIRTUAL, NORMAL } from './fastgr.js';
import { neighbor, topBound, botBound, nodeType, splineMerge } from './splines-route.js';
import { computeLeftBound, computeRightBound, rankHt } from './edge-route-rank.js';
import { graphRanksep } from './position-aux.js';

/** maximal_bbox uses a local `#define FUDGE 4` (wider than splines.c FUDGE=2). */
const MBB_FUDGE = 4;
/** Minimum width of a box in the edge path. @see lib/dotgen/dotsplines.c:MINW */
const MINW = 16;
/** Half of MINW. @see lib/dotgen/dotsplines.c:HALFMINW */
const HALFMINW = 8;

/**
 * Per-call routing bounds, mirroring the fields of spline_info_t that
 * maximal_bbox / rank_box read.
 * @see lib/dotgen/dotsplines.c:spline_info_t
 */
export interface SplineBounds {
  leftBound: number;
  rightBound: number;
  splinesep: number;
}

/** Bundled context for the maximal_bbox helpers (keeps params <= 5). */
export interface BboxCtx {
  g: Graph;
  sp: SplineBounds;
}

/** Bundled arguments for completeRegularPath (keeps params <= 5). */
export interface RegularPathParts {
  P: Path;
  first: Edge;
  last: Edge;
  tend: PathendT;
  hend: PathendT;
  boxes: Box[];
}

// ---------------------------------------------------------------------------
// maximal_bbox
// ---------------------------------------------------------------------------

/** True for a virtual node carrying an edge label (gets reserved x-space). */
function isLabeledVirtual(n: Node): boolean {
  return nodeType(n) === VIRTUAL && n.info.label != null;
}

/** Tail/head clusters behind node n: its own cluster when NORMAL, else the
 *  original edge's endpoint clusters. @see cl_bound (dotsplines.c:2135-2140) */
function endpointClusters(n: Node): [Graph | undefined, Graph | undefined] {
  if (nodeType(n) === NORMAL) return [n.info.clust, n.info.clust];
  const orig = n.info.out?.list[0]?.info.to_orig;
  return [orig?.tail.info.clust, orig?.head.info.clust];
}

/** A real (non-root) cluster that is neither endpoint's cluster. C's
 *  `cl && cl != tcl && cl != hcl`. */
function interferes(cl: Graph | undefined, tcl: Graph | undefined, hcl: Graph | undefined): cl is Graph {
  return cl !== undefined && cl !== tcl && cl !== hcl;
}

/** True if virtual node n's coord lies inside cluster cl's bbox.
 *  @see lib/dotgen/dotsplines.c:cl_vninside */
function clVninside(cl: Graph, n: Node): boolean {
  const bb = cl.info.bb;
  if (bb === undefined) return false;
  const c = n.info.coord;
  return bb.ll.x <= c.x && c.x <= bb.ur.x && bb.ll.y <= c.y && c.y <= bb.ur.y;
}

/** The cluster of a virtual adj node that interferes with n, if its coord lies
 *  inside it. @see cl_bound (dotsplines.c:2141-2153) */
function virtualAdjCluster(adj: Node, tcl: Graph | undefined, hcl: Graph | undefined): Graph | undefined {
  const orig = adj.info.out?.list[0]?.info.to_orig;
  if (orig === undefined) return undefined;
  const tc = orig.tail.info.clust;
  if (interferes(tc, tcl, hcl) && clVninside(tc, adj)) return tc;
  const hc = orig.head.info.clust;
  if (interferes(hc, tcl, hcl) && clVninside(hc, adj)) return hc;
  return undefined;
}

/**
 * Return the cluster of `adj` that interferes with the routing of `n`, or
 * undefined. A box adjacent to a node in a different cluster is clamped to that
 * cluster's boundary so the spline routes around it.
 * @see lib/dotgen/dotsplines.c:cl_bound (2129)
 */
function clBound(n: Node, adj: Node): Graph | undefined {
  const [tcl, hcl] = endpointClusters(n);
  if (nodeType(adj) === NORMAL) {
    const cl = adj.info.clust;
    return interferes(cl, tcl, hcl) ? cl : undefined;
  }
  return virtualAdjCluster(adj, tcl, hcl);
}

/** Left x-extent of the maximal bbox. @see lib/dotgen/dotsplines.c:maximal_bbox */
function bboxLeftX(ctx: BboxCtx, vn: Node, ie: Edge | undefined, oe: Edge | undefined): number {
  const b = vn.info.coord.x - vn.info.lw - MBB_FUDGE;
  const left = neighbor(ctx.g, vn, ie, oe, -1);
  if (!left) return Math.min(Math.round(b), ctx.sp.leftBound);
  // A left neighbor in another cluster clamps us to that cluster's right edge.
  const clBb = clBound(vn, left)?.info.bb;
  const nb = clBb !== undefined
    ? clBb.ur.x + ctx.sp.splinesep
    : left.info.coord.x + (left.info.mval ?? 0)
      + (nodeType(left) === NORMAL ? (ctx.g.info.nodesep ?? 18) / 2 : ctx.sp.splinesep);
  return Math.round(Math.min(nb, b));
}

/** Right x-extent of the maximal bbox. @see lib/dotgen/dotsplines.c:maximal_bbox */
function bboxRightX(ctx: BboxCtx, vn: Node, ie: Edge | undefined, oe: Edge | undefined): number {
  const b = isLabeledVirtual(vn)
    ? vn.info.coord.x + 10
    : vn.info.coord.x + vn.info.rw + MBB_FUDGE;
  const right = neighbor(ctx.g, vn, ie, oe, 1);
  if (!right) return Math.max(Math.round(b), ctx.sp.rightBound);
  // A right neighbor in another cluster clamps us to that cluster's left edge.
  const clBb = clBound(vn, right)?.info.bb;
  const nb = clBb !== undefined
    ? clBb.ll.x - ctx.sp.splinesep
    : right.info.coord.x - right.info.lw
      - (nodeType(right) === NORMAL ? (ctx.g.info.nodesep ?? 18) / 2 : ctx.sp.splinesep);
  return Math.round(Math.max(nb, b));
}

/**
 * Build the initial bounding box for begin/endpath at node vn.
 * @see lib/dotgen/dotsplines.c:maximal_bbox
 */
export function maximalBbox(ctx: BboxCtx, vn: Node, ie: Edge | undefined, oe: Edge | undefined): Box {
  const llx = bboxLeftX(ctx, vn, ie, oe);
  let urx = bboxRightX(ctx, vn, ie, oe);
  if (isLabeledVirtual(vn)) {
    urx -= vn.info.rw;
    if (urx < llx) urx = vn.info.coord.x;
  }
  const ranks = ctx.g.info.rank!;
  const r = vn.info.rank!;
  return {
    ll: { x: llx, y: vn.info.coord.y - rankHt(ranks[r].ht1, vn.info.ht) },
    ur: { x: urx, y: vn.info.coord.y + rankHt(ranks[r].ht2, vn.info.ht) },
  };
}

// ---------------------------------------------------------------------------
// makeregularend / rank_box
// ---------------------------------------------------------------------------

/**
 * Fill box between a node and the inter-rank space (nodes on a rank can differ
 * in height). Regular edges always go top to bottom.
 * @see lib/dotgen/dotsplines.c:makeregularend
 */
function makeRegularEnd(b: Box, side: number, y: number): Box {
  if (side === BOTTOM) return { ll: { x: b.ll.x, y }, ur: { x: b.ur.x, y: b.ll.y } };
  return { ll: { x: b.ll.x, y: b.ur.y }, ur: { x: b.ur.x, y } };
}

/**
 * Override the endpoint box's y-extent from the last begin/endpath box, then
 * append a makeregularend box if it is non-degenerate.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (b.UR.y/LL.y + makeregularend)
 */
export function appendRegularEnd(nb: Box, endp: PathendT, side: number, y: number): void {
  const last = endp.boxes[endp.boxn - 1];
  const b: Box = { ll: { x: nb.ll.x, y: last.ll.y }, ur: { x: nb.ur.x, y: last.ur.y } };
  const end = makeRegularEnd(b, side, y);
  if (end.ll.x < end.ur.x && end.ll.y < end.ur.y) endp.boxes[endp.boxn++] = end;
}

/**
 * Inter-rank space box spanning the full routing width between rank r (tail)
 * and rank r+1 (head).
 * @see lib/dotgen/dotsplines.c:rank_box
 */
export function rankBox(ctx: BboxCtx, r: number): Box {
  const ranks = ctx.g.info.rank!;
  const top = ranks[r].v[0];
  const bot = ranks[r + 1].v[0];
  return {
    ll: { x: ctx.sp.leftBound, y: bot.info.coord.y + rankHt(ranks[r + 1].ht2, bot.info.ht) },
    ur: { x: ctx.sp.rightBound, y: top.info.coord.y - rankHt(ranks[r].ht1, top.info.ht) },
  };
}

// ---------------------------------------------------------------------------
// completeregularpath / adjustregularpath
// ---------------------------------------------------------------------------

/**
 * Mirror of C `getsplinepoints`: walk the `to_orig` chain looking for a routed
 * spline, stopping at the first edge that has one or at a NORMAL (real) edge.
 * Returns true when the chain yields no spline. A bound edge's spline often
 * lives on its `to_orig` original rather than on the virtual edge itself, so a
 * one-level `ED_spl(e)==NULL` check (the original port) wrongly reported it
 * missing and made `completeRegularPath` decline plain regular edges whose
 * bound siblings carry their spline on `to_orig` (wide fan-out/fan-in/merge).
 * @see lib/common/splines.c:getsplinepoints
 */
function boundSplineMissing(e: Edge): boolean {
  let le: Edge | undefined = e;
  while (le !== undefined) {
    if (le.info.spl !== undefined) return false;
    if ((le.info.edge_type ?? NORMAL) === NORMAL) return true;
    le = le.info.to_orig;
  }
  return true;
}

/** True if a bound edge exists but has no spline yet (C getsplinepoints==NULL). */
function boundMissing(e: Edge | undefined): boolean {
  return e !== undefined && boundSplineMissing(e);
}

/**
 * Order guard: every bounding edge must already be routed. C's top_bound /
 * bot_bound only return spline-bearing edges, so in practice this always
 * passes; ported for fidelity to completeregularpath's structure.
 * @see lib/dotgen/dotsplines.c:completeregularpath (getsplinepoints guards)
 */
function pathBoundsReady(first: Edge, last: Edge): boolean {
  return !boundMissing(topBound(first, -1)) && !boundMissing(topBound(first, 1))
    && !boundMissing(botBound(last, -1)) && !boundMissing(botBound(last, 1));
}

/** Grow rank boxes (even slots) / inter-rank boxes (odd) to a minimum width. */
function widenPathBoxes(P: Path, fb: number, lb: number): void {
  for (let i = fb - 1; i < lb + 1; i++) {
    const bp = P.boxes[i];
    const even = (i - fb) % 2 === 0;
    const tooNarrow = even ? bp.ll.x >= bp.ur.x : bp.ll.x + MINW > bp.ur.x;
    if (tooNarrow) {
      const x = (bp.ll.x + bp.ur.x) / 2;
      bp.ll.x = x - HALFMINW;
      bp.ur.x = x + HALFMINW;
    }
  }
}

/** Stretch the later box (bp2) to overlap bp1 by at least MINW. */
function growForward(bp1: Box, bp2: Box): void {
  if (bp1.ll.x + MINW > bp2.ur.x) bp2.ur.x = bp1.ll.x + MINW;
  if (bp1.ur.x - MINW < bp2.ll.x) bp2.ll.x = bp1.ur.x - MINW;
}

/** Stretch the earlier box (bp1) to overlap bp2 by at least MINW. */
function growBackward(bp1: Box, bp2: Box): void {
  if (bp1.ll.x + MINW > bp2.ur.x) bp1.ll.x = bp2.ur.x - MINW;
  if (bp1.ur.x - MINW < bp2.ll.x) bp1.ur.x = bp2.ll.x + MINW;
}

/** Guarantee an overlap of at least MINW between adjacent boxes. */
function overlapPathBoxes(P: Path, fb: number, lb: number): void {
  for (let i = 0; i + 1 < P.nbox; i++) {
    const bp1 = P.boxes[i];
    const bp2 = P.boxes[i + 1];
    if (i >= fb && i <= lb && (i - fb) % 2 === 0) growForward(bp1, bp2);
    else if (i + 1 >= fb && i < lb && (i + 1 - fb) % 2 === 0) growBackward(bp1, bp2);
  }
}

/**
 * Widen the assembled path so it is wide enough. fb/lb bracket the inter-rank
 * boxes; if fb > lb there are none (the adjacent-rank case — both loops are
 * no-ops).
 * @see lib/dotgen/dotsplines.c:adjustregularpath
 */
function adjustRegularPath(P: Path, fb: number, lb: number): void {
  widenPathBoxes(P, fb, lb);
  overlapPathBoxes(P, fb, lb);
}

/**
 * Concatenate tail boxes, inter-rank boxes (forward), and head boxes
 * (reversed) into P, then widen. Returns false if a bounding edge is unrouted.
 * @see lib/dotgen/dotsplines.c:completeregularpath
 */
export function completeRegularPath(parts: RegularPathParts): boolean {
  const { P, first, last, tend, hend, boxes } = parts;
  if (!pathBoundsReady(first, last)) return false;
  for (let i = 0; i < tend.boxn; i++) addBox(P, tend.boxes[i]);
  const fb = P.nbox + 1;
  const lb = fb + boxes.length - 3;
  for (let i = 0; i < boxes.length; i++) addBox(P, boxes[i]);
  for (let i = hend.boxn - 1; i >= 0; i--) addBox(P, hend.boxes[i]);
  adjustRegularPath(P, fb, lb);
  return true;
}

// ---------------------------------------------------------------------------
// adapter
// ---------------------------------------------------------------------------

/** A fresh path endpoint seeded with its node bounding box. */
export function freshEndp(nb: Box): PathendT {
  return { nb, np: { x: 0, y: 0 }, sidemask: 0, boxn: 0, boxes: [] };
}

/** beginPath/endPath args for a single non-merged regular edge. */
function pathArgs(P: Path, e: Edge, endp: PathendT, merge: boolean, ranksep: number) {
  return { P, e, et: REGULAREDGE, endp, merge, inEdges: [], outEdges: [], ranksep, pboxfn: null };
}

/**
 * Route a regular adjacent-rank edge through the faithful box-channel
 * pipeline. Returns spline control points in graphviz-internal (y-up)
 * coordinates, or null when the edge is not an adjacent-rank regular edge or
 * the path cannot be assembled. Does NOT clip or install — that is SR3.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (adjacent-rank, no virtual chain)
 */
export function routeRegularEdgeFaithful(g: Graph, e: Edge): Point[] | null {
  const ranks = g.info.rank;
  const r = e.tail.info.rank;
  if (ranks === undefined || r === undefined || e.head.info.rank !== r + 1) return null;
  const tn = e.tail;
  const hn = e.head;
  const ctx: BboxCtx = {
    g,
    sp: {
      leftBound: computeLeftBound(g),
      rightBound: computeRightBound(g),
      splinesep: Math.trunc((g.info.nodesep ?? 18) / 4),
    },
  };
  const ranksep = graphRanksep(g);
  const P: Path = { start: makePort(), end: makePort(), nbox: 0, boxes: [], data: null };

  const tend = freshEndp(maximalBbox(ctx, tn, undefined, e));
  beginPath(pathArgs(P, e, tend, splineMerge(tn), ranksep));
  appendRegularEnd(tend.nb, tend, BOTTOM, tn.info.coord.y - rankHt(ranks[r].ht1, tn.info.ht));

  const boxes: Box[] = [rankBox(ctx, r)];

  const hend = freshEndp(maximalBbox(ctx, hn, e, undefined));
  endPath(pathArgs(P, e, hend, splineMerge(hn), ranksep));
  appendRegularEnd(hend.nb, hend, TOP, hn.info.coord.y + rankHt(ranks[r + 1].ht2, hn.info.ht));

  if (!completeRegularPath({ P, first: e, last: e, tend, hend, boxes })) return null;
  return routeRegularByType(P, edgeType(g));
}
