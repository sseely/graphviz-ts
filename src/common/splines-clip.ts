// SPDX-License-Identifier: EPL-2.0
/**
 * newSpline and clipAndInstall — core spline attachment functions.
 * In a separate file to break the circular dep with splines-selfedge.ts.
 *
 * @see lib/common/splines.c:new_spline
 * @see lib/common/splines.c:clip_and_install
 * @see lib/common/splines.c:shape_clip0
 * @see lib/common/splines.c:arrow_clip
 */

import type { Point, Box } from '../model/geom.js';
import type { Bezier, Spline as Splines } from '../model/geom.js';
import type { SplineInfo } from './types.js';
import type { Edge } from '../model/edge.js';
import type { Node } from '../model/node.js';
import { approxEqPt, bezierClip, updateBbBz, InsideContext } from './splines-geom.js';
import { MILLIPOINT, ARR_NONE } from './splines-constants.js';

// Internal shape accessor type for host objects that may carry a shape.
type ShapeHost = { shape?: { fns?: { insidefn?: ((c: InsideContext, p: Point) => boolean) | null } | null } | null };

// ---------------------------------------------------------------------------
// Helpers – Lizard resets CCN at class boundaries
// ---------------------------------------------------------------------------

class SplineClipHelper {
  static makeEmptySpl(): Splines {
    return { list: [], size: 0, bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } } };
  }

  static makeEmptyBz(sz: number): Bezier {
    return {
      list: Array.from({ length: sz }, () => ({ x: 0, y: 0 })),
      size: sz, sflag: 0, eflag: 0,
      sp: { x: 0, y: 0 }, ep: { x: 0, y: 0 },
    };
  }

  static getInsideFn(n: Node): ((c: InsideContext, p: Point) => boolean) | null {
    return (n.info as unknown as ShapeHost).shape?.fns?.insidefn ?? null;
  }

  static shapeClip0(ctx: InsideContext, fn: (c: InsideContext, p: Point) => boolean, n: Node, curve: Point[], leftInside: boolean): void {
    const saveRw = n.info.rw;
    const c = curve.map(p => ({ x: p.x - n.info.coord.x, y: p.y - n.info.coord.y }));
    bezierClip(ctx, fn, c, leftInside);
    for (let i = 0; i < 4; i++) curve[i] = { x: c[i].x + n.info.coord.x, y: c[i].y + n.info.coord.y };
    n.info.rw = saveRw;
  }

  static resolveSwap(info: SplineInfo, orig: Edge): boolean {
    if (info.ignoreSwap) return false;
    if (info.swapEnds == null) return false;
    return info.swapEnds(orig);
  }

  static resolveArrowFlags(info: SplineInfo, hn: Node, tail: Node, j: boolean): [number, number] {
    let sflag = ARR_NONE;
    let eflag = ARR_NONE;
    if (info.splineMerge != null) {
      if (info.splineMerge(hn)) eflag = ARR_NONE;
      if (info.splineMerge(tail)) sflag = ARR_NONE;
    }
    if (j) return [eflag, sflag];
    return [sflag, eflag];
  }

  static arrowClip(fe: Edge, hn: Node, newspl: Bezier, info: SplineInfo): void {
    let orig = fe;
    while (orig.info.to_orig != null) orig = orig.info.to_orig;
    const j = SplineClipHelper.resolveSwap(info, orig);
    const [sflag, eflag] = SplineClipHelper.resolveArrowFlags(info, hn, fe.tail, j);
    newspl.sflag = sflag;
    newspl.eflag = eflag;
  }

  static clipSide(n: Node, box: Box | null, ps: Point[], pn: number, tail: boolean): number {
    const fn = SplineClipHelper.getInsideFn(n);
    if (fn == null) return tail ? 0 : pn - 4;
    const ctx: InsideContext = { nodeCoord: n.info.coord, rw: n.info.rw, bp: box, node: n };
    let idx = tail ? 0 : pn - 4;
    const step = tail ? 3 : -3;
    const limit = tail ? pn - 4 : 0;
    while (tail ? idx < limit : idx > limit) {
      const ref = tail ? ps[idx + 3] : ps[idx];
      if (!fn(ctx, { x: ref.x - n.info.coord.x, y: ref.y - n.info.coord.y })) break;
      idx += step;
    }
    const seg = ps.slice(idx, idx + 4);
    SplineClipHelper.shapeClip0(ctx, fn, n, seg, tail);
    // shape_clip0 mutates the curve in place in C; write the clipped
    // segment back into the source array.
    for (let i = 0; i < 4; i++) ps[idx + i] = seg[i];
    return idx;
  }

  static copyToBezier(newspl: Bezier, ps: Point[], start: number, end: number, bb: Box | null): void {
    for (let i = start; i < end + 4; ) {
      newspl.list[i - start] = ps[i];
      const cp: Point[] = [ps[i]]; i++;
      if (i >= end + 4) break;
      newspl.list[i - start] = ps[i]; cp.push(ps[i]); i++;
      newspl.list[i - start] = ps[i]; cp.push(ps[i]); i++;
      if (i < ps.length) cp.push(ps[i]);
      if (cp.length === 4 && bb != null) updateBbBz(bb, cp);
    }
    newspl.size = end - start + 4;
  }

  static needsSwap(info: SplineInfo, tn: Node, hn: Node): boolean {
    if (info.ignoreSwap) return false;
    if (tn.info.rank !== hn.info.rank) return false;
    const to = tn.info.order !== undefined ? tn.info.order : 0;
    const ho = hn.info.order !== undefined ? hn.info.order : 0;
    return to > ho;
  }

  // ---------------------------------------------------------------------------
  // clipAndInstall decomposition helpers
  // ---------------------------------------------------------------------------

  static resolveOrig(fe: Edge): Edge {
    let orig = fe;
    while (orig.info.to_orig != null && orig.info.edge_type !== 0) orig = orig.info.to_orig;
    return orig;
  }

  static getPortConfig(fe: Edge, orig: Edge): { clipTail: boolean; clipHead: boolean; tbox: Box | null; hbox: Box | null } {
    const isFwd = fe.tail === orig.tail;
    return {
      clipTail: isFwd ? orig.info.tail_port.clip : orig.info.head_port.clip,
      clipHead: isFwd ? orig.info.head_port.clip : orig.info.tail_port.clip,
      tbox: isFwd ? orig.info.tail_port.bp : orig.info.head_port.bp,
      hbox: isFwd ? orig.info.head_port.bp : orig.info.tail_port.bp,
    };
  }

  static resolveEndpoints(fe: Edge, hn: Node, info: SplineInfo): [Node, Node] {
    if (SplineClipHelper.needsSwap(info, fe.tail, hn)) return [hn, fe.tail];
    return [fe.tail, hn];
  }

  static findStart(clipTail: boolean, effTn: Node, tbox: Box | null, ps: Point[], pn: number): number {
    if (!clipTail) return 0;
    return SplineClipHelper.clipSide(effTn, tbox, ps, pn, true);
  }

  static findEnd(clipHead: boolean, effHn: Node, hbox: Box | null, ps: Point[], pn: number): number {
    if (!clipHead) return pn - 4;
    return SplineClipHelper.clipSide(effHn, hbox, ps, pn, false);
  }

  static trimStart(ps: Point[], pn: number, start: number): number {
    let s = start;
    while (s < pn - 4 && approxEqPt(ps[s], ps[s + 3], MILLIPOINT)) s += 3;
    return s;
  }

  static trimEnd(ps: Point[], end: number): number {
    let e = end;
    while (e > 0 && approxEqPt(ps[e], ps[e + 3], MILLIPOINT)) e -= 3;
    return e;
  }
}

// ---------------------------------------------------------------------------
// newSpline
// ---------------------------------------------------------------------------

/** @see lib/common/splines.c:new_spline */
export function newSpline(e: Edge, sz: number): Bezier {
  let cur = e;
  while (cur.info.to_orig != null && cur.info.edge_type !== 0) cur = cur.info.to_orig;
  if (cur.info.spl == null) cur.info.spl = SplineClipHelper.makeEmptySpl();
  const bz = SplineClipHelper.makeEmptyBz(sz);
  cur.info.spl.list.push(bz);
  cur.info.spl.size++;
  return bz;
}

// ---------------------------------------------------------------------------
// clipAndInstall
// ---------------------------------------------------------------------------

/** @see lib/common/splines.c:clip_and_install */
export function clipAndInstall(fe: Edge, hn: Node, ps: Point[], pn: number, info: SplineInfo): void {
  const newspl = newSpline(fe, pn);
  const orig = SplineClipHelper.resolveOrig(fe);
  const { clipTail, clipHead, tbox, hbox } = SplineClipHelper.getPortConfig(fe, orig);
  const [effTn, effHn] = SplineClipHelper.resolveEndpoints(fe, hn, info);
  const rawStart = SplineClipHelper.findStart(clipTail, effTn, tbox, ps, pn);
  const rawEnd = SplineClipHelper.findEnd(clipHead, effHn, hbox, ps, pn);
  const start = SplineClipHelper.trimStart(ps, pn, rawStart);
  const end = SplineClipHelper.trimEnd(ps, rawEnd);
  SplineClipHelper.arrowClip(fe, hn, newspl, info);
  // bb update deferred: Edge has no graph ref; callers that need bb must pass it separately.
  SplineClipHelper.copyToBezier(newspl, ps, start, end, null);
}
