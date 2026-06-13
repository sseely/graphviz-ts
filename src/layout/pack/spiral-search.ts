// SPDX-License-Identifier: EPL-2.0

/**
 * Concentric square spiral search for polyomino placement.
 *
 * Extracted from placeGraph so the spiral loop does not inflate the
 * cyclomatic complexity of its caller.
 *
 * @see lib/pack/pack.c:placeGraph
 */

import type { Point } from '../../model/geom.js';
import type { GInfo, PlaceCtx } from './poly-pack.js';
import { fits } from './poly-pack.js';

/** Mutable position cursor walked in-place across one spiral segment. */
interface Cur {
  x: number;
  y: number;
}

/** Try fits() at the cursor; advance by (dx,dy) while pred is false. */
function seg(
  c: Cur,
  dx: number,
  dy: number,
  pred: (c: Cur) => boolean,
  info: GInfo,
  ctx: PlaceCtx,
): Point | null {
  while (!pred(c)) {
    const p = fits(c.x, c.y, info, ctx);
    if (p !== null) return p;
    c.x += dx;
    c.y += dy;
  }
  return null;
}

/**
 * One ring of the wide spiral (W >= H), starting at (0, -bnd).
 * Five segments walk clockwise around the ring.
 *
 * @see lib/pack/pack.c:placeGraph (W >= H inner loop body)
 */
function wideRing(bnd: number, info: GInfo, ctx: PlaceCtx): Point | null {
  const c: Cur = { x: 0, y: -bnd };
  return (
    seg(c,  1,  0, v => v.x >= bnd,  info, ctx) ??
    seg(c,  0,  1, v => v.y >= bnd,  info, ctx) ??
    seg(c, -1,  0, v => v.x <= -bnd, info, ctx) ??
    seg(c,  0, -1, v => v.y <= -bnd, info, ctx) ??
    seg(c,  1,  0, v => v.x >= 0,    info, ctx)
  );
}

/**
 * One ring of the tall spiral (W < H), starting at (-bnd, 0).
 * Five segments walk clockwise around the ring.
 *
 * @see lib/pack/pack.c:placeGraph (W < H inner loop body)
 */
function tallRing(bnd: number, info: GInfo, ctx: PlaceCtx): Point | null {
  const c: Cur = { x: -bnd, y: 0 };
  return (
    seg(c,  0, -1, v => v.y <= -bnd, info, ctx) ??
    seg(c,  1,  0, v => v.x >= bnd,  info, ctx) ??
    seg(c,  0,  1, v => v.y >= bnd,  info, ctx) ??
    seg(c, -1,  0, v => v.x <= -bnd, info, ctx) ??
    seg(c,  0, -1, v => v.y <= 0,    info, ctx)
  );
}

/**
 * Wide spiral: expand rings outward until a placement is found.
 *
 * @see lib/pack/pack.c:placeGraph (W >= H branch)
 */
function spiralWide(info: GInfo, ctx: PlaceCtx): Point {
  for (let bnd = 1; ; bnd++) {
    const p = wideRing(bnd, info, ctx);
    if (p !== null) return p;
  }
}

/**
 * Tall spiral: expand rings outward until a placement is found.
 *
 * @see lib/pack/pack.c:placeGraph (W < H branch)
 */
function spiralTall(info: GInfo, ctx: PlaceCtx): Point {
  for (let bnd = 1; ; bnd++) {
    const p = tallRing(bnd, info, ctx);
    if (p !== null) return p;
  }
}

/**
 * Search for a valid placement on a concentric square spiral.
 * Delegates to the wide or tall variant based on the bounding-box aspect ratio.
 *
 * @see lib/pack/pack.c:placeGraph
 */
export function spiralSearch(info: GInfo, ctx: PlaceCtx, wide: boolean): Point {
  return wide ? spiralWide(info, ctx) : spiralTall(info, ctx);
}
