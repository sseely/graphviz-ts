// SPDX-License-Identifier: EPL-2.0

/**
 * make_flat_labeled_edge — route a non-adjacent same-rank (flat) edge that
 * carries a center label, around the label virtual node created by flat_node
 * (flat.ts:flatNode, T1). Sets the label position and installs the spline.
 *
 * Split out of splines-flat.ts (which is at the file-size cap) and reuses its
 * makeFlatEndBox / flatBboxCtx / freshFlatPath helpers. Dispatched from the
 * live router (edge-route.ts:routeForwardEdge) — see decisions.md#ad-3.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_labeled_edge
 */

import type { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';
import type { Node } from '../../model/node.js';
import type { Box, Point } from '../../model/geom.js';
import { makeFlatEndBox, flatBboxCtx, freshFlatPath } from './splines-flat.js';
import { graphRanksep } from './position-aux.js';
import { addBox } from '../../common/splines-path-shared.js';
import { routeSplines, routePolylines } from '../../common/splines-routespl.js';
import { clipAndInstall } from '../../common/splines-clip.js';
import { buildDotSinfo } from './self-loop.js';
import { TOP } from '../../common/splines-constants.js';
import { edgeType, EDGETYPE_LINE, EDGETYPE_SPLINE, EDGETYPE_PLINE } from './splines.js';
import { shortestPath, routeSpline, polyBarriers, makePolyline } from '../../pathplan/index.js';

/** Space between stacked flat labels, in points. @see lib/dotgen/dotsplines.c:937 */
const LBL_SPACE = 6;

/**
 * Walk `ED_to_virt(e)` to the end of the chain; the tail of the last edge is the
 * label virtual node `ln`. @see lib/dotgen/dotsplines.c:make_flat_labeled_edge 1328-1330
 */
export function findLabelNode(e: Edge): Node | null {
  let f = e.info.to_virt;
  if (f === undefined) return null;
  while (f.info.to_virt !== undefined) f = f.info.to_virt;
  return f.tail;
}

/**
 * The label box `lb` straddling the label node, with the C `ydelta`/6 clamp.
 * @see lib/dotgen/dotsplines.c:make_flat_labeled_edge 1349-1355
 */
export function flatLabelBox(g: Graph, ln: Node, tn: Node): Box {
  const rk = g.info.rank![tn.info.rank!];
  const ydelta = (ln.info.coord.y - rk.ht1 - tn.info.coord.y + rk.ht2) / 6;
  const ury = ln.info.coord.y + ln.info.ht / 2;
  return {
    ll: { x: ln.info.coord.x - ln.info.lw, y: ury - Math.max(5, ydelta) },
    ur: { x: ln.info.coord.x + ln.info.rw, y: ury },
  };
}

/**
 * The three connector boxes between the tail end, label box, and head end.
 * @see lib/dotgen/dotsplines.c:make_flat_labeled_edge 1360-1393
 */
export function flatLabeledBoxes(tlast: Box, hlast: Box, lb: Box): Box[] {
  return [
    { ll: { x: tlast.ll.x, y: tlast.ur.y }, ur: { x: lb.ll.x, y: lb.ll.y } },
    { ll: { x: tlast.ll.x, y: lb.ll.y }, ur: { x: hlast.ur.x, y: lb.ur.y } },
    { ll: { x: lb.ur.x, y: hlast.ur.y }, ur: { x: hlast.ur.x, y: lb.ll.y } },
  ];
}

/**
 * EDGETYPE_LINE 7-point polyline: start, label (lowered by half label height),
 * end. @see lib/dotgen/dotsplines.c:make_flat_labeled_edge 1335-1347
 */
export function flatLabeledLinePoints(tn: Node, hn: Node, e: Edge): Point[] {
  const lbl = e.info.label!;
  const sx = tn.info.coord.x + e.info.tail_port.p.x;
  const sy = tn.info.coord.y + e.info.tail_port.p.y;
  const ex = hn.info.coord.x + e.info.head_port.p.x;
  const ey = hn.info.coord.y + e.info.head_port.p.y;
  const lx = lbl.pos.x;
  const ly = lbl.pos.y - lbl.dimen.y / 2;
  return [
    { x: sx, y: sy }, { x: sx, y: sy },
    { x: lx, y: ly }, { x: lx, y: ly }, { x: lx, y: ly },
    { x: ex, y: ey }, { x: ex, y: ey },
  ];
}

/**
 * Build the tail/label/head box channel and route a spline (or polyline)
 * through it. @see lib/dotgen/dotsplines.c:make_flat_labeled_edge 1349-1411
 */
export function routeFlatLabeledChannel(g: Graph, e: Edge, ln: Node, et: number): Point[] | null {
  const tn = e.tail, hn = e.head;
  const lb = flatLabelBox(g, ln, tn);
  const ctx = flatBboxCtx(g);
  const ranksep = graphRanksep(g);
  const P = freshFlatPath();
  const tend = makeFlatEndBox({ ctx, P, e, n: tn, side: TOP, ranksep, isBegin: true });
  const hend = makeFlatEndBox({ ctx, P, e, n: hn, side: TOP, ranksep, isBegin: false });
  const boxes = flatLabeledBoxes(tend.boxes[tend.boxn - 1], hend.boxes[hend.boxn - 1], lb);
  for (let i = 0; i < tend.boxn; i++) addBox(P, tend.boxes[i]);
  for (const b of boxes) addBox(P, b);
  for (let i = hend.boxn - 1; i >= 0; i--) addBox(P, hend.boxes[i]);
  return et === EDGETYPE_SPLINE ? routeSplines(P) : routePolylines(P);
}

/**
 * Decline unless `e` is a non-adjacent, same-rank, labeled flat edge with a
 * label vnode reachable via its to_virt chain; otherwise return that vnode.
 */
export function flatLabelTarget(e: Edge): Node | null {
  if (e.info.label === undefined || (e.info.adjacent ?? 0) !== 0) return null;
  if (e.tail.info.rank === undefined || e.tail.info.rank !== e.head.info.rank) return null;
  return findLabelNode(e);
}

/**
 * Route a non-adjacent labeled flat edge around its label vnode and install the
 * spline. Sets `ED_label(e).pos` / `.set` so the label `<text>` is emitted.
 * Returns false (declining) when `e` is not such an edge so the caller falls
 * back to its normal routing. @see lib/dotgen/dotsplines.c:make_flat_labeled_edge
 */
export function makeFlatLabeledEdge(g: Graph, e: Edge): boolean {
  const ln = flatLabelTarget(e);
  if (ln === null) return false;
  const lbl = e.info.label!;
  lbl.pos = { x: ln.info.coord.x, y: ln.info.coord.y };
  lbl.set = true;
  const et = edgeType(g);
  if (et === EDGETYPE_LINE) {
    const ps = flatLabeledLinePoints(e.tail, e.head, e);
    if (ps !== null && ps.length !== 0) clipAndInstall(e, e.head, ps, ps.length, buildDotSinfo());
    return true;
  }
  // C make_flat_edge forward-normalizes a backward (tail right of head by node
  // ORDER) flat edge via makefwdedge BEFORE make_flat_labeled_edge builds the
  // left→right channel — else the middle box inverts (LL.x > UR.x) and
  // routesplines returns no points. Build the channel on a left→right sample,
  // then reverse the points for an edge whose tail is the right node so they run
  // tail→head, and install with ignoreSwap (the orientation is already fixed).
  // @see lib/dotgen/dotsplines.c:make_flat_edge (makefwdedge), make_flat_labeled_edge
  const tailIsLeft = (e.tail.info.order ?? 0) <= (e.head.info.order ?? 0);
  const sample: Edge = tailIsLeft ? e : {
    ...e, tail: e.head, head: e.tail,
    info: { ...e.info, tail_port: e.info.head_port, head_port: e.info.tail_port },
  } as Edge;
  const ps = routeFlatLabeledChannel(g, sample, ln, et);
  // Degenerate route (routesplines pn=0): label set, no spline installed — C's
  // make_flat_labeled_edge returns the same way; emit's edge_in_box then decides
  // whether the (untranslated) label overlaps the clip. Still HANDLED → true.
  if (ps === null || ps.length === 0) return true;
  if (!tailIsLeft) ps.reverse();
  clipAndInstall(e, e.head, ps, ps.length, { ...buildDotSinfo(), ignoreSwap: true });
  return true;
}

/**
 * True when `e` is an adjacent, same-rank flat edge with no declared ports —
 * C's make_flat_adj_edges no-port dispatch (makeSimpleFlat / makeSimpleFlatLabels).
 * Port-bearing adjacent flats route via the rotated aux graph instead.
 */
export function isAdjFlatCandidate(e: Edge): boolean {
  if ((e.info.adjacent ?? 0) === 0) return false;
  if (e.tail.info.rank === undefined || e.tail.info.rank !== e.head.info.rank) return false;
  return !e.info.tail_port.defined && !e.info.head_port.defined;
}

/**
 * Parallel group: every no-port adjacent flat edge from e's tail to e's head.
 * Scans g.edges (not flat_out) — parallel siblings live in ND_other, only the
 * class representative is in flat_out. @see lib/dotgen/flat.c:flat_edges (ND_other)
 */
export function collectAdjFlatGroup(g: Graph, e: Edge): Edge[] {
  const out: Edge[] = [];
  for (const f of g.edges) {
    if (f.tail === e.tail && f.head === e.head && isAdjFlatCandidate(f)) out.push(f);
  }
  return out;
}

/** edgelblcmpfn: labeled first; among labeled, larger dimen (x then y) first. */
export function edgeLblCmp(a: Edge, b: Edge): number {
  const la = a.info.label, lb = b.info.label;
  if (la === undefined) return lb === undefined ? 0 : 1;
  if (lb === undefined) return -1;
  if (la.dimen.x !== lb.dimen.x) return la.dimen.x > lb.dimen.x ? -1 : 1;
  if (la.dimen.y !== lb.dimen.y) return la.dimen.y > lb.dimen.y ? -1 : 1;
  return 0;
}

/** Pshortestpath → (make_polyline | Proutespline) over an 8-point boundary poly.
 *  @see lib/common/routespl.c:simpleSplineRoute */
function simpleSplineRoute(tp: Point, hp: Point, polyPts: Point[], polyline: boolean): Point[] | null {
  const route = shortestPath({ ps: polyPts }, [tp, hp]);
  if (route === null) return null;
  if (polyline) return makePolyline(route);
  return routeSpline(polyBarriers([{ ps: polyPts }]), route, [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
}

/** Running bounds + fixed endpoints for the stacked flat-label boxes. */
interface FlatStack {
  miny: number; maxy: number; uminx: number; umaxx: number;
  lminx: number; lmaxx: number; leftend: number; rightend: number; ctrx: number;
  tp: Point; hp: Point;
}

/** Boundary poly for a flat edge routed BELOW the rank (i odd). @see dotsplines.c:1003-1010 */
function flatDownBox(tp: Point, hp: Point, miny: number, lminx: number, lmaxx: number): Point[] {
  return [
    { x: tp.x, y: tp.y }, { x: tp.x, y: miny - LBL_SPACE }, { x: hp.x, y: miny - LBL_SPACE },
    { x: hp.x, y: hp.y }, { x: lmaxx, y: hp.y }, { x: lmaxx, y: miny },
    { x: lminx, y: miny }, { x: lminx, y: tp.y },
  ];
}

/** Boundary poly for a flat edge routed ABOVE the rank (i even). @see dotsplines.c:1012-1020 */
function flatUpBox(tp: Point, hp: Point, maxy: number, uminx: number, umaxx: number): Point[] {
  return [
    { x: tp.x, y: tp.y }, { x: uminx, y: tp.y }, { x: uminx, y: maxy }, { x: umaxx, y: maxy },
    { x: umaxx, y: hp.y }, { x: hp.x, y: hp.y }, { x: hp.x, y: maxy + LBL_SPACE },
    { x: tp.x, y: maxy + LBL_SPACE },
  ];
}

/** Box + label-center for stacked edge i (down if odd, up if even); mutates bounds. */
function stackFlatBox(st: FlatStack, i: number, dim: Point, labeled: boolean): { box: Point[]; ctry: number } {
  if (i % 2 === 1) {
    if (i === 1 && labeled) { st.lminx = st.ctrx - dim.x / 2; st.lmaxx = st.ctrx + dim.x / 2; }
    if (i === 1 && !labeled) { st.lminx = (2 * st.leftend + st.rightend) / 3; st.lmaxx = (st.leftend + 2 * st.rightend) / 3; }
    st.miny -= LBL_SPACE + dim.y;
    return { box: flatDownBox(st.tp, st.hp, st.miny, st.lminx, st.lmaxx), ctry: st.miny + dim.y / 2 };
  }
  const box = flatUpBox(st.tp, st.hp, st.maxy, st.uminx, st.umaxx);
  const ctry = st.maxy + dim.y / 2 + LBL_SPACE;
  st.maxy += dim.y + LBL_SPACE;
  return { box, ctry };
}

/** Set an edge label position. */
function setFlatLabel(e: Edge, x: number, y: number): void {
  const lbl = e.info.label!;
  lbl.pos = { x, y };
  lbl.set = true;
}

/** Route the stacked (i>=1) edges of the group through simpleSplineRoute. */
function routeStackedFlats(earray: Edge[], nLbls: number, st: FlatStack, et: number): void {
  for (let i = 1; i < earray.length; i++) {
    const labeled = i < nLbls;
    const dim = labeled ? earray[i].info.label!.dimen : { x: 0, y: 0 };
    const { box, ctry } = stackFlatBox(st, i, dim, labeled);
    const ps = simpleSplineRoute(st.tp, st.hp, box, et === EDGETYPE_PLINE);
    if (ps === null || ps.length === 0) return;
    if (labeled) setFlatLabel(earray[i], st.ctrx, ctry);
    clipAndInstall(earray[i], earray[i].head, ps, ps.length, buildDotSinfo());
  }
}

/**
 * Route a parallel group of adjacent (no-port) flat edges: the first goes
 * straight with its label above; the rest stack up/down around the rank, each
 * routed via simpleSplineRoute. @see lib/dotgen/dotsplines.c:makeSimpleFlatLabels
 */
export function makeSimpleFlatLabels(group: Edge[], et: number): void {
  const earray = [...group].sort(edgeLblCmp);
  const e0 = earray[0], tn = e0.tail, hn = e0.head;
  const tp = { x: tn.info.coord.x + e0.info.tail_port.p.x, y: tn.info.coord.y + e0.info.tail_port.p.y };
  const hp = { x: hn.info.coord.x + e0.info.head_port.p.x, y: hn.info.coord.y + e0.info.head_port.p.y };
  const leftend = tp.x + tn.info.rw, rightend = hp.x - hn.info.lw;
  const ctrx = (leftend + rightend) / 2;
  const nLbls = earray.filter(e => e.info.label !== undefined).length;
  const dim0 = e0.info.label!.dimen;
  clipAndInstall(e0, hn, [tp, { ...tp }, hp, { ...hp }], 4, buildDotSinfo());
  setFlatLabel(e0, ctrx, tp.y + (dim0.y + LBL_SPACE) / 2);
  const st: FlatStack = {
    miny: tp.y + LBL_SPACE / 2, maxy: tp.y + LBL_SPACE / 2 + dim0.y,
    uminx: ctrx - dim0.x / 2, umaxx: ctrx + dim0.x / 2,
    lminx: 0, lmaxx: 0, leftend, rightend, ctrx, tp, hp,
  };
  routeStackedFlats(earray, nLbls, st, et);
}

/** Bezier (SPLINE/LINE) or polyline (PLINE) control points for one flat
 *  spindle edge at vertical height dy. @see dotsplines.c:makeSimpleFlat 1089-1106 */
function simpleFlatPoints(tp: Point, hp: Point, dy: number, et: number): Point[] {
  const a = (2 * tp.x + hp.x) / 3, b = (2 * hp.x + tp.x) / 3;
  if (et === EDGETYPE_SPLINE || et === EDGETYPE_LINE) {
    return [{ x: tp.x, y: tp.y }, { x: a, y: dy }, { x: b, y: dy }, { x: hp.x, y: hp.y }];
  }
  return [
    { x: tp.x, y: tp.y }, { x: tp.x, y: tp.y },
    { x: a, y: dy }, { x: a, y: dy }, { x: a, y: dy },
    { x: b, y: dy }, { x: b, y: dy }, { x: b, y: dy },
    { x: hp.x, y: hp.y }, { x: hp.x, y: hp.y },
  ];
}

/**
 * Spindle of splines for a no-port, no-label adjacent flat group: fan the cnt
 * edges vertically across the tail node's height (stepy = ht/(cnt-1), centred
 * on tp.y). cnt == 1 yields a single straight line.
 * @see lib/dotgen/dotsplines.c:makeSimpleFlat (1075)
 */
export function makeSimpleFlat(group: Edge[], et: number): void {
  const e0 = group[0], tn = e0.tail, hn = e0.head;
  const tp = { x: tn.info.coord.x + e0.info.tail_port.p.x, y: tn.info.coord.y + e0.info.tail_port.p.y };
  const hp = { x: hn.info.coord.x + e0.info.head_port.p.x, y: hn.info.coord.y + e0.info.head_port.p.y };
  const cnt = group.length;
  const stepy = cnt > 1 ? tn.info.ht / (cnt - 1) : 0;
  let dy = tp.y - (cnt > 1 ? tn.info.ht / 2 : 0);
  for (let i = 0; i < cnt; i++) {
    const pts = simpleFlatPoints(tp, hp, dy, et);
    dy += stepy;
    clipAndInstall(group[i], group[i].head, pts, pts.length, buildDotSinfo());
  }
}

/**
 * Dispatch an adjacent no-port flat edge group (C's `make_flat_adj_edges`
 * no-port branch): a group with any label routes via makeSimpleFlatLabels, a
 * group with none via makeSimpleFlat. Both route the whole parallel group at
 * once. Declines only when `e` is not a no-port adjacent flat.
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges 1156-1166
 */
export function makeAdjFlatNoPortEdge(g: Graph, e: Edge): boolean {
  if (!isAdjFlatCandidate(e)) return false;
  const group = collectAdjFlatGroup(g, e);
  const et = edgeType(g);
  if (group.some(x => x.info.label !== undefined)) makeSimpleFlatLabels(group, et);
  else makeSimpleFlat(group, et);
  return true;
}
