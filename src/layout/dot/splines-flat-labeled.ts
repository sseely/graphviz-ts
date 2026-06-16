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
import { edgeType, EDGETYPE_LINE, EDGETYPE_SPLINE } from './splines.js';

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
  const ps = et === EDGETYPE_LINE
    ? flatLabeledLinePoints(e.tail, e.head, e)
    : routeFlatLabeledChannel(g, e, ln, et);
  if (ps === null || ps.length === 0) return false;
  clipAndInstall(e, e.head, ps, ps.length, buildDotSinfo());
  return true;
}
