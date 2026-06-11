// SPDX-License-Identifier: EPL-2.0

/**
 * R-tree rectangle primitives.
 * @see label/rectangle.h
 * @see label/rectangle.c
 * @see label/index.h
 */

/** @see label/index.h:NUMDIMS */
export const NUMDIMS = 2;

/** @see label/index.h:NUMSIDES (2*NUMDIMS) */
export const NUMSIDES = 2 * NUMDIMS;

/**
 * Flat boundary array: [lowX, lowY, highX, highY].
 * Indexed via CX/CY/NX/NY helpers matching the C macros.
 * @see label/rectangle.h:Rect_t
 */
export interface Rect {
  boundary: [number, number, number, number];
}

/** @see label/index.h:CX(i) — low side, x-axis offset i */
export function CX(i: number): number { return i; }

/** @see label/index.h:NX(i) — high side, x-axis offset i */
export function NX(i: number): number { return i + NUMDIMS; }

/** @see label/index.h:CY(i) — low side, y-axis offset i */
export function CY(i: number): number { return i + 1; }

/** @see label/index.h:NY(i) — high side, y-axis offset i */
export function NY(i: number): number { return i + 1 + NUMDIMS; }

/**
 * Returns true when the rect is undefined (NullRect convention).
 * C: boundary[0] > boundary[NUMDIMS]
 * @see label/rectangle.c:Undefined
 */
function isUndefined(r: Rect): boolean {
  return r.boundary[0] > r.boundary[NUMDIMS];
}

/**
 * Initialize a rectangle to have all 0 coordinates.
 * @see label/rectangle.c:InitRect
 */
export function initRect(r: Rect): void {
  for (let i = 0; i < NUMSIDES; i++) {
    r.boundary[i] = 0;
  }
}

/**
 * Return a rect whose first low side is higher than its opposite side —
 * interpreted as an undefined rect.
 * C: boundary[0]=1, boundary[NUMDIMS]=-1, rest 0.
 * @see label/rectangle.c:NullRect
 */
export function nullRect(): Rect {
  const r: Rect = { boundary: [0, 0, 0, 0] };
  r.boundary[0] = 1;
  r.boundary[NUMDIMS] = -1;
  return r;
}

/**
 * Calculate the n-dimensional area of a rectangle.
 * Returns 0 for undefined rects or zero-width dimensions.
 * Throws if area overflows Number.MAX_SAFE_INTEGER (browser-safe substitute
 * for C's graphviz_exit on UINT64_MAX overflow).
 * @see label/rectangle.c:RectArea
 */
export function rectArea(r: Rect): number {
  if (isUndefined(r)) return 0;

  let area = 1;
  for (let i = 0; i < NUMDIMS; i++) {
    const dim = r.boundary[i + NUMDIMS] - r.boundary[i];
    if (dim === 0) return 0;
    if (Number.MAX_SAFE_INTEGER / dim < area) {
      throw new Error('label: area too large for rtree');
    }
    area *= dim;
  }
  return area;
}

/**
 * Combine two rectangles, making one that includes both.
 * Uses fmin for both low and high sides — faithful to C source.
 * @see label/rectangle.c:CombineRect
 */
export function combineRect(r: Rect, rr: Rect): Rect {
  if (isUndefined(r)) return rr;
  if (isUndefined(rr)) return r;

  const result: Rect = { boundary: [0, 0, 0, 0] };
  for (let i = 0; i < NUMDIMS; i++) {
    result.boundary[i] = Math.min(r.boundary[i], rr.boundary[i]);
    const j = i + NUMDIMS;
    result.boundary[j] = Math.min(r.boundary[j], rr.boundary[j]);
  }
  return result;
}

/**
 * Decide whether two rectangles overlap.
 * C: for each dim i, false if r.lo[i] > s.hi[i] OR s.lo[i] > r.hi[i].
 * Touching edges (equal) are considered overlapping (strict > only).
 * @see label/rectangle.c:Overlap
 */
export function overlap(r: Rect, s: Rect): boolean {
  for (let i = 0; i < NUMDIMS; i++) {
    const j = i + NUMDIMS;
    if (r.boundary[i] > s.boundary[j] || s.boundary[i] > r.boundary[j]) {
      return false;
    }
  }
  return true;
}
