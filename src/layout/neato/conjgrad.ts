// SPDX-License-Identifier: EPL-2.0
/**
 * Conjugate gradient solvers for packed symmetric float matrices.
 * @see lib/neatogen/conjgrad.c
 */

/**
 * Subtract mean from `v` in-place (orthogonalize against constant vector).
 * Matches `orthog1f` in lib/neatogen/matrix_ops.c.
 * @see lib/neatogen/matrix_ops.c:orthog1f
 */
export function orthog1f(n: number, v: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += v[i];
  const mean = sum / n;
  for (let i = 0; i < n; i++) v[i] -= mean;
}

/**
 * Multiply packed symmetric matrix `A` by vector `x`, writing result to `y`.
 * `A` is upper-triangular, row-major, length n*(n+1)/2.
 * Matches `right_mult_with_vector_ff` in lib/neatogen/matrix_ops.c.
 * @see lib/neatogen/matrix_ops.c:right_mult_with_vector_ff
 */
export function rightMultVecFF(
  A: Float32Array,
  n: number,
  x: Float32Array,
  y: Float32Array,
): void {
  for (let i = 0; i < n; i++) y[i] = 0;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++, idx++) {
      y[i] += A[idx] * x[j];
      if (i !== j) y[j] += A[idx] * x[i];
    }
  }
}

/** Maximum absolute value in float array. @internal */
export function maxAbsF(n: number, v: Float32Array): number {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(v[i]);
    if (a > m) m = a;
  }
  return m;
}

/** Inner product of two float arrays. @internal */
export function dotF(n: number, a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** CG state bundle. @internal */
interface CgState {
  r: Float32Array;
  p: Float32Array;
  Ap: Float32Array;
  rr: number;
}

/**
 * Initialise CG state from A, x, b (with orthogonalization).
 * @see lib/neatogen/conjgrad.c:conjugate_gradient_mkernel
 */
export function cgInit(
  A: Float32Array,
  x: Float32Array,
  b: Float32Array,
  n: number,
): CgState {
  const Ax = new Float32Array(n);
  const r = new Float32Array(n);
  orthog1f(n, x); orthog1f(n, b);
  rightMultVecFF(A, n, x, Ax);
  orthog1f(n, Ax);
  for (let i = 0; i < n; i++) r[i] = b[i] - Ax[i];
  const p = new Float32Array(r);
  return { r, p, Ap: new Float32Array(n), rr: dotF(n, r, r) };
}

/**
 * Update p and rr after a non-final CG step.
 * Returns 1 on zero-length error, 0 on success.
 * @see lib/neatogen/conjgrad.c:conjugate_gradient_mkernel
 */
export function cgUpdateDirection(
  n: number,
  alpha: number,
  state: CgState,
): number {
  const { r, p, Ap } = state;
  for (let j = 0; j < n; j++) r[j] -= alpha * Ap[j];
  const rrNew = dotF(n, r, r);
  if (state.rr === 0) return 1;
  const beta = rrNew / state.rr;
  state.rr = rrNew;
  for (let j = 0; j < n; j++) p[j] = beta * p[j] + r[j];
  return 0;
}

/**
 * Execute one CG iteration on packed matrix A.
 * Returns 0 = continue, 1 = zero-length error, 2 = p·Ap zero (done).
 * @see lib/neatogen/conjgrad.c:conjugate_gradient_mkernel
 */
export function cgStep(
  A: Float32Array,
  x: Float32Array,
  n: number,
  state: CgState,
  last: boolean,
): number {
  const { r, p, Ap } = state;
  orthog1f(n, p); orthog1f(n, x); orthog1f(n, r);
  rightMultVecFF(A, n, p, Ap);
  orthog1f(n, Ap);
  const pAp = dotF(n, p, Ap);
  if (pAp === 0) return 2;
  const alpha = state.rr / pAp;
  for (let j = 0; j < n; j++) x[j] += alpha * p[j];
  if (last) return 0;
  return cgUpdateDirection(n, alpha, state);
}

/** Options for {@link conjugateGradientMkernel}. */
export interface CgOptions {
  tol: number;
  maxIterations: number;
}

/**
 * Conjugate gradient solver for packed symmetric float matrix `A`.
 * Solves A·x = b in place (x is both initial guess and output).
 * `b` and `x` are orthogonalized against 1 before and during iteration.
 * Returns 0 on success, 1 if a zero-length vector is encountered.
 *
 * @see lib/neatogen/conjgrad.c:conjugate_gradient_mkernel
 */
export function conjugateGradientMkernel(
  A: Float32Array,
  x: Float32Array,
  b: Float32Array,
  n: number,
  opts: CgOptions,
): number {
  const state = cgInit(A, x, b, n);
  const { tol, maxIterations } = opts;
  for (let i = 0; i < maxIterations && maxAbsF(n, state.r) > tol; i++) {
    const rv = cgStep(A, x, n, state, i === maxIterations - 1);
    if (rv === 1) return 1;
    if (rv === 2) break;
  }
  return 0;
}
