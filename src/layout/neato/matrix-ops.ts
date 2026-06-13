// SPDX-License-Identifier: EPL-2.0

/**
 * Float32 vector/matrix helpers for the stress kernel. C computes
 * these in 32-bit float (FLT_EVAL_METHOD 0); every chained float
 * operation is rounded with Math.fround. Single binary ops stored
 * into Float32Array round identically to C without an explicit
 * fround (no double-rounding for one op on f32 operands).
 *
 * @see lib/neatogen/matrix_ops.c
 */

const fr = Math.fround;

/** Subtract the mean (double precision). @see matrix_ops.c:orthog1 */
export function orthog1(n: number, vec: Float64Array): void {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += vec[i]!;
  sum /= n;
  for (let i = 0; i < n; i++) vec[i] = vec[i]! - sum;
}

/** Subtract the mean (float precision). @see matrix_ops.c:orthog1f */
export function orthog1f(n: number, vec: Float32Array): void {
  let sum = fr(0);
  for (let i = 0; i < n; i++) sum = fr(sum + vec[i]!);
  sum = fr(sum / n);
  for (let i = 0; i < n; i++) vec[i] = vec[i]! - sum;
}

/**
 * result = packed_matrix * vector, packed upper-triangular symmetric.
 * @see matrix_ops.c:right_mult_with_vector_ff
 */
export function rightMultWithVectorFF(
  m: Float32Array, n: number, vector: Float32Array, result: Float32Array,
): void {
  for (let i = 0; i < n; i++) result[i] = 0;
  let index = 0;
  for (let i = 0; i < n; i++) {
    const vi = vector[i]!;
    let res = fr(m[index++]! * vi);
    for (let j = i + 1; j < n; j++, index++) {
      res = fr(res + fr(m[index]! * vector[j]!));
      result[j] = result[j]! + fr(m[index]! * vi);
    }
    result[i] = result[i]! + res;
  }
}

/** result = v1 - v2. @see matrix_ops.c:vectors_subtractionf */
export function vectorsSubtractionF(
  n: number, v1: Float32Array, v2: Float32Array, result: Float32Array,
): void {
  for (let i = 0; i < n; i++) result[i] = v1[i]! - v2[i]!;
}

/** v1 += alpha * v2 (float alpha). @see matrix_ops.c:vectors_mult_additionf */
export function vectorsMultAdditionF(
  n: number, v1: Float32Array, alpha: number, v2: Float32Array,
): void {
  const a = fr(alpha);
  for (let i = 0; i < n; i++) v1[i] = v1[i]! + fr(a * v2[i]!);
}

/** Double-precision dot product of float vectors. @see matrix_ops.c:vectors_inner_productf */
export function vectorsInnerProductF(n: number, v1: Float32Array, v2: Float32Array): number {
  let result = 0;
  for (let i = 0; i < n; i++) result += fr(v1[i]! * v2[i]!);
  return result;
}

/** @see matrix_ops.c:copy_vectorf */
export function copyVectorF(n: number, src: Float32Array, dst: Float32Array): void {
  for (let i = 0; i < n; i++) dst[i] = src[i]!;
}

/** @see matrix_ops.c:max_absf */
export function maxAbsF(n: number, vec: Float32Array): number {
  let max = fr(-1e30);
  for (let i = 0; i < n; i++) {
    const a = fr(Math.abs(vec[i]!));
    if (a > max) max = a;
  }
  return max;
}

/** @see matrix_ops.c:square_vec */
export function squareVec(n: number, vec: Float32Array): void {
  for (let i = 0; i < n; i++) vec[i] = vec[i]! * vec[i]!;
}

/** @see matrix_ops.c:invert_vec */
export function invertVec(n: number, vec: Float32Array): void {
  for (let i = 0; i < n; i++) {
    if (vec[i] !== 0) vec[i] = 1 / vec[i]!;
  }
}

/** target = sqrtf(source) where source >= 0. @see matrix_ops.c:sqrt_vecf */
export function sqrtVecF(n: number, source: Float32Array, target: Float32Array): void {
  for (let i = 0; i < n; i++) {
    if (source[i]! >= 0) target[i] = fr(Math.sqrt(source[i]!));
  }
}

/** vec = 1/sqrtf(vec) where vec > 0. @see matrix_ops.c:invert_sqrt_vec */
export function invertSqrtVec(n: number, vec: Float32Array): void {
  for (let i = 0; i < n; i++) {
    if (vec[i]! > 0) vec[i] = 1 / fr(Math.sqrt(vec[i]!));
  }
}
