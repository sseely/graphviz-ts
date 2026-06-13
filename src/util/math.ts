// SPDX-License-Identifier: EPL-2.0
/**
 * Arithmetic helper functions.
 *
 * @see lib/util/gv_math.h
 */

// INT32 limits used by d2i (mirrors C INT_MAX / INT_MIN for 32-bit int)
const INT32_MAX = 2_147_483_647;
const INT32_MIN = -2_147_483_648;

// FLT_MAX: largest finite single-precision float
const FLT_MAX = 3.4028234663852886e+38;

/**
 * Bit-exact zero check via DataView (mirrors C memcmp against 0).
 * -0.0 returns false; +0.0 returns true.
 *
 * CRITICAL (AD-9): must use bit-level comparison, NOT === 0.
 * @see lib/util/gv_math.h:is_exactly_zero
 */
export function isExactlyZero(v: number): boolean {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setFloat64(0, v, false);
  const bytes = new Uint8Array(buf);
  return bytes.every((b) => b === 0);
}

/**
 * Bit-exact equality via DataView (mirrors C memcmp).
 * Distinguishes +0.0 from -0.0.
 *
 * CRITICAL (AD-9): must use bit-level comparison, NOT ===.
 * @see lib/util/gv_math.h:is_exactly_equal
 */
export function isExactlyEqual(a: number, b: number): boolean {
  const buf = new ArrayBuffer(16);
  const dv = new DataView(buf);
  dv.setFloat64(0, a, false);
  dv.setFloat64(8, b, false);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== bytes[i + 8]) return false;
  }
  return true;
}

/**
 * Three-way double comparator.
 * Returns -1 if a<b, 0 if a==b, 1 if a>b (numerical, not bit-exact).
 * @see lib/util/gv_math.h:fcmp
 */
export function fcmp(a: number, b: number): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Integer maximum.
 * @see lib/util/gv_math.h:imax
 */
export function imax(a: number, b: number): number {
  return a > b ? a : b;
}

/**
 * Integer minimum.
 * @see lib/util/gv_math.h:imin
 */
export function imin(a: number, b: number): number {
  return a < b ? a : b;
}

/**
 * Convert double to int32, clamping to [INT_MIN, INT_MAX].
 * @see lib/util/gv_math.h:d2i
 */
export function d2i(v: number): number {
  if (v > INT32_MAX) return INT32_MAX;
  if (v < INT32_MIN) return INT32_MIN;
  return Math.trunc(v);
}

/**
 * Round-trip through Float32Array to get float32 precision,
 * clamping to [-FLT_MAX, FLT_MAX].
 * @see lib/util/gv_math.h:d2f
 */
export function d2f(v: number): number {
  if (v > FLT_MAX) return FLT_MAX;
  if (v < -FLT_MAX) return -FLT_MAX;
  const f32 = new Float32Array(1);
  f32[0] = v;
  return f32[0];
}

/**
 * Parse a string to a number. Returns NaN for non-numeric strings.
 * Wraps parseFloat, matching C strtod behaviour for well-formed input.
 */
export function gvStrtod(s: string): number {
  return parseFloat(s);
}
