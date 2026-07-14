// SPDX-License-Identifier: EPL-2.0

/**
 * Arithmetic primitives shared with the C reference build.
 *
 * @see lib/common/arith.h
 */

/**
 * C rounding: round half **away from zero**.
 *
 * This is the single shared implementation of the one rounding deviation that
 * separates this port from C. Both C spellings agree on it:
 *
 * - libm `round()` — "rounding halfway cases away from zero" (C99 7.12.9.6),
 *   used directly across `lib/` (e.g. `lib/dotgen/compound.c:41`,
 *   `lib/pack/pack.c:435`, `lib/dotgen/position.c:966`).
 * - the `ROUND` macro — `((f>=0)?(int)(f + .5):(int)(f - .5))`
 *   (`lib/common/arith.h:48`), whose truncating casts also break ties away
 *   from zero. `POINTS(a_inches)` (`lib/common/geom.h:62`) is `ROUND` too.
 *
 * JavaScript's `Math.round` breaks ties toward +∞ (`Math.round(-4.5) === -4`,
 * C `round(-4.5) === -5`), so it diverges by 1 on **every exact negative
 * half-integer**. Layout coordinates are routinely negative (center-origin
 * engines, cluster walls left of an endpoint, port offsets from a node centre)
 * and are often exact integers or halves, so such ties are ordinary, not
 * exotic.
 *
 * Use this for every site that mirrors a C `round()`/`ROUND()`/`POINTS()`,
 * including sites whose argument happens to be non-negative today — it costs
 * nothing and states the intent. Do **not** use it where C rounds by some
 * other rule (`(int)` truncation, `floor`, printf `%.0f` banker's rounding).
 *
 * @see lib/common/arith.h:48 (ROUND)
 * @see C99 7.12.9.6 (round)
 */
export function cround(v: number): number {
  return v >= 0 ? Math.floor(v + 0.5) : Math.ceil(v - 0.5);
}
