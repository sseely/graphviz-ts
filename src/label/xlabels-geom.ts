// SPDX-License-Identifier: EPL-2.0
/**
 * Geometry helpers for xlabels: Hilbert code, rect conversions, AABB test.
 * Internal — consumed only by xlabels-intersect.ts and xlabels.ts.
 * @see lib/label/xlabels.c
 */

import { type Point } from '../model/geom.js';
import { type Rect, overlap } from './rectangle.js';
import { type ObjectT, type XLabelT } from './xlabels.js';
import { cround } from '../common/arith.js';

// ---------------------------------------------------------------------------
// Hilbert spatial-filling-curve code
// ---------------------------------------------------------------------------

/**
 * Compute Hilbert curve distance from origin to integer point (x,y) on an
 * order-n Hilbert curve.  Ported from hackersdelight.org (Henry S. Warren).
 *
 * All arithmetic is 32-bit unsigned:
 *   - `>>> 0`  coerces to Uint32 (correctly wraps -xi negation).
 *   - `>>>`    unsigned right shift replaces C `>>` on signed ints.
 *   - `& 0xFFFFFFFF` keeps intermediate values in 32-bit range.
 *
 * Precondition: 2^n >= max(px, py).
 * @see lib/label/xlabels.c:hd_hil_s_from_xy
 */
export function hdHilSFromXy(px: number, py: number, n: number): number {
  let x = px | 0;
  let y = py | 0;
  let s = 0;
  for (let i = n - 1; i >= 0; i--) {
    const xi = (x >> i) & 1;                    // signed >> preserves C semantics
    const yi = (y >> i) & 1;
    s = (4 * s + 2 * xi + (xi ^ yi)) >>> 0;
    const myi = (yi - 1) | 0;                   // 0 if yi=1, -1 if yi=0
    const mxi = ((-xi) | 0) & myi;             // 0 or -1
    x = (x ^ y) | 0;                            // line 1: x ^= y
    y = (y ^ (x & myi)) | 0;                    // line 2: y ^= (updated x) & myi
    x = (x ^ y) | 0;                            // line 3: x ^= (updated y)
    x = (x ^ mxi) | 0;                          // line 4: x ^= mxi
    y = (y ^ mxi) | 0;                          // line 5: y ^= mxi
  }
  return s;
}

// ---------------------------------------------------------------------------
// AABB intersection area
// ---------------------------------------------------------------------------

/**
 * Intersection area of two axis-aligned bounding boxes; 0 when disjoint.
 * @see lib/label/xlabels.c:aabbaabb
 */
export function aabbaabb(r: Rect, s: Rect): number {
  if (!overlap(r, s)) return 0;
  const iminx = Math.max(r.boundary[0], s.boundary[0]);
  const iminy = Math.max(r.boundary[1], s.boundary[1]);
  const imaxx = Math.min(r.boundary[2], s.boundary[2]);
  const imaxy = Math.min(r.boundary[3], s.boundary[3]);
  return (imaxx - iminx) * (imaxy - iminy);
}

// ---------------------------------------------------------------------------
// Rect constructors from objects / labels
// ---------------------------------------------------------------------------

/**
 * Build a Rect from object position + size.
 * @see lib/label/xlabels.c:objp2rect
 */
export function objp2rect(op: ObjectT): Rect {
  return {
    boundary: [
      // C round(): half away from zero; xlabel object positions live in the
      // layout frame and are freely negative. @see lib/label/xlabels.c:173-176
      cround(op.pos.x),
      cround(op.pos.y),
      cround(op.pos.x + op.sz.x),
      cround(op.pos.y + op.sz.y),
    ],
  };
}

/**
 * Build a Rect from the object's attached xlabel position + size.
 * @see lib/label/xlabels.c:objplp2rect
 */
export function objplp2rect(objp: ObjectT): Rect {
  const lp = objp.lbl as XLabelT;
  return {
    boundary: [
      // @see lib/label/xlabels.c:184-187 (round())
      cround(lp.pos.x),
      cround(lp.pos.y),
      cround(lp.pos.x + lp.sz.x),
      cround(lp.pos.y + lp.sz.y),
    ],
  };
}

/**
 * Build the bounding Rect enclosing all possible label positions for objp.
 * @see lib/label/xlabels.c:objplpmks
 */
export function objplpmks(objp: ObjectT): Rect {
  const p: Point = objp.lbl ? (objp.lbl as XLabelT).sz : { x: 0, y: 0 };
  return {
    boundary: [
      Math.floor(objp.pos.x - p.x),
      Math.floor(objp.pos.y - p.y),
      Math.ceil(objp.pos.x + objp.sz.x + p.x),
      Math.ceil(objp.pos.y + objp.sz.y + p.y),
    ],
  };
}

/**
 * True if size-zero object objp1 is enclosed within objp's label rectangle.
 * @see lib/label/xlabels.c:lblenclosing
 */
export function lblenclosing(objp: ObjectT, objp1: ObjectT): boolean {
  const xlp = objp.lbl as XLabelT | null;
  if (!xlp) return false;
  return (
    objp1.pos.x > xlp.pos.x &&
    objp1.pos.x < xlp.pos.x + xlp.sz.x &&
    objp1.pos.y > xlp.pos.y &&
    objp1.pos.y < xlp.pos.y + xlp.sz.y
  );
}
