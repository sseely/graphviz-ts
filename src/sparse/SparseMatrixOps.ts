// SPDX-License-Identifier: EPL-2.0
/**
 * SparseMatrix symmetry, adjacency, and augmentation operations.
 * @see sparse/SparseMatrix.c
 */

import {
  SparseMatrix,
  FORMAT_CSR,
  MATRIX_TYPE_REAL,
  MATRIX_TYPE_INTEGER,
  BIPARTITE_RECT,
  BIPARTITE_PATTERN_UNSYM,
  BIPARTITE_UNSYM,
} from "./SparseMatrix.js";
import { SYMMETRY_EPSILON } from "./general.js";

// ---- symmetry checker (class keeps lizard boundaries clean) -----------------

/**
 * Per-matrix-pair symmetry checker. Bundles arrays to stay under param limits.
 * @see sparse/SparseMatrix.c:SparseMatrix_is_symmetric
 */
class SymChecker {
  private readonly ia: Int32Array;
  private readonly ib: Int32Array;
  private readonly ja: Int32Array;
  private readonly jb: Int32Array;
  private readonly mask: Int32Array;

  constructor(A: SparseMatrix, B: SparseMatrix) {
    this.ia = A.ia; this.ib = B.ia;
    this.ja = A.ja; this.jb = B.ja;
    this.mask = new Int32Array(A.m).fill(-1);
  }

  stamp(i: number): void {
    for (let j = this.ia[i]; j < this.ia[i + 1]; j++) this.mask[this.ja[j]] = this.ia[i];
  }

  colsPresent(i: number): boolean {
    for (let j = this.ib[i]; j < this.ib[i + 1]; j++) if (this.mask[this.jb[j]] < this.ia[i]) return false;
    return true;
  }

  realRowMatch(i: number, a: Float64Array, b: Float64Array): boolean {
    for (let j = this.ib[i]; j < this.ib[i + 1]; j++) {
      if (Math.abs(b[j] - a[this.mask[this.jb[j]]]) > SYMMETRY_EPSILON) return false;
    }
    return true;
  }

  intRowMatch(i: number, a: Int32Array, b: Int32Array): boolean {
    for (let j = this.ib[i]; j < this.ib[i + 1]; j++) {
      if (b[j] !== a[this.mask[this.jb[j]]]) return false;
    }
    return true;
  }

  checkReal(A: SparseMatrix, B: SparseMatrix): boolean {
    for (let i = 0; i <= A.m; i++) if (A.ia[i] !== B.ia[i]) return false;
    const a = A.a as Float64Array, b = B.a as Float64Array;
    for (let i = 0; i < A.m; i++) {
      this.stamp(i);
      if (!this.colsPresent(i) || !this.realRowMatch(i, a, b)) return false;
    }
    return true;
  }

  checkInteger(A: SparseMatrix, B: SparseMatrix): boolean {
    const a = A.a as Int32Array, b = B.a as Int32Array;
    for (let i = 0; i < A.m; i++) {
      this.stamp(i);
      if (!this.colsPresent(i) || !this.intRowMatch(i, a, b)) return false;
    }
    return true;
  }

  checkPattern(m: number): boolean {
    for (let i = 0; i < m; i++) {
      this.stamp(i);
      if (!this.colsPresent(i)) return false;
    }
    return true;
  }

  run(A: SparseMatrix, B: SparseMatrix, patternOnly: boolean): boolean {
    if (patternOnly) return this.checkPattern(A.m);
    if (A.type === MATRIX_TYPE_REAL) return this.checkReal(A, B);
    if (A.type === MATRIX_TYPE_INTEGER) return this.checkInteger(A, B);
    return this.checkPattern(A.m);
  }
}

/**
 * Test for symmetry. Caches result on A.
 * @see sparse/SparseMatrix.c:SparseMatrix_is_symmetric
 */
export function isSymmetric(A: SparseMatrix, testPatternOnly: boolean): boolean {
  if (A.isSymmetric) return true;
  if (testPatternOnly && A.isPatternSymmetric) return true;
  if (A.m !== A.n) return false;
  const B = A.transpose();
  const res = new SymChecker(A, B).run(A, B, testPatternOnly);
  if (res) { if (!testPatternOnly) A.isSymmetric = true; A.isPatternSymmetric = true; }
  return res;
}

/**
 * Return A + A^T (or a copy if already symmetric).
 * @see sparse/SparseMatrix.c:SparseMatrix_symmetrize
 */
export function symmetrize(A: SparseMatrix, patternOnly: boolean): SparseMatrix {
  if (isSymmetric(A, patternOnly)) return A.copy();
  const C = A.add(A.transpose());
  C.isSymmetric = true; C.isPatternSymmetric = true;
  return C;
}

/** Make undirected: symmetrize then remove upper triangle. */
export function makeUndirected(A: SparseMatrix): SparseMatrix {
  const B = symmetrize(A, false);
  B.isUndirected = true;
  return B.removeUpper();
}

/** Symmetrized real adjacency matrix (all 1s, no diagonal). */
export function getRealAdjacencyMatrixSymmetrized(A: SparseMatrix): SparseMatrix {
  if (A.n !== A.m) throw new Error("non-square matrix");
  const pat = SparseMatrix.new(A.m, A.n, A.nz, 8, FORMAT_CSR);
  pat.ia.set(A.ia); pat.ja.set(A.ja.subarray(0, A.nz)); pat.nz = A.nz;
  const sym = symmetrize(pat, true);
  sym.removeDiagonal(); sym.setEntriesToRealOne();
  return sym;
}

/** Convert to square augmented matrix {{0,A},{A^T,0}}. */
export function getAugmented(A: SparseMatrix): SparseMatrix {
  const irn = new Int32Array(A.nz * 2), jcn = new Int32Array(A.nz * 2);
  const m = A.m; let idx = 0;
  for (let i = 0; i < m; i++)
    for (let j = A.ia[i]; j < A.ia[i + 1]; j++) { irn[idx] = i; jcn[idx++] = A.ja[j] + m; }
  for (let i = 0; i < m; i++)
    for (let j = A.ia[i]; j < A.ia[i + 1]; j++) { jcn[idx] = i; irn[idx++] = A.ja[j] + m; }
  const val = buildAugVal(A);
  const mn = A.m + A.n;
  const B = SparseMatrix.fromCoordinateArrays(idx, mn, mn, irn, jcn, val, A.type);
  B.isSymmetric = true; B.isPatternSymmetric = true;
  return B;
}

function buildAugVal(A: SparseMatrix): Float64Array | Int32Array | null {
  if (!A.a) return null;
  if (A.type === MATRIX_TYPE_REAL) {
    const v = new Float64Array(A.nz * 2);
    v.set(A.a as Float64Array, 0); v.set(A.a as Float64Array, A.nz); return v;
  }
  const v = new Int32Array(A.nz * 2);
  v.set(A.a as Int32Array, 0); v.set(A.a as Int32Array, A.nz); return v;
}

/** Convert to square matrix if needed based on bipartite option. */
export function toSquareMatrix(A: SparseMatrix, opt: number): SparseMatrix {
  if (opt === BIPARTITE_RECT && A.m === A.n) return A;
  if (opt === BIPARTITE_PATTERN_UNSYM && A.m === A.n && isSymmetric(A, true)) return A;
  if (opt === BIPARTITE_UNSYM && A.m === A.n && isSymmetric(A, false)) return A;
  return getAugmented(A);
}
