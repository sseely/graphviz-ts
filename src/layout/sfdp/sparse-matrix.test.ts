// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the SparseMatrix subset — fixtures verified against the C
 * semantics (entry order is part of the contract).
 */

import { describe, it, expect } from 'vitest';
import {
  smNew,
  smFromCoordinateArrays,
  smTranspose,
  smSymmetrize,
  smIsSymmetric,
  smRemoveDiagonal,
  smHasDiagonal,
  smDivideRowByDegree,
  smGetRealAdjacencySymmetrized,
  smMultiplyDense,
  smCoordAddEntry,
  smFromCoordinateFormat,
  MATRIX_TYPE_REAL,
  MATRIX_TYPE_PATTERN,
  FORMAT_COORD,
} from './sparse-matrix.js';
import {
  smMultiply,
  smMultiply3,
  smDecomposeToSupervariables,
} from './sparse-matrix-multiply.js';

/** 0--1, 1--2 path graph as directed COO (one direction). */
function pathCoo(): { irn: number[]; jcn: number[]; val: number[] } {
  return { irn: [0, 1], jcn: [1, 2], val: [1, 1] };
}

describe('smFromCoordinateArrays', () => {
  it('counting-sorts by row, keeping input order within rows', () => {
    const A = smFromCoordinateArrays(
      4, 2, 3,
      { irn: [1, 0, 1, 0], jcn: [2, 1, 0, 0], val: [5, 2, 3, 1] },
      MATRIX_TYPE_REAL);
    expect(A.ia).toEqual([0, 2, 4]);
    expect(A.ja).toEqual([1, 0, 2, 0]);
    expect(A.a).toEqual([2, 1, 5, 3]);
  });

  it('sums repeated entries at the first occurrence position', () => {
    const A = smFromCoordinateArrays(
      3, 1, 2,
      { irn: [0, 0, 0], jcn: [1, 0, 1], val: [2, 1, 7] },
      MATRIX_TYPE_REAL);
    expect(A.ia).toEqual([0, 2]);
    expect(A.ja).toEqual([1, 0]);
    expect(A.a).toEqual([9, 1]);
  });
});

describe('smTranspose / smSymmetrize', () => {
  it('transposes CSR with counting sort', () => {
    const A = smFromCoordinateArrays(2, 2, 3, pathCoo(), MATRIX_TYPE_REAL);
    const B = smTranspose(A);
    expect(B.m).toBe(3);
    expect(B.n).toBe(2);
    expect(B.ia).toEqual([0, 0, 1, 2]);
    expect(B.ja).toEqual([0, 1]);
  });

  it('symmetrize appends transpose entries after row entries', () => {
    const A = smFromCoordinateArrays(2, 3, 3, pathCoo(), MATRIX_TYPE_REAL);
    const S = smSymmetrize(A, false);
    expect(S.ia).toEqual([0, 1, 3, 4]);
    // row 1: own entry (col 2) first, then transposed (col 0)
    expect(S.ja).toEqual([1, 2, 0, 1]);
    expect(smIsSymmetric(S, false)).toBe(true);
  });
});

describe('diagonal helpers', () => {
  it('removes diagonal entries in place', () => {
    const A = smFromCoordinateArrays(
      3, 2, 2,
      { irn: [0, 0, 1], jcn: [0, 1, 1], val: [9, 1, 9] },
      MATRIX_TYPE_REAL);
    expect(smHasDiagonal(A)).toBe(true);
    smRemoveDiagonal(A);
    expect(A.ia).toEqual([0, 1, 1]);
    expect(A.ja).toEqual([1]);
    expect(smHasDiagonal(A)).toBe(false);
  });

  it('divides each row by its degree', () => {
    const A = smFromCoordinateArrays(
      3, 2, 2,
      { irn: [0, 0, 1], jcn: [0, 1, 0], val: [4, 2, 5] },
      MATRIX_TYPE_REAL);
    smDivideRowByDegree(A);
    expect(A.a).toEqual([2, 1, 5]);
  });
});

describe('smGetRealAdjacencySymmetrized', () => {
  it('returns unit-weight symmetric adjacency without diagonal', () => {
    const A = smFromCoordinateArrays(
      3, 3, 3,
      { irn: [0, 1, 1], jcn: [1, 1, 2], val: [3, 9, 4] },
      MATRIX_TYPE_REAL);
    const S = smGetRealAdjacencySymmetrized(A);
    expect(S.type).toBe(MATRIX_TYPE_REAL);
    expect(smHasDiagonal(S)).toBe(false);
    expect(S.a!.every((v) => v === 1)).toBe(true);
    expect(S.nz).toBe(4); // 0-1, 1-2 both directions
  });
});

describe('products', () => {
  it('smMultiply uses mask-append encounter order', () => {
    // A = [[1,2],[0,3]], B = [[4,0],[5,6]]
    const A = smFromCoordinateArrays(
      3, 2, 2, { irn: [0, 0, 1], jcn: [0, 1, 1], val: [1, 2, 3] },
      MATRIX_TYPE_REAL);
    const B = smFromCoordinateArrays(
      3, 2, 2, { irn: [0, 1, 1], jcn: [0, 0, 1], val: [4, 5, 6] },
      MATRIX_TYPE_REAL);
    const C = smMultiply(A, B);
    expect(C.ia).toEqual([0, 2, 4]);
    expect(C.ja).toEqual([0, 1, 0, 1]);
    expect(C.a).toEqual([14, 12, 15, 18]);
  });

  it('smMultiply3 equals R·A·P on a small case', () => {
    const I2 = smFromCoordinateArrays(
      2, 2, 2, { irn: [0, 1], jcn: [0, 1], val: [1, 1] }, MATRIX_TYPE_REAL);
    const A = smFromCoordinateArrays(
      3, 2, 2, { irn: [0, 0, 1], jcn: [0, 1, 0], val: [1, 2, 3] },
      MATRIX_TYPE_REAL);
    const D = smMultiply3(I2, A, I2);
    expect(D.ia).toEqual(A.ia);
    expect(D.ja).toEqual(A.ja);
    expect(D.a).toEqual(A.a);
  });

});

describe('smMultiplyDense', () => {
  it('computes A·V row-major', () => {
    const A = smFromCoordinateArrays(
      2, 2, 2, { irn: [0, 1], jcn: [1, 0], val: [2, 3] }, MATRIX_TYPE_REAL);
    const res = new Array<number>(4).fill(0);
    smMultiplyDense(A, [1, 10, 2, 20], res, 2);
    expect(res).toEqual([4, 40, 3, 30]);
  });
});

describe('smDecomposeToSupervariables', () => {
  it('groups columns with identical row patterns', () => {
    // 4-cycle adjacency: cols 0&2 share pattern {1,3}; 1&3 share {0,2}
    const coo = {
      irn: [0, 0, 1, 1, 2, 2, 3, 3],
      jcn: [1, 3, 0, 2, 1, 3, 0, 2],
      val: [1, 1, 1, 1, 1, 1, 1, 1],
    };
    const A = smFromCoordinateArrays(8, 4, 4, coo, MATRIX_TYPE_REAL);
    const { ncluster, cluster, clusterp } = smDecomposeToSupervariables(A);
    expect(ncluster).toBe(2);
    const groups: number[][] = [];
    for (let i = 0; i < ncluster; i++) {
      groups.push(cluster.slice(clusterp[i]!, clusterp[i + 1]!).sort((a, b) => a - b));
    }
    expect(groups).toContainEqual([0, 2]);
    expect(groups).toContainEqual([1, 3]);
  });
});

describe('COORD format', () => {
  it('add_entry + from_coordinate_format round-trips', () => {
    const A = smNew(1, 1, MATRIX_TYPE_REAL, FORMAT_COORD);
    smCoordAddEntry(A, 0, 1, 5);
    smCoordAddEntry(A, 1, 0, 7);
    expect(A.m).toBe(2);
    expect(A.n).toBe(2);
    const B = smFromCoordinateFormat(A);
    expect(B.ia).toEqual([0, 1, 2]);
    expect(B.ja).toEqual([1, 0]);
    expect(B.a).toEqual([5, 7]);
  });
});

describe('pattern matrices', () => {
  it('symmetrize works on PATTERN type', () => {
    const A = smFromCoordinateArrays(2, 3, 3, { ...pathCoo(), val: null }, MATRIX_TYPE_PATTERN);
    expect(A.a).toBeNull();
    const S = smSymmetrize(A, true);
    expect(S.nz).toBe(4);
  });
});
