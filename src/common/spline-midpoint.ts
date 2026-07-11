// SPDX-License-Identifier: EPL-2.0

/**
 * Edge spline midpoint computation helpers, split from xlabels-place.ts.
 *
 * @see lib/common/splines.c:edgeMidpoint
 * @see lib/common/utils.c:dotneato_closest
 * @see lib/common/splines.c:polylineMidpoint
 */

import type { Point } from '../model/geom.js';
import { fma } from './fma.js';

type BezLike = { list: Point[]; sflag: number; eflag: number; sp: Point; ep: Point; size?: number };
export type SplLike = { list: BezLike[] };

export function dist2(p: Point, q: Point): number {
  const dx = p.x - q.x; const dy = p.y - q.y;
  return dx * dx + dy * dy;
}

function distPt(p: Point, q: Point): number { return Math.sqrt(dist2(p, q)); }

function evalBez4(pts: Point[], t: number): Point {
  const u = 1 - t;
  const [p0, p1, p2, p3] = pts;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
}

/** @see lib/common/utils.c:dotneato_closest */
export function dotneatoClosest(spl: SplLike, pt: Point): Point {
  let besti = 0; let bestj = -1; let bestd2 = Number.MAX_VALUE;
  for (let i = 0; i < spl.list.length; i++) {
    const bz = spl.list[i];
    // C scans bz.size points — Bezier.list is over-allocated (calloc) and the
    // zeroed tail beyond size must not win the closest-point scan (points at
    // the origin skew the chosen segment; corpus decorate/1367 attachments).
    // @see lib/common/utils.c:dotneato_closest
    const n = bz.size ?? bz.list.length;
    for (let j = 0; j < n; j++) {
      const d2 = dist2(bz.list[j], pt);
      if (bestj === -1 || d2 < bestd2) { besti = i; bestj = j; bestd2 = d2; }
    }
  }
  const bz = spl.list[besti];
  const bzn = bz.size ?? bz.list.length;
  let j = bestj === bzn - 1 ? bestj - 1 : bestj;
  j = 3 * Math.floor(j / 3);
  const c = [bz.list[j], bz.list[j + 1], bz.list[j + 2], bz.list[j + 3]];
  let lo = 0.0; let hi = 1.0;
  let dlo2 = dist2(c[0], pt); let dhi2 = dist2(c[3], pt);
  let pt2 = c[0];
  for (;;) {
    const t = (lo + hi) / 2.0;
    pt2 = evalBez4(c, t);
    if (Math.abs(dlo2 - dhi2) < 1.0 || Math.abs(hi - lo) < 0.00001) break;
    if (dlo2 < dhi2) { hi = t; dhi2 = dist2(pt2, pt); }
    else { lo = t; dlo2 = dist2(pt2, pt); }
  }
  return pt2;
}

/** @see lib/common/splines.c:polylineMidpoint */
export function polylineMidpoint(spl: SplLike): Point {
  let total = 0;
  for (const bz of spl.list) {
    for (let j = 0, k = 3; k < bz.list.length; j += 3, k += 3)
      total += distPt(bz.list[j], bz.list[k]);
  }
  total /= 2;
  for (const bz of spl.list) {
    for (let j = 0, k = 3; k < bz.list.length; j += 3, k += 3) {
      const pf = bz.list[j]; const qf = bz.list[k];
      const d = distPt(pf, qf);
      if (d >= total) {
        // C compiles `(qf.x*dist + pf.x*(d-dist))/d` under -ffp-contract, fusing
        // the first product `qf.x*dist` into an fmadd (single rounding on the
        // multiply-add). The plain IEEE two-rounding form drifts 1 ULP, which on
        // the states/twopi family tips the empty->stolen ('dispatch') label's
        // side-selection knife-edge. Bit-level A/B against the native oracle
        // confirmed fma(qf,dist,pf*(d-dist)) reproduces all five edge anchors
        // exactly (plain matched only 3/5). @see lib/common/splines.c:1271
        return {
          x: fma(qf.x, total, pf.x * (d - total)) / d,
          y: fma(qf.y, total, pf.y * (d - total)) / d,
        };
      }
      total -= d;
    }
  }
  const first = spl.list[0];
  return first.sflag ? first.sp : first.list[0];
}

/** @see lib/common/splines.c:endPoints */
export function splEndPoints(spl: SplLike): { p: Point; q: Point } {
  const first = spl.list[0];
  const p = first.sflag ? first.sp : first.list[0];
  const last = spl.list[spl.list.length - 1];
  const q = last.eflag ? last.ep : last.list[last.list.length - 1];
  return { p, q };
}
