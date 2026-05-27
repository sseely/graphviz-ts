// SPDX-License-Identifier: EPL-2.0
/**
 * Sparse module tests — acceptance criteria for T16.
 *
 * All expected values derived from the C source in lib/sparse/.
 * Assertions are immutable per AD-13.
 */

import { describe, it, expect } from "vitest";
import {
  SparseMatrix,
  FORMAT_COORD,
  MATRIX_TYPE_REAL,
} from "./SparseMatrix.js";
import { QuadTree } from "./QuadTree.js";

describe("SparseMatrix: CSR/COO multiply (AC1)", () => {
  it("produces identical results for all-ones and explicit vector", () => {
    const irn = new Int32Array([0, 0, 1, 1, 2]);
    const jcn = new Int32Array([0, 1, 0, 1, 2]);
    const val = new Float64Array([1, 2, 3, 4, 5]);
    const coo = SparseMatrix.new(3, 3, 5, MATRIX_TYPE_REAL, FORMAT_COORD);
    coo.addEntry(0, 0, 1); coo.addEntry(0, 1, 2);
    coo.addEntry(1, 0, 3); coo.addEntry(1, 1, 4);
    coo.addEntry(2, 2, 5);
    const csr = coo.fromCoordinateFormat();
    const csr2 = SparseMatrix.fromCoordinateArrays(5, 3, 3, irn, jcn, val, MATRIX_TYPE_REAL);
    const v = new Float64Array([1, 1, 1]);
    expect(Array.from(csr.multiplyVector(v))).toEqual([3, 7, 5]);
    expect(Array.from(csr2.multiplyVector(v))).toEqual([3, 7, 5]);
    expect(Array.from(csr.multiplyVector(null))).toEqual([3, 7, 5]);
  });
});

describe("SparseMatrix: type checks and repeat-entry summing (AC3/AC4)", () => {
  it("AC3: REAL matrix uses Float64Array for values", () => {
    const A = SparseMatrix.new(3, 3, 5, MATRIX_TYPE_REAL, FORMAT_COORD);
    A.addEntry(0, 0, 1);
    const csr = A.fromCoordinateFormat();
    expect(csr.a).toBeInstanceOf(Float64Array);
  });

  it("AC4: fromCoordinateFormat sums repeated entries at the same (row,col)", () => {
    const coo = SparseMatrix.new(1, 1, 2, MATRIX_TYPE_REAL, FORMAT_COORD);
    coo.addEntry(0, 0, 1);
    coo.addEntry(0, 0, 2);
    const csr = coo.fromCoordinateFormat();
    expect(csr.ia[1] - csr.ia[0]).toBe(1);
    expect((csr.a as Float64Array)[0]).toBe(3);
  });
});

describe("QuadTree: boundary insert and nearest query (AC2)", () => {
  it("getNearest returns the point inserted at center + width", () => {
    const center = new Float64Array([0.0, 0.0]);
    const qt = QuadTree.newQt(2, center, 1.0, 10);
    qt.add(new Float64Array([1.0, 0.0]), 1.0, 0);
    const result = qt.getNearest(new Float64Array([1.0, 0.0]));
    expect(result.imin).toBe(0);
    expect(result.min).toBeCloseTo(0.0, 10);
    expect(result.ymin[0]).toBeCloseTo(1.0, 10);
    expect(result.ymin[1]).toBeCloseTo(0.0, 10);
  });
});

describe("QuadTree: construction and structural invariants", () => {
  it("newFromPointList builds a valid tree from flat coords", () => {
    const coord = new Float64Array([0, 0, 1, 0, 0, 1, 1, 1]);
    const qt = QuadTree.newFromPointList(2, 4, 5, coord);
    expect(qt.n).toBe(4);
    expect(qt.dim).toBe(2);
    expect(qt.width).toBeCloseTo(0.52, 10);
  });

  it("getNearest selects closest point from multiple inserts", () => {
    const coord = new Float64Array([0, 0, 10, 0, 5, 5]);
    const qt = QuadTree.newFromPointList(2, 3, 5, coord);
    const r = qt.getNearest(new Float64Array([9.9, 0.1]));
    expect(r.imin).toBe(1);
  });

  it("_getQuadrant bit decomposition matches C reference (dim=2)", () => {
    const qt = QuadTree.newQt(2, new Float64Array([0.0, 0.0]), 2.0, 5);
    expect(qt._getQuadrant(new Float64Array([1.0, 0.0]))).toBe(3);
    expect(qt._getQuadrant(new Float64Array([-1.0, 0.0]))).toBe(2);
    expect(qt._getQuadrant(new Float64Array([-1.0, -1.0]))).toBe(0);
    expect(qt._getQuadrant(new Float64Array([1.0, -1.0]))).toBe(1);
  });
});
