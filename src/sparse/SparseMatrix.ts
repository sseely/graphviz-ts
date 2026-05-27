// SPDX-License-Identifier: EPL-2.0
/**
 * SparseMatrix — port of lib/sparse/SparseMatrix.c (core class + construction)
 *
 * Two formats:
 *   FORMAT_CSR  (0): ia[i..i+1) are row pointers, ja/a hold entries.
 *   FORMAT_COORD (1): ia and ja are parallel row/col arrays.
 *
 * @see sparse/SparseMatrix.h
 * @see sparse/SparseMatrix.c
 */


export const FORMAT_CSR   = 0;
export const FORMAT_COORD = 1;

export const MATRIX_TYPE_REAL    = 1 << 0; // 1
export const MATRIX_TYPE_INTEGER = 1 << 2; // 4
export const MATRIX_TYPE_PATTERN = 1 << 3; // 8

export const BIPARTITE_RECT          = 0;
export const BIPARTITE_PATTERN_UNSYM = 1;
export const BIPARTITE_UNSYM         = 2;
export const BIPARTITE_ALWAYS        = 3;

/**
 * Sparse matrix. Mirrors struct SparseMatrix_struct.
 * @see sparse/SparseMatrix.h:SparseMatrix_struct
 */
export class SparseMatrix {
  m = 0;
  n = 0;
  nz = 0;
  nzmax = 0;
  type = 0;
  ia: Int32Array = new Int32Array(0);
  ja: Int32Array = new Int32Array(0);
  a: Float64Array | Int32Array | null = null;
  format = FORMAT_CSR;
  isPatternSymmetric = false;
  isSymmetric = false;
  isUndirected = false;

  /** Use SparseMatrix.new() to construct instances. */
  constructor() {}

  /**
   * Allocate skeleton. If nz==0, only row-pointer array for CSR.
   * @see sparse/SparseMatrix.c:SparseMatrix_new
   */
  static new(m: number, n: number, nz: number, type: number, format: number): SparseMatrix {
    const A = new SparseMatrix();
    A.m = m; A.n = n; A.nz = 0; A.nzmax = nz; A.type = type; A.format = format;

    if (format === FORMAT_COORD) {
      A.ia = nz > 0 ? new Int32Array(nz) : new Int32Array(0);
      if (nz > 0) {
        A.ja = new Int32Array(nz);
        A.a = type === MATRIX_TYPE_REAL    ? new Float64Array(nz)
            : type === MATRIX_TYPE_INTEGER ? new Int32Array(nz)
            : null;
      }
    } else {
      A.ia = new Int32Array(m + 1);
      if (nz > 0) {
        A.ja = new Int32Array(nz);
        A.a = type === MATRIX_TYPE_REAL    ? new Float64Array(nz)
            : type === MATRIX_TYPE_INTEGER ? new Int32Array(nz)
            : null;
      }
    }
    return A;
  }

  /**
   * Grow COO storage by 10 when full, then add one entry.
   * @see sparse/SparseMatrix.c:SparseMatrix_coordinate_form_add_entry_
   */
  addEntry(irn: number, jcn: number, val: number | null): void {
    if (this.format !== FORMAT_COORD) throw new Error("addEntry requires FORMAT_COORD");
    const nz = this.nz;
    if (nz + 1 >= this.nzmax) this._realloc(nz + 1 + 10);
    this.ia[nz] = irn;
    this.ja[nz] = jcn;
    if (this.type !== MATRIX_TYPE_PATTERN && val !== null && this.a !== null) this.a[nz] = val;
    if (irn >= this.m) this.m = irn + 1;
    if (jcn >= this.n) this.n = jcn + 1;
    this.nz++;
  }

  _realloc(newNzmax: number): void {
    const newIa = new Int32Array(newNzmax); newIa.set(this.ia); this.ia = newIa;
    const newJa = new Int32Array(newNzmax); newJa.set(this.ja); this.ja = newJa;
    if (this.a !== null) {
      if (this.type === MATRIX_TYPE_REAL) {
        const nA = new Float64Array(newNzmax); nA.set(this.a as Float64Array); this.a = nA;
      } else if (this.type === MATRIX_TYPE_INTEGER) {
        const nA = new Int32Array(newNzmax); nA.set(this.a as Int32Array); this.a = nA;
      }
    } else if (this.type === MATRIX_TYPE_REAL) {
      this.a = new Float64Array(newNzmax);
    } else if (this.type === MATRIX_TYPE_INTEGER) {
      this.a = new Int32Array(newNzmax);
    }
    this.nzmax = newNzmax;
  }

  /**
   * Convert COO → CSR, summing repeated entries.
   * @see sparse/SparseMatrix.c:SparseMatrix_from_coordinate_format
   */
  fromCoordinateFormat(): SparseMatrix {
    return SparseMatrix.fromCoordinateArrays(this.nz, this.m, this.n, this.ia, this.ja, this.a, this.type);
  }

  /**
   * Convert COO → CSR without summing repeats.
   * @see sparse/SparseMatrix.c:SparseMatrix_from_coordinate_format_not_compacted
   */
  fromCoordinateFormatNotCompacted(): SparseMatrix {
    return SparseMatrix._fromCoordInternal(this.nz, this.m, this.n, this.ia, this.ja, this.a, this.type, false);
  }

  /** @see sparse/SparseMatrix.c:SparseMatrix_from_coordinate_arrays */
  static fromCoordinateArrays(
    nz: number, m: number, n: number,
    irn: Int32Array, jcn: Int32Array,
    val: Float64Array | Int32Array | null,
    type: number,
  ): SparseMatrix {
    return SparseMatrix._fromCoordInternal(nz, m, n, irn, jcn, val, type, true);
  }

  static _fromCoordInternal(
    nz: number, m: number, n: number,
    irn: Int32Array, jcn: Int32Array,
    val: Float64Array | Int32Array | null,
    type: number,
    sumRepeated: boolean,
  ): SparseMatrix {
    const A = SparseMatrix.new(m, n, nz, type, FORMAT_CSR);
    const ia = A.ia, ja = A.ja;
    for (let i = 0; i <= m; i++) ia[i] = 0;

    if (type === MATRIX_TYPE_REAL) {
      const a = A.a as Float64Array, v = val as Float64Array;
      for (let i = 0; i < nz; i++) ia[irn[i] + 1]++;
      for (let i = 0; i < m; i++) ia[i + 1] += ia[i];
      for (let i = 0; i < nz; i++) { a[ia[irn[i]]] = v[i]; ja[ia[irn[i]]++] = jcn[i]; }
      for (let i = m; i > 0; i--) ia[i] = ia[i - 1]; ia[0] = 0;
    } else if (type === MATRIX_TYPE_INTEGER) {
      const a = A.a as Int32Array, v = val as Int32Array;
      for (let i = 0; i < nz; i++) ia[irn[i] + 1]++;
      for (let i = 0; i < m; i++) ia[i + 1] += ia[i];
      for (let i = 0; i < nz; i++) { a[ia[irn[i]]] = v[i]; ja[ia[irn[i]]++] = jcn[i]; }
      for (let i = m; i > 0; i--) ia[i] = ia[i - 1]; ia[0] = 0;
    } else {
      for (let i = 0; i < nz; i++) ia[irn[i] + 1]++;
      for (let i = 0; i < m; i++) ia[i + 1] += ia[i];
      for (let i = 0; i < nz; i++) ja[ia[irn[i]]++] = jcn[i];
      for (let i = m; i > 0; i--) ia[i] = ia[i - 1]; ia[0] = 0;
    }
    A.nz = nz;
    return sumRepeated ? A.sumRepeatEntries() : A;
  }

  /**
   * Sum repeated entries in the same row in-place.
   * @see sparse/SparseMatrix.c:SparseMatrix_sum_repeat_entries
   */
  sumRepeatEntries(): SparseMatrix {
    const ia = this.ia, ja = this.ja, n = this.n;
    const mask = new Int32Array(n).fill(-1);
    let nz = 0;

    if (this.type === MATRIX_TYPE_REAL) {
      const a = this.a as Float64Array;
      let sta = ia[0];
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) {
          if (mask[ja[j]] < ia[i]) { ja[nz] = ja[j]; a[nz] = a[j]; mask[ja[j]] = nz++; }
          else a[mask[ja[j]]] += a[j];
        }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    } else if (this.type === MATRIX_TYPE_INTEGER) {
      const a = this.a as Int32Array;
      let sta = ia[0];
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) {
          if (mask[ja[j]] < ia[i]) { ja[nz] = ja[j]; a[nz] = a[j]; mask[ja[j]] = nz++; }
          else a[mask[ja[j]]] += a[j];
        }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    } else {
      let sta = ia[0];
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) {
          if (mask[ja[j]] < ia[i]) { ja[nz] = ja[j]; mask[ja[j]] = nz++; }
        }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    }
    this.nz = nz;
    return this;
  }

  /**
   * A×v (v=null → all-ones vector). Real and Integer only.
   * @see sparse/SparseMatrix.c:SparseMatrix_multiply_vector
   */
  multiplyVector(v: Float64Array | null, res?: Float64Array): Float64Array {
    const m = this.m, ia = this.ia, ja = this.ja;
    const u = res ?? new Float64Array(m);
    if (this.type === MATRIX_TYPE_REAL) {
      const a = this.a as Float64Array;
      if (v !== null) {
        for (let i = 0; i < m; i++) { u[i] = 0.0; for (let j = ia[i]; j < ia[i+1]; j++) u[i] += a[j]*v[ja[j]]; }
      } else {
        for (let i = 0; i < m; i++) { u[i] = 0.0; for (let j = ia[i]; j < ia[i+1]; j++) u[i] += a[j]; }
      }
    } else if (this.type === MATRIX_TYPE_INTEGER) {
      const a = this.a as Int32Array;
      if (v !== null) {
        for (let i = 0; i < m; i++) { u[i] = 0.0; for (let j = ia[i]; j < ia[i+1]; j++) u[i] += a[j]*v[ja[j]]; }
      } else {
        for (let i = 0; i < m; i++) { u[i] = 0.0; for (let j = ia[i]; j < ia[i+1]; j++) u[i] += a[j]; }
      }
    } else {
      throw new Error("multiplyVector: unsupported matrix type");
    }
    return u;
  }

  /**
   * A×V dense (V is n×dim row-major).
   * @see sparse/SparseMatrix.c:SparseMatrix_multiply_dense
   */
  multiplyDense(v: Float64Array, res: Float64Array, dim: number): void {
    const m = this.m, ia = this.ia, ja = this.ja, a = this.a as Float64Array;
    for (let i = 0; i < m; i++) {
      for (let k = 0; k < dim; k++) res[i*dim+k] = 0.0;
      for (let j = ia[i]; j < ia[i+1]; j++)
        for (let k = 0; k < dim; k++) res[i*dim+k] += a[j]*v[ja[j]*dim+k];
    }
  }

  /**
   * Transpose (FORMAT_CSR only).
   * @see sparse/SparseMatrix.c:SparseMatrix_transpose
   */
  transpose(): SparseMatrix {
    const m = this.m, n = this.n, ia = this.ia, ja = this.ja, nz = this.nz;
    const B = SparseMatrix.new(n, m, nz, this.type, FORMAT_CSR);
    B.nz = nz;
    const ib = B.ia, jb = B.ja;
    for (let i = 0; i <= n; i++) ib[i] = 0;
    for (let i = 0; i < m; i++) for (let j = ia[i]; j < ia[i+1]; j++) ib[ja[j]+1]++;
    for (let i = 0; i < n; i++) ib[i+1] += ib[i];
    if (this.type === MATRIX_TYPE_REAL) {
      const a = this.a as Float64Array, b = B.a as Float64Array;
      for (let i = 0; i < m; i++) for (let j = ia[i]; j < ia[i+1]; j++) { jb[ib[ja[j]]] = i; b[ib[ja[j]]++] = a[j]; }
    } else if (this.type === MATRIX_TYPE_INTEGER) {
      const a = this.a as Int32Array, b = B.a as Int32Array;
      for (let i = 0; i < m; i++) for (let j = ia[i]; j < ia[i+1]; j++) { jb[ib[ja[j]]] = i; b[ib[ja[j]]++] = a[j]; }
    } else {
      for (let i = 0; i < m; i++) for (let j = ia[i]; j < ia[i+1]; j++) jb[ib[ja[j]]++] = i;
    }
    for (let i = n-1; i >= 0; i--) ib[i+1] = ib[i]; ib[0] = 0;
    return B;
  }

  /** @see sparse/SparseMatrix.c:SparseMatrix_add (REAL rows) */
  private static addRealRows(
    A: SparseMatrix, B: SparseMatrix, C: SparseMatrix, mask: Int32Array, m: number,
  ): void {
    const ia = A.ia, ja = A.ja, ib = B.ia, jb = B.ja, ic = C.ia, jc = C.ja;
    const a = A.a as Float64Array, b = B.a as Float64Array, c = C.a as Float64Array;
    let nz = 0;
    for (let i = 0; i < m; i++) {
      for (let j = ia[i]; j < ia[i + 1]; j++) { mask[ja[j]] = nz; jc[nz] = ja[j]; c[nz] = a[j]; nz++; }
      for (let j = ib[i]; j < ib[i + 1]; j++) {
        if (mask[jb[j]] < ic[i]) { jc[nz] = jb[j]; c[nz++] = b[j]; }
        else c[mask[jb[j]]] += b[j];
      }
      ic[i + 1] = nz;
    }
    C.nz = nz;
  }

  /** @see sparse/SparseMatrix.c:SparseMatrix_add (INTEGER rows) */
  private static addIntRows(
    A: SparseMatrix, B: SparseMatrix, C: SparseMatrix, mask: Int32Array, m: number,
  ): void {
    const ia = A.ia, ja = A.ja, ib = B.ia, jb = B.ja, ic = C.ia, jc = C.ja;
    const a = A.a as Int32Array, b = B.a as Int32Array, c = C.a as Int32Array;
    let nz = 0;
    for (let i = 0; i < m; i++) {
      for (let j = ia[i]; j < ia[i + 1]; j++) { mask[ja[j]] = nz; jc[nz] = ja[j]; c[nz] = a[j]; nz++; }
      for (let j = ib[i]; j < ib[i + 1]; j++) {
        if (mask[jb[j]] < ic[i]) { jc[nz] = jb[j]; c[nz++] = b[j]; }
        else c[mask[jb[j]]] += b[j];
      }
      ic[i + 1] = nz;
    }
    C.nz = nz;
  }

  /** @see sparse/SparseMatrix.c:SparseMatrix_add (PATTERN rows) */
  private static addPatternRows(
    A: SparseMatrix, B: SparseMatrix, C: SparseMatrix, mask: Int32Array, m: number,
  ): void {
    const ia = A.ia, ja = A.ja, ib = B.ia, jb = B.ja, ic = C.ia, jc = C.ja;
    let nz = 0;
    for (let i = 0; i < m; i++) {
      for (let j = ia[i]; j < ia[i + 1]; j++) { mask[ja[j]] = nz; jc[nz++] = ja[j]; }
      for (let j = ib[i]; j < ib[i + 1]; j++) { if (mask[jb[j]] < ic[i]) jc[nz++] = jb[j]; }
      ic[i + 1] = nz;
    }
    C.nz = nz;
  }

  /**
   * Return a new matrix C = A + B.
   * @see sparse/SparseMatrix.c:SparseMatrix_add
   */
  add(B: SparseMatrix): SparseMatrix {
    const A = this;
    const m = A.m, n = A.n;
    const C = SparseMatrix.new(m, n, A.nz + B.nz, A.type, FORMAT_CSR);
    const mask = new Int32Array(n).fill(-1);
    if (A.type === MATRIX_TYPE_REAL) SparseMatrix.addRealRows(A, B, C, mask, m);
    else if (A.type === MATRIX_TYPE_INTEGER) SparseMatrix.addIntRows(A, B, C, mask, m);
    else SparseMatrix.addPatternRows(A, B, C, mask, m);
    return C;
  }

  /**
   * Remove diagonal and upper-diagonal entries in-place.
   * @see sparse/SparseMatrix.c:SparseMatrix_remove_upper
   */
  removeUpper(): SparseMatrix {
    const ia = this.ia, ja = this.ja;
    let nz = 0, sta = ia[0];
    if (this.type === MATRIX_TYPE_REAL) {
      const a = this.a as Float64Array;
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) { if (ja[j] < i) { ja[nz] = ja[j]; a[nz++] = a[j]; } }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    } else if (this.type === MATRIX_TYPE_INTEGER) {
      const a = this.a as Int32Array;
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) { if (ja[j] < i) { ja[nz] = ja[j]; a[nz++] = a[j]; } }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    } else {
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) { if (ja[j] < i) ja[nz++] = ja[j]; }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    }
    this.nz = nz;
    this.isPatternSymmetric = false;
    this.isSymmetric = false;
    return this;
  }

  /**
   * Remove diagonal entries in-place.
   * @see sparse/SparseMatrix.c:SparseMatrix_remove_diagonal
   */
  removeDiagonal(): void {
    const ia = this.ia, ja = this.ja;
    let nz = 0, sta = ia[0];
    if (this.type === MATRIX_TYPE_REAL) {
      const a = this.a as Float64Array;
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) { if (ja[j] !== i) { ja[nz] = ja[j]; a[nz++] = a[j]; } }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    } else if (this.type === MATRIX_TYPE_INTEGER) {
      const a = this.a as Int32Array;
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) { if (ja[j] !== i) { ja[nz] = ja[j]; a[nz++] = a[j]; } }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    } else {
      for (let i = 0; i < this.m; i++) {
        for (let j = sta; j < ia[i + 1]; j++) { if (ja[j] !== i) ja[nz++] = ja[j]; }
        sta = ia[i + 1]; ia[i + 1] = nz;
      }
    }
    this.nz = nz;
  }

  /**
   * Replace all values with 1.0 and set type to REAL.
   * @see sparse/SparseMatrix.c:SparseMatrix_set_entries_to_real_one
   */
  setEntriesToRealOne(): void {
    this.a = new Float64Array(this.nz).fill(1.0);
    this.type = MATRIX_TYPE_REAL;
  }

  /** @see sparse/SparseMatrix.c:SparseMatrix_copy */
  copy(): SparseMatrix {
    const B = SparseMatrix.new(this.m, this.n, this.nz, this.type, this.format);
    B.ia.set(this.ia);
    if (this.ia[this.m] !== 0) B.ja.set(this.ja.subarray(0, this.ia[this.m]));
    if (this.a !== null) {
      if (this.type === MATRIX_TYPE_REAL) (B.a as Float64Array).set((this.a as Float64Array).subarray(0, this.nz));
      else if (this.type === MATRIX_TYPE_INTEGER) (B.a as Int32Array).set((this.a as Int32Array).subarray(0, this.nz));
    }
    B.isPatternSymmetric = this.isPatternSymmetric;
    B.isSymmetric = this.isSymmetric;
    B.isUndirected = this.isUndirected;
    B.nz = this.nz;
    return B;
  }
}
