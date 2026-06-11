// SPDX-License-Identifier: EPL-2.0

/**
 * SparseMatrix — the CSR/COORD matrix substrate of sfdp, ported from
 * lib/sparse/SparseMatrix.c at the 15.0.0 tag.
 *
 * Only the REAL and PATTERN types used by the sfdp pipeline are
 * ported (INTEGER paths are unreachable from sfdp_layout). Row entry
 * ORDER is load-bearing: the mask-accumulator append order of
 * add/multiply and the counting-sort order of from_coordinate_arrays
 * feed float-summation order downstream — do not sort rows.
 *
 * Products: see sparse-matrix-multiply.ts.
 *
 * @see lib/sparse/SparseMatrix.c (15.0.0)
 */

/** @see lib/sparse/SparseMatrix.h:MATRIX_TYPE_* */
export const MATRIX_TYPE_REAL = 1 << 0;
export const MATRIX_TYPE_PATTERN = 1 << 3;

/** @see lib/sparse/SparseMatrix.h: enum FORMAT_* */
export const FORMAT_CSR = 0;
export const FORMAT_COORD = 1;

/** @see lib/sparse/SparseMatrix.h:SYMMETRY_EPSILON */
const SYMMETRY_EPSILON = 0.0000001;

/**
 * @see lib/sparse/SparseMatrix.h:SparseMatrix_struct
 * In CSR format ia is the row pointer (m+1); in COORD it is the row
 * index per entry.
 */
export interface SpMatrix {
  m: number;
  n: number;
  nz: number;
  type: number;
  format: number;
  ia: number[];
  ja: number[];
  /** Entry values; null for PATTERN. */
  a: number[] | null;
  isSymmetric: boolean;
  isPatternSymmetric: boolean;
}

/** @see lib/sparse/SparseMatrix.c:SparseMatrix_new */
export function smNew(m: number, n: number, type: number, format: number): SpMatrix {
  return {
    m, n, nz: 0, type, format,
    ia: format === FORMAT_CSR ? new Array<number>(m + 1).fill(0) : [],
    ja: [],
    a: type === MATRIX_TYPE_REAL ? [] : null,
    isSymmetric: false,
    isPatternSymmetric: false,
  };
}

/**
 * Append one COORD entry, growing m/n as needed.
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_coordinate_form_add_entry_
 */
export function smCoordAddEntry(A: SpMatrix, irn: number, jcn: number, val: number): void {
  A.ia.push(irn);
  A.ja.push(jcn);
  if (A.a !== null) A.a.push(val);
  if (irn >= A.m) A.m = irn + 1;
  if (jcn >= A.n) A.n = jcn + 1;
  A.nz++;
}

/**
 * COORD → CSR with repeated entries summed.
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_from_coordinate_format
 */
export function smFromCoordinateFormat(A: SpMatrix): SpMatrix {
  return smFromCoordinateArrays(
    A.nz, A.m, A.n, { irn: A.ia, jcn: A.ja, val: A.a }, A.type);
}

/**
 * Coordinate arrays → CSR (counting sort by row; entry order within a
 * row is input order), then repeated entries summed.
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_from_coordinate_arrays_internal
 */
export function smFromCoordinateArrays(
  nz: number, m: number, n: number,
  coords: { irn: number[]; jcn: number[]; val: number[] | null },
  type: number,
): SpMatrix {
  const A = smNew(m, n, type, FORMAT_CSR);
  countingSortByRow(A, nz, coords);
  return smSumRepeatEntries(A);
}

/** Counting-sort COORD triples into A's CSR arrays (input order kept
 *  within each row). @see SparseMatrix.c:415-501 */
function countingSortByRow(
  A: SpMatrix, nz: number,
  coords: { irn: number[]; jcn: number[]; val: number[] | null },
): void {
  const { irn, jcn, val } = coords;
  const ia = A.ia;
  const ja = A.ja;
  const m = A.m;
  ja.length = nz;
  if (A.a !== null) A.a.length = nz;

  for (let i = 0; i < nz; i++) ia[irn[i]! + 1]!++;
  for (let i = 0; i < m; i++) ia[i + 1]! += ia[i]!;
  for (let i = 0; i < nz; i++) {
    const r = irn[i]!;
    if (A.a !== null) A.a[ia[r]!] = val![i]!;
    ja[ia[r]!] = jcn[i]!;
    ia[r] = ia[r]! + 1;
  }
  for (let i = m; i > 0; i--) ia[i] = ia[i - 1]!;
  ia[0] = 0;
  A.nz = nz;
}

/**
 * Sum repeated entries within each row in place (first-occurrence
 * positions keep the row order).
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_sum_repeat_entries
 */
export function smSumRepeatEntries(A: SpMatrix): SpMatrix {
  const { ia, ja, n } = A;
  const a = A.a;
  const mask = new Array<number>(n).fill(-1);
  let nz = 0;
  let sta = ia[0]!;
  for (let i = 0; i < A.m; i++) {
    for (let j = sta; j < ia[i + 1]!; j++) {
      if (mask[ja[j]!]! < ia[i]!) {
        ja[nz] = ja[j]!;
        if (a !== null) a[nz] = a[j]!;
        mask[ja[j]!] = nz++;
      } else if (a !== null) {
        a[mask[ja[j]!]!]! += a[j]!;
      }
    }
    sta = ia[i + 1]!;
    ia[i + 1] = nz;
  }
  A.nz = nz;
  ja.length = nz;
  if (a !== null) a.length = nz;
  return A;
}

/** @see lib/sparse/SparseMatrix.c:SparseMatrix_transpose */
export function smTranspose(A: SpMatrix): SpMatrix {
  const { ia, ja, m, n } = A;
  const B = smNew(n, m, A.type, FORMAT_CSR);
  B.nz = A.nz;
  const ib = B.ia;
  const jb = B.ja;
  jb.length = A.nz;
  if (B.a !== null) B.a.length = A.nz;

  for (let i = 0; i < m; i++) {
    for (let j = ia[i]!; j < ia[i + 1]!; j++) ib[ja[j]! + 1]!++;
  }
  for (let i = 0; i < n; i++) ib[i + 1]! += ib[i]!;
  for (let i = 0; i < m; i++) {
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      const c = ja[j]!;
      jb[ib[c]!] = i;
      if (B.a !== null) B.a[ib[c]!] = A.a![j]!;
      ib[c] = ib[c]! + 1;
    }
  }
  for (let i = n - 1; i >= 0; i--) ib[i + 1] = ib[i]!;
  ib[0] = 0;
  return B;
}

/** @see lib/sparse/SparseMatrix.c:SparseMatrix_copy */
export function smCopy(A: SpMatrix): SpMatrix {
  return {
    m: A.m, n: A.n, nz: A.nz, type: A.type, format: A.format,
    ia: [...A.ia], ja: [...A.ja],
    a: A.a === null ? null : [...A.a],
    isSymmetric: A.isSymmetric,
    isPatternSymmetric: A.isPatternSymmetric,
  };
}

/**
 * Symmetry test (REAL compares values to SYMMETRY_EPSILON); caches
 * the result flags on A as in C.
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_is_symmetric
 */
export function smIsSymmetric(A: SpMatrix, patternOnly: boolean): boolean {
  if (A.isSymmetric) return true;
  if (patternOnly && A.isPatternSymmetric) return true;
  if (A.m !== A.n) return false;

  const B = smTranspose(A);
  const checkValues = !patternOnly && A.type === MATRIX_TYPE_REAL;
  if (!symmetricAgainstTranspose(A, B, checkValues)) return false;

  if (!patternOnly) A.isSymmetric = true;
  A.isPatternSymmetric = true;
  return true;
}

/** Row-by-row pattern (and value) comparison of A vs its transpose. */
function symmetricAgainstTranspose(
  A: SpMatrix, B: SpMatrix, checkValues: boolean,
): boolean {
  const { ia, ja, m } = A;
  const ib = B.ia;
  const jb = B.ja;
  const mask = new Array<number>(m).fill(-1);

  if (checkValues) {
    for (let i = 0; i <= m; i++) if (ia[i] !== ib[i]) return false;
  }
  for (let i = 0; i < m; i++) {
    for (let j = ia[i]!; j < ia[i + 1]!; j++) mask[ja[j]!] = j;
    for (let j = ib[i]!; j < ib[i + 1]!; j++) {
      if (mask[jb[j]!]! < ia[i]!) return false;
    }
    if (checkValues) {
      for (let j = ib[i]!; j < ib[i + 1]!; j++) {
        if (Math.abs(B.a![j]! - A.a![mask[jb[j]!]!]!) > SYMMETRY_EPSILON) return false;
      }
    }
  }
  return true;
}

/**
 * A + Aᵀ unless already symmetric (then a copy). Row order = A's row
 * entries first, then unmatched Aᵀ entries (mask-append).
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_symmetrize
 */
export function smSymmetrize(A: SpMatrix, patternSymmetricOnly: boolean): SpMatrix {
  if (smIsSymmetric(A, patternSymmetricOnly)) return smCopy(A);
  const B = smTranspose(A);
  const C = smAdd(A, B);
  C.isSymmetric = true;
  C.isPatternSymmetric = true;
  return C;
}

/** C = A + B (mask-append row order). @see SparseMatrix.c:SparseMatrix_add */
export function smAdd(A: SpMatrix, B: SpMatrix): SpMatrix {
  const C = smNew(A.m, A.n, A.type, FORMAT_CSR);
  const mask = new Array<number>(A.n).fill(-1);
  let nz = 0;
  C.ia[0] = 0;
  for (let i = 0; i < A.m; i++) {
    nz = addRowA(A, C, mask, i, nz);
    nz = addRowB(B, C, mask, i, nz);
    C.ia[i + 1] = nz;
  }
  C.nz = nz;
  return C;
}

/** Copy row i of A into C, marking columns. @see SparseMatrix.c:557-563 */
function addRowA(A: SpMatrix, C: SpMatrix, mask: number[], i: number, nz: number): number {
  for (let j = A.ia[i]!; j < A.ia[i + 1]!; j++) {
    mask[A.ja[j]!] = nz;
    C.ja[nz] = A.ja[j]!;
    if (C.a !== null) C.a[nz] = A.a![j]!;
    nz++;
  }
  return nz;
}

/** Merge row i of B into C via the column mask. @see SparseMatrix.c:564-571 */
function addRowB(B: SpMatrix, C: SpMatrix, mask: number[], i: number, nz: number): number {
  for (let j = B.ia[i]!; j < B.ia[i + 1]!; j++) {
    if (mask[B.ja[j]!]! < C.ia[i]!) {
      C.ja[nz] = B.ja[j]!;
      if (C.a !== null) C.a[nz] = B.a![j]!;
      nz++;
    } else if (C.a !== null) {
      C.a[mask[B.ja[j]!]!]! += B.a![j]!;
    }
  }
  return nz;
}

/** In-place diagonal removal. @see SparseMatrix.c:SparseMatrix_remove_diagonal */
export function smRemoveDiagonal(A: SpMatrix): SpMatrix {
  const { ia, ja } = A;
  const a = A.a;
  let nz = 0;
  let sta = ia[0]!;
  for (let i = 0; i < A.m; i++) {
    for (let j = sta; j < ia[i + 1]!; j++) {
      if (ja[j] !== i) {
        ja[nz] = ja[j]!;
        if (a !== null) a[nz] = a[j]!;
        nz++;
      }
    }
    sta = ia[i + 1]!;
    ia[i + 1] = nz;
  }
  A.nz = nz;
  ja.length = nz;
  if (a !== null) a.length = nz;
  return A;
}

/** @see lib/sparse/SparseMatrix.c:SparseMatrix_has_diagonal */
export function smHasDiagonal(A: SpMatrix): boolean {
  for (let i = 0; i < A.m; i++) {
    for (let j = A.ia[i]!; j < A.ia[i + 1]!; j++) {
      if (A.ja[j] === i) return true;
    }
  }
  return false;
}

/** a[row] /= degree(row). @see SparseMatrix.c:SparseMatrix_divide_row_by_degree */
export function smDivideRowByDegree(A: SpMatrix): SpMatrix {
  const ia = A.ia;
  const a = A.a!;
  for (let i = 0; i < A.m; i++) {
    const deg = ia[i + 1]! - ia[i]!;
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      a[j] = a[j]! / deg;
    }
  }
  return A;
}

/**
 * Pattern-symmetrized adjacency with unit weights and no diagonal.
 * @see SparseMatrix.c:SparseMatrix_get_real_adjacency_matrix_symmetrized
 */
export function smGetRealAdjacencySymmetrized(A: SpMatrix): SpMatrix {
  const B = smNew(A.m, A.n, MATRIX_TYPE_PATTERN, FORMAT_CSR);
  B.ia = [...A.ia];
  B.ja = [...A.ja];
  B.nz = A.nz;
  const S = smSymmetrize(B, true);
  smRemoveDiagonal(S);
  S.a = new Array<number>(S.nz).fill(1);
  S.type = MATRIX_TYPE_REAL;
  return S;
}

/**
 * res = A·V for dense n×dim V (row-major).
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_multiply_dense
 */
export function smMultiplyDense(A: SpMatrix, v: number[], res: number[], dim: number): void {
  const { ia, ja } = A;
  const a = A.a!;
  for (let i = 0; i < A.m; i++) {
    for (let k = 0; k < dim; k++) res[i * dim + k] = 0;
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      for (let k = 0; k < dim; k++) {
        res[i * dim + k]! += a[j]! * v[ja[j]! * dim + k]!;
      }
    }
  }
}
