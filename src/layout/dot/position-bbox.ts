// SPDX-License-Identifier: EPL-2.0

/**
 * Bounding box computation, aspect ratio scaling, and set_aspect for dot.
 * @see lib/dotgen/position.c:dot_compute_bb, rec_bb, scale_bb, set_aspect
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { NORMAL } from './fastgr.js';
import { dotRoot } from './mincross-utils.js';
import {
  CL_OFFSET,
  graphMinrank, graphMaxrank, graphNclust,
  graphHt1, graphHt2, nodeRank,
} from './position-aux.js';

// ---------------------------------------------------------------------------
// dot_compute_bb helpers — @see lib/dotgen/position.c:dot_compute_bb
// ---------------------------------------------------------------------------

/** @internal — first NORMAL node in rank, scanning left to right */
export function firstNormalNode(rk: { v: Node[]; n: number }): Node | undefined {
  for (let c = 0; c < rk.n; c++) {
    if (rk.v[c].info.node_type === NORMAL) return rk.v[c];
  }
  return undefined;
}

/** @internal — last NORMAL node in rank, scanning right to left */
export function lastNormalNode(rk: { v: Node[]; n: number }): Node | undefined {
  for (let c = rk.n - 1; c >= 0; c--) {
    if (rk.v[c].info.node_type === NORMAL) return rk.v[c];
  }
  return undefined;
}

/** @internal — find x range of NORMAL nodes in one rank */
export function rankNormalXRange(rk: { v: Node[]; n: number }): [number, number] {
  const first = firstNormalNode(rk);
  if (!first) return [2147483647, -2147483647];
  const lx = first.info.coord.x - (first.info.lw ?? 0);
  const last = lastNormalNode(rk);
  const rx = last ? last.info.coord.x + (last.info.rw ?? 0) : -2147483647;
  return [lx, rx];
}

/** @see lib/dotgen/position.c:dot_compute_bb (root x-range scan) */
export function computeBbRootX(g: Graph): [number, number] {
  let llx = 2147483647;
  let urx = -2147483647;
  for (let r = graphMinrank(g); r <= graphMaxrank(g); r++) {
    const rk = g.info.rank![r];
    if (rk.n === 0) continue;
    const [lx, rx] = rankNormalXRange(rk);
    if (lx < llx) llx = lx;
    if (rx > urx) urx = rx;
  }
  const nClust = graphNclust(g);
  for (let c = 1; c <= nClust; c++) {
    const bb = g.info.clust![c - 1].info.bb;
    if (!bb) continue;
    llx = Math.min(llx, bb.ll.x - CL_OFFSET);
    urx = Math.max(urx, bb.ur.x + CL_OFFSET);
  }
  return [llx, urx];
}

/** @see lib/dotgen/position.c:dot_compute_bb */
export function dotComputeBb(g: Graph, root: Graph): void {
  const isRoot = g === root;
  let llx: number;
  let urx: number;
  if (isRoot) {
    [llx, urx] = computeBbRootX(g);
  } else {
    llx = nodeRank(g.info.ln!);
    urx = nodeRank(g.info.rn!);
  }
  const rankArr = root.info.rank!;
  const lly = rankArr[graphMaxrank(g)].v[0].info.coord.y - graphHt1(g);
  const ury = rankArr[graphMinrank(g)].v[0].info.coord.y + graphHt2(g);
  g.info.bb = { ll: { x: llx, y: lly }, ur: { x: urx, y: ury } };
}

/** @see lib/dotgen/position.c:rec_bb */
export function recBb(g: Graph, root: Graph): void {
  const nClust = graphNclust(g);
  for (let c = 1; c <= nClust; c++) recBb(g.info.clust![c - 1], root);
  dotComputeBb(g, root);
}

/** @see lib/dotgen/position.c:scale_bb */
export function scaleBb(g: Graph, xf: number, yf: number): void {
  const nClust = graphNclust(g);
  for (let c = 1; c <= nClust; c++) scaleBb(g.info.clust![c - 1], xf, yf);
  if (!g.info.bb) return;
  g.info.bb.ll.x *= xf; g.info.bb.ll.y *= yf;
  g.info.bb.ur.x *= xf; g.info.bb.ur.y *= yf;
}

// ---------------------------------------------------------------------------
// set_aspect helpers — @see lib/dotgen/position.c:set_aspect
// ---------------------------------------------------------------------------

type SzPoint = { x: number; y: number };
type DrawingPartial = { size: SzPoint; ratioKind: string; ratio?: number };

/** @internal — fill ratio scale factors */
export function aspectFillScale(d: DrawingPartial, sz: SzPoint): [number, number] | null {
  if (d.size.x <= 0) return null;
  let xf = d.size.x / sz.x;
  let yf = d.size.y / sz.y;
  if (xf < 1.0 || yf < 1.0) {
    if (xf < yf) { yf /= xf; xf = 1.0; } else { xf /= yf; yf = 1.0; }
  }
  return [xf, yf];
}

/** @internal — expand ratio scale factors */
export function aspectExpandScale(d: DrawingPartial, g: Graph): [number, number] | null {
  if (d.size.x <= 0) return null;
  const bb = g.info.bb!;
  const xf = d.size.x / bb.ur.x;
  const yf = d.size.y / bb.ur.y;
  if (xf > 1.0 && yf > 1.0) { const s = Math.min(xf, yf); return [s, s]; }
  return null;
}

/** @internal — fixed ratio scale factors */
export function aspectValueScale(d: DrawingPartial, sz: SzPoint): [number, number] {
  const desired = d.ratio ?? 1;
  const actual = sz.y / sz.x;
  if (actual < desired) return [1.0, desired / actual];
  return [actual / desired, 1.0];
}

/** @see lib/dotgen/position.c:set_aspect (choose scale factors for ratio mode) */
export function aspectScaleFactors(g: Graph, sz: SzPoint): [number, number] | null {
  const d = g.info.drawing;
  if (!d || !d.ratioKind || d.ratioKind === 'none') return null;
  if (d.ratioKind === 'fill') return aspectFillScale(d, sz);
  if (d.ratioKind === 'expand') return aspectExpandScale(d, g);
  if (d.ratioKind === 'value') return aspectValueScale(d, sz);
  return null;
}

/** @see lib/dotgen/position.c:set_aspect */
export function setAspect(g: Graph): void {
  recBb(g, g);
  const drawing = g.info.drawing;
  if (graphMaxrank(g) <= 0 || !drawing?.ratioKind) return;
  const bb = g.info.bb!;
  let sz: SzPoint = { x: bb.ur.x - bb.ll.x, y: bb.ur.y - bb.ll.y };
  if (g.info.flip) sz = { x: sz.y, y: sz.x };
  let factors = aspectScaleFactors(g, sz);
  if (!factors) return;
  if (g.info.flip) factors = [factors[1], factors[0]];
  const [xf, yf] = factors;
  for (let n = g.info.nlist; n !== undefined; n = n.info.next) {
    n.info.coord.x = Math.round(n.info.coord.x * xf);
    n.info.coord.y = Math.round(n.info.coord.y * yf);
  }
  scaleBb(g, xf, yf);
}

/** @internal — get dot root for use in bbox computations */
export { dotRoot };
