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
import { arrowClipLength } from '../layout/dot/edge-route-clip.js';
import {
  arrowDrawOpsForEnd, edgeArrowName, edgeArrowsize,
} from '../layout/dot/edge-route-arrow.js';
import { resolvePenWidth, parseStyleFlags } from './style-resolve.js';

/** Normal (filled triangle) arrowhead. @see lib/common/const.h:ARR_TYPE_NORM */
export const ARR_NORM = 1;

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

  /**
   * Arrow flags from graph directedness, the dir attribute, and the
   * arrowhead/arrowtail attributes. Only "normal" and "none" arrow
   * type names are ported (other types — diamond, tee, crow, ... —
   * are unused by the supported inputs and fall back to normal).
   * When `conc_opp_flag` is set (a concentrate=true merge of an
   * anti-parallel pair), the opposing edge's arrowhead is OR'd in so the
   * surviving edge draws an arrowhead at both ends.
   * @see lib/common/arrows.c:arrow_flags
   */
  static arrowFlags(e: Edge): [number, number] {
    let sflag = ARR_NONE;
    let eflag = e.tail.root.kind.includes('undirected') ? ARR_NONE : ARR_NORM;
    const dir = e.attrs.get('dir');
    if (dir === 'forward') { sflag = ARR_NONE; eflag = ARR_NORM; }
    else if (dir === 'back') { sflag = ARR_NORM; eflag = ARR_NONE; }
    else if (dir === 'both') { sflag = ARR_NORM; eflag = ARR_NORM; }
    else if (dir === 'none') { sflag = ARR_NONE; eflag = ARR_NONE; }
    if (eflag === ARR_NORM && e.attrs.get('arrowhead') === 'none') eflag = ARR_NONE;
    if (sflag === ARR_NORM && e.attrs.get('arrowtail') === 'none') sflag = ARR_NONE;
    // conc_opp_flag: pick up the opposing (original B->A) edge's arrowhead.
    // agfindedge(agraphof(aghead(e)), aghead(e), agtail(e)) → first out-edge
    // of e.head back to e.tail. @see lib/common/arrows.c:arrow_flags
    if (e.info.conc_opp_flag) {
      const f = e.head.outEdges(e.head.root).find(x => x.head === e.tail);
      if (f) {
        const [s0, e0] = SplineClipHelper.arrowFlags(f);
        eflag |= s0;
        sflag |= e0;
      }
    }
    return [sflag, eflag];
  }

  static resolveArrowFlags(info: SplineInfo, hn: Node, fe: Edge, orig: Edge, j: boolean): [number, number] {
    let [sflag, eflag] = SplineClipHelper.arrowFlags(orig);
    if (info.splineMerge != null) {
      if (info.splineMerge(hn)) eflag = ARR_NONE;
      if (info.splineMerge(fe.tail)) sflag = ARR_NONE;
    }
    if (j) return [eflag, sflag];
    return [sflag, eflag];
  }

  /** DIST(p, q). */
  static dist(p: Point, q: Point): number {
    return Math.hypot(p.x - q.x, p.y - q.y);
  }

  /** Sphere inside-fn around `tip` with radius `r` for bezierClip. */
  static sphereCtx(tip: Point, r: number): {
    ctx: InsideContext;
    fn: (c: InsideContext, p: Point) => boolean;
  } {
    return {
      ctx: { nodeCoord: { x: 0, y: 0 }, rw: 0, bp: null },
      fn: (_c: InsideContext, p: Point) => SplineClipHelper.dist(p, tip) <= r,
    };
  }

  /**
   * Clip the spline end to the head arrowhead base; records the tip in
   * spl.ep. @see lib/common/arrows.c:arrowEndClip
   */
  static arrowEndClip(
    e: Edge, ps: Point[], startp: number, endpIn: number, spl: Bezier, eflag: number,
  ): number {
    let endp = endpIn;
    const elen = arrowClipLength(edgeArrowName(e, 'head'), edgeArrowsize(e), SplineClipHelper.edgePenwidth(e));
    spl.eflag = eflag;
    spl.ep = ps[endp + 3]!;
    if (endp > startp && SplineClipHelper.dist(ps[endp]!, ps[endp + 3]!) < elen) {
      endp -= 3;
    }
    const sp: Point[] = [spl.ep, ps[endp + 2]!, ps[endp + 1]!, ps[endp]!];
    if (elen > 0) {
      const { ctx, fn } = SplineClipHelper.sphereCtx(spl.ep, elen);
      bezierClip(ctx, fn, sp, true);
    }
    ps[endp] = sp[3]!;
    ps[endp + 1] = sp[2]!;
    ps[endp + 2] = sp[1]!;
    ps[endp + 3] = sp[0]!;
    return endp;
  }

  /**
   * Clip the spline start to the tail arrowhead base; records the tip
   * in spl.sp. @see lib/common/arrows.c:arrowStartClip
   */
  static arrowStartClip(
    e: Edge, ps: Point[], startpIn: number, endp: number, spl: Bezier, sflag: number,
  ): number {
    let startp = startpIn;
    const slen = arrowClipLength(edgeArrowName(e, 'tail'), edgeArrowsize(e), SplineClipHelper.edgePenwidth(e));
    spl.sflag = sflag;
    spl.sp = ps[startp]!;
    if (endp > startp && SplineClipHelper.dist(ps[startp]!, ps[startp + 3]!) < slen) {
      startp += 3;
    }
    const sp: Point[] = [ps[startp + 3]!, ps[startp + 2]!, ps[startp + 1]!, spl.sp];
    if (slen > 0) {
      const { ctx, fn } = SplineClipHelper.sphereCtx(spl.sp, slen);
      bezierClip(ctx, fn, sp, false);
    }
    ps[startp] = sp[3]!;
    ps[startp + 1] = sp[2]!;
    ps[startp + 2] = sp[1]!;
    ps[startp + 3] = sp[0]!;
    return startp;
  }

  /** Edge penwidth attr with C default (drives arrow LENGTH / spline shorten). */
  static edgePenwidth(e: Edge): number {
    const v = parseFloat(e.attrs.get('penwidth') ?? '');
    return Number.isNaN(v) ? 1.0 : v;
  }

  /**
   * Rendered edge penwidth (style-aware). Drives the arrow POLYGON geometry (the
   * penwidth-dependent miter delta in arrow_type_normal0), so it must match the
   * drawn stroke width: penwidth attr → setlinewidth(N) style → bold(2.0) → 1.0.
   * The prior version recognised only `style === "bold"`, so `setlinewidth(3)`
   * fell through to 1.0 and the arrow polygon sat ~penwidth off (graphs-style).
   * @see resolvePenWidth (style-resolve.ts) / lib/common/arrows.c:257
   */
  static renderPenwidth(e: Edge): number {
    return resolvePenWidth(parseStyleFlags(e.attrs.get('style')), e.attrs.get('penwidth'));
  }

  /**
   * Arrowhead clipping: resolve flags, shorten the spline at each
   * flagged end, and stash the arrow polygons for the renderer
   * (the TS equivalent of emit.c's arrow_gen pass).
   * @see lib/common/splines.c:arrow_clip
   */
  static arrowClip(
    fe: Edge, hn: Node, ps: Point[],
    bounds: { start: number; end: number }, newspl: Bezier, info: SplineInfo,
  ): void {
    let orig = fe;
    while (orig.info.to_orig != null) orig = orig.info.to_orig;
    const j = SplineClipHelper.resolveSwap(info, orig);
    const [sflag, eflag] = SplineClipHelper.resolveArrowFlags(info, hn, fe, orig, j);
    newspl.sflag = sflag;
    newspl.eflag = eflag;
    // C: ortho edges use arrowOrthoClip (keeps segments axis-aligned), not the
    // De-Casteljau start/end clips. @see lib/common/splines.c:90
    if (info.isOrtho) {
      if (sflag || eflag) {
        SplineClipHelper.arrowOrthoClip(
          orig, ps, bounds.start, bounds.end, newspl, sflag, eflag);
        if (sflag) SplineClipHelper.stashArrow(orig, newspl.sp, ps[bounds.start]!, true);
        if (eflag) SplineClipHelper.stashArrow(orig, newspl.ep, ps[bounds.end + 3]!, false);
      }
      return;
    }
    if (sflag) {
      bounds.start = SplineClipHelper.arrowStartClip(
        orig, ps, bounds.start, bounds.end, newspl, sflag);
      SplineClipHelper.stashArrow(orig, newspl.sp, ps[bounds.start]!, true);
    }
    if (eflag) {
      bounds.end = SplineClipHelper.arrowEndClip(
        orig, ps, bounds.start, bounds.end, newspl, eflag);
      SplineClipHelper.stashArrow(orig, newspl.ep, ps[bounds.end + 3]!, false);
    }
  }

  /**
   * Orthogonal arrow clip: each spline segment is axis-aligned, so shorten the
   * arrowed end(s) ALONG the axis and rewrite the segment's control points to
   * the degenerate straight form (P0=P1, P2=P3) — keeping the Bézier
   * axis-aligned, exactly as native C (vs the De-Casteljau resample the normal
   * arrow clip would produce). @see lib/common/arrows.c:arrowOrthoClip
   */
  static arrowOrthoClip(
    e: Edge, ps: Point[], startp: number, endp: number, spl: Bezier,
    sflag: number, eflag: number,
  ): void {
    const pwAttr = SplineClipHelper.edgePenwidth(e);
    const size = edgeArrowsize(e);
    const hlen0 = arrowClipLength(edgeArrowName(e, 'head'), size, pwAttr);
    const tlen0 = arrowClipLength(edgeArrowName(e, 'tail'), size, pwAttr);
    if (sflag && eflag && endp === startp) {
      // two arrows on one segment
      const p = ps[endp]!; const q = ps[endp + 3]!;
      const d = SplineClipHelper.dist(p, q);
      let hlen = hlen0; let tlen = tlen0;
      if (hlen + tlen >= d) { hlen = tlen = d / 3.0; }
      const s = { x: p.x, y: p.y }; const t = { x: q.x, y: q.y };
      if (p.y === q.y) {
        s.y = p.y; t.y = p.y;
        if (p.x < q.x) { t.x = q.x - hlen; s.x = p.x + tlen; }
        else { t.x = q.x + hlen; s.x = p.x - tlen; }
      } else {
        s.x = p.x; t.x = p.x;
        if (p.y < q.y) { t.y = q.y - hlen; s.y = p.y + tlen; }
        else { t.y = q.y + hlen; s.y = p.y - tlen; }
      }
      ps[endp] = s; ps[endp + 1] = { ...s };
      ps[endp + 2] = t; ps[endp + 3] = { ...t };
      spl.sflag = sflag; spl.sp = p;
      spl.eflag = eflag; spl.ep = q;
      return;
    }
    if (eflag) {
      let hlen = hlen0;
      const p = ps[endp]!; const q = ps[endp + 3]!;
      const maxd = 0.9 * SplineClipHelper.dist(p, q);
      if (hlen >= maxd) hlen = maxd;
      const r = { x: p.x, y: p.y };
      if (p.y === q.y) { r.y = p.y; r.x = p.x < q.x ? q.x - hlen : q.x + hlen; }
      else { r.x = p.x; r.y = p.y < q.y ? q.y - hlen : q.y + hlen; }
      ps[endp + 1] = { ...p }; ps[endp + 2] = r; ps[endp + 3] = { ...r };
      spl.eflag = eflag; spl.ep = q;
    }
    if (sflag) {
      let tlen = tlen0;
      const p = ps[startp]!; const q = ps[startp + 3]!;
      const maxd = 0.9 * SplineClipHelper.dist(p, q);
      if (tlen >= maxd) tlen = maxd;
      const r = { x: p.x, y: p.y };
      if (p.y === q.y) { r.y = p.y; r.x = p.x < q.x ? p.x + tlen : p.x - tlen; }
      else { r.x = p.x; r.y = p.y < q.y ? p.y + tlen : p.y - tlen; }
      ps[startp] = r; ps[startp + 1] = { ...r }; ps[startp + 2] = { ...q };
      spl.sflag = sflag; spl.sp = p;
    }
  }

  /** Record an arrow polygon on the edge for svgArrowPolygons. */
  static stashArrow(e: Edge, tip: Point, base: Point, isTail: boolean): void {
    const dir = { x: base.x - tip.x, y: base.y - tip.y };
    const ops = arrowDrawOpsForEnd(e, isTail ? 'tail' : 'head', tip, dir, SplineClipHelper.renderPenwidth(e));
    if (isTail) e.info.tailArrowOps = ops;
    else e.info.headArrowOps = ops;
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
  // C: graph_t *const g = agraphof(agtail(fe)); — get root graph from tail node.
  const g = fe.tail.root;
  const newspl = newSpline(fe, pn);
  const orig = SplineClipHelper.resolveOrig(fe);
  const { clipTail, clipHead, tbox, hbox } = SplineClipHelper.getPortConfig(fe, orig);
  const [effTn, effHn] = SplineClipHelper.resolveEndpoints(fe, hn, info);
  const rawStart = SplineClipHelper.findStart(clipTail, effTn, tbox, ps, pn);
  const rawEnd = SplineClipHelper.findEnd(clipHead, effHn, hbox, ps, pn);
  const bounds = {
    start: SplineClipHelper.trimStart(ps, pn, rawStart),
    end: SplineClipHelper.trimEnd(ps, rawEnd),
  };
  SplineClipHelper.arrowClip(fe, hn, ps, bounds, newspl, info);
  // C: update_bb_bz(&GD_bb(g), cp) — expand g's bb by each installed bezier.
  SplineClipHelper.copyToBezier(newspl, ps, bounds.start, bounds.end, g.info.bb);
}
