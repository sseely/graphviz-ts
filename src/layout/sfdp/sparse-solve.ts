// SPDX-License-Identifier: EPL-2.0

/**
 * Jacobi-preconditioned conjugate gradient over a SparseMatrix — the solver
 * used by the stress-majorization smoothers.
 *
 * @see lib/sfdpgen/sparse_solve.c
 */

import type { SpMatrix } from './sparse-matrix.js';
import { smMultiplyDense } from './sparse-matrix.js';

/** y = x - y. @see lib/sparse/general.c:vector_subtract_to */
function vectorSubtractTo(n: number, x: number[], y: number[]): number[] {
  for (let i = 0; i < n; i++) y[i] = x[i]! - y[i]!;
  return y;
}

/** @see lib/sparse/general.c:vector_product */
function vectorProduct(n: number, x: number[], y: number[]): number {
  let t = 0;
  for (let i = 0; i < n; i++) t += x[i]! * y[i]!;
  return t;
}

/** y = x + beta*y. @see lib/sparse/general.c:vector_saxpy */
function vectorSaxpy(n: number, x: number[], y: number[], beta: number): number[] {
  for (let i = 0; i < n; i++) y[i] = x[i]! + beta * y[i]!;
  return y;
}

/** x = x + beta*y. @see lib/sparse/general.c:vector_saxpy2 */
function vectorSaxpy2(n: number, x: number[], y: number[], beta: number): number[] {
  for (let i = 0; i < n; i++) x[i] = x[i]! + beta * y[i]!;
  return x;
}

/** Inverse-diagonal preconditioner. @see sparse_solve.c:diag_precon_new */
function diagPreconNew(A: SpMatrix): number[] {
  const m = A.m;
  const ia = A.ia!;
  const ja = A.ja!;
  const a = A.a!;
  const diag = new Array<number>(m).fill(1);
  for (let i = 0; i < m; i++) {
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      if (i === ja[j] && Math.abs(a[j]!) > 0) diag[i] = 1 / a[j]!;
    }
  }
  return diag;
}

/** @see sparse_solve.c:conjugate_gradient */
function conjugateGradient(
  A: SpMatrix, precon: number[], n: number,
  x: number[], rhs: number[], tol: number, maxit: number,
): number {
  let rho = 0;
  let rhoOld = 1;
  let iter = 0;

  const z = new Array<number>(n).fill(0);
  let r = new Array<number>(n).fill(0);
  let p = new Array<number>(n).fill(0);
  const q = new Array<number>(n).fill(0);

  smMultiplyDense(A, x, r, 1);
  r = vectorSubtractTo(n, rhs, r);

  const res0 = Math.sqrt(vectorProduct(n, r, r)) / n;
  let res = res0;

  while (iter++ < maxit && res > tol * res0) {
    for (let i = 0; i < n; i++) z[i] = r[i]! * precon[i]!;
    rho = vectorProduct(n, r, z);

    if (iter > 1) {
      const beta = rho / rhoOld;
      p = vectorSaxpy(n, z, p, beta);
    } else {
      for (let i = 0; i < n; i++) p[i] = z[i]!;
    }

    smMultiplyDense(A, p, q, 1);

    const alpha = rho / vectorProduct(n, p, q);

    vectorSaxpy2(n, x, p, alpha);
    r = vectorSaxpy2(n, r, q, -alpha);

    res = Math.sqrt(vectorProduct(n, r, r)) / n;
    rhoOld = rho;
  }
  return res;
}

/**
 * Solve A x = rhs per dimension with CG; the solution replaces rhs
 * (matching the C convention: x0 holds initial guesses, rhs the result).
 * @see lib/sfdpgen/sparse_solve.c:SparseMatrix_solve
 */
export function smSolve(
  A: SpMatrix, dim: number, x0: number[], rhs: number[],
  tol: number, maxit: number,
): number {
  const n = A.m;
  const precond = diagPreconNew(A);
  let res = 0;
  const x = new Array<number>(n).fill(0);
  const b = new Array<number>(n).fill(0);
  for (let k = 0; k < dim; k++) {
    for (let i = 0; i < n; i++) {
      x[i] = x0[i * dim + k]!;
      b[i] = rhs[i * dim + k]!;
    }
    res += conjugateGradient(A, precond, n, x, b, tol, maxit);
    for (let i = 0; i < n; i++) {
      rhs[i * dim + k] = x[i]!;
    }
  }
  return res;
}
