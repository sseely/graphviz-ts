// SPDX-License-Identifier: EPL-2.0

/**
 * Shared multicolor color-list parser (AD4).
 *
 * Ports the colorseg_t / colorsegs_t types and the parseSegs function
 * from lib/common/emit.c.  Pure data-in / data-out — no rendering, no
 * ObjState mutation.  Consumed by findStopColor (style-resolve.ts),
 * stripedBox / wedgedEllipse (S1), and multicolor edges (M1).
 *
 * @see lib/common/emit.c:411 colorseg_t
 * @see lib/common/emit.c:422 colorsegs_t
 * @see lib/common/emit.c:470 parseSegs
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One color segment in a colon-separated color list.
 * @see lib/common/emit.c:411 colorseg_t
 */
export interface ColorSeg {
  /** Color name/spec; null when the token was empty. */
  color: string | null;
  /** Fractional width of this segment in [0, 1]. */
  t: number;
  /**
   * True when the segment carried an explicit positive fraction (`;f`).
   * False when no semicolon was present or the fraction was 0.
   * @see lib/common/emit.c:488-489
   */
  hasFraction: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @see lib/common/emit.c:451 EPS */
const EPS = 1e-5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when |x| < EPS. @see lib/common/emit.c:452 AEQ0 */
function aeq0(x: number): boolean {
  return x < EPS && x > -EPS;
}

/**
 * Parse "color;fraction" or "color" into { color, v }.
 * v === 0  → no semicolon (no explicit fraction).
 * v > 0    → valid non-negative fraction.
 * v === -1 → semicolon present but no valid non-negative float.
 * @see lib/common/emit.c:429 getSegLen
 */
function getSegLen(token: string): { color: string; v: number } {
  const semi = token.indexOf(';');
  if (semi === -1) return { color: token, v: 0 };
  const color = token.slice(0, semi);
  const rest = token.slice(semi + 1);
  if (rest.length === 0) return { color, v: -1 };
  const parsed = parseFloat(rest);
  return !isNaN(parsed) && parsed >= 0 ? { color, v: parsed } : { color, v: -1 };
}

/**
 * Clamp one token against `left`, append to `segs`, return updated `left`.
 * Returns null on a parse error (bad float after semicolon).
 * @see lib/common/emit.c:476-506
 */
function appendSeg(
  token: string,
  left: number,
  segs: ColorSeg[],
  warnedExceeded: { v: boolean },
): { left: number; rval: 0 | 3 } | null {
  const { color, v } = getSegLen(token);
  if (v < 0) return null;

  let t = v;
  let rval: 0 | 3 = 0;
  const del = t - left;
  if (del > 0) {
    if (!aeq0(del) && !warnedExceeded.v) {
      warnedExceeded.v = true;
      rval = 3;
    }
    t = left;
  }
  left -= t;
  segs.push({ color: color.length > 0 ? color : null, t, hasFraction: t > 0 && v > 0 });
  return { left, rval };
}

/**
 * Distribute `left` weight among zero-t segments; if none, add to last.
 * @see lib/common/emit.c:509-526
 */
function distributeLeft(segs: ColorSeg[], left: number): void {
  if (left <= 0) return;
  const zeroCount = segs.filter(s => s.t <= 0).length;
  if (zeroCount > 0) {
    const delta = left / zeroCount;
    for (const s of segs) {
      if (s.t <= 0) s.t = delta;
    }
  } else if (segs.length > 0) {
    segs[segs.length - 1]!.t += left;
  }
}

/**
 * Drop trailing zero-t segments (mirrors C's LIST_DROP_BACK loop).
 * @see lib/common/emit.c:528-532
 */
function trimTrailing(segs: ColorSeg[]): void {
  while (segs.length > 0 && (segs[segs.length - 1]?.t ?? 0) <= 0) {
    segs.pop();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse `"c1;f1:c2;f2:…"` into segments.
 *
 * Fractions are optional and non-negative; their sum must not exceed 1.
 * Segments without an explicit fraction share the remaining weight equally;
 * if none exist the remainder is added to the last segment.
 *
 * Return codes (mirror C):
 *   0 → ok; 1 → silent error; 2 → error with message; 3 → warning (sum > 1).
 * On rv 1 or 2 the returned segs array is empty.
 *
 * @see lib/common/emit.c:470 parseSegs
 */
export function parseSegs(
  colorlist: string,
): { segs: ColorSeg[]; error: 0 | 1 | 2 | 3 } {
  const segs: ColorSeg[] = [];
  let left = 1;
  let rval: 0 | 3 = 0;
  let badFloatCount = 0;
  const warnedExceeded = { v: false };

  for (const token of colorlist.split(':')) {
    const result = appendSeg(token, left, segs, warnedExceeded);
    if (result === null) {
      const errCode: 1 | 2 = badFloatCount === 0 ? 2 : 1;
      badFloatCount++;
      return { segs: [], error: errCode };
    }
    if (result.rval === 3) rval = 3;
    left = result.left;
    if (aeq0(left)) { left = 0; break; }
  }

  distributeLeft(segs, left);
  trimTrailing(segs);
  return { segs, error: rval };
}
