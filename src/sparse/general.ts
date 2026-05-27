// SPDX-License-Identifier: EPL-2.0
/**
 * General utility constants and functions ported from lib/sparse/general.h
 * and lib/sparse/general.c.
 *
 * @see sparse/general.h
 * @see sparse/general.c
 */

/** @see sparse/general.h:MACHINEACC */
export const MACHINEACC = 1.0e-16;

/** @see sparse/general.h:SQRT_MACHINEACC */
export const SQRT_MACHINEACC = 1.0e-8;

/** @see sparse/general.h:MINDIST */
export const MINDIST = 1.0e-15;

/** @see SparseMatrix.h:SYMMETRY_EPSILON */
export const SYMMETRY_EPSILON = 0.0000001;

/**
 * Euclidean distance between points i and j in a flat coordinate array.
 * @see sparse/general.c:distance
 */
export function distance(x: Float64Array, dim: number, i: number, j: number): number {
  let dist = 0.0;
  for (let k = 0; k < dim; k++) {
    const d = x[i * dim + k] - x[j * dim + k];
    dist += d * d;
  }
  return Math.sqrt(dist);
}

/**
 * Distance between points i and j, clamped to MINDIST.
 * @see sparse/general.c:distance_cropped
 */
export function distanceCropped(x: Float64Array, dim: number, i: number, j: number): number {
  return Math.max(distance(x, dim, i, j), MINDIST);
}

/**
 * Euclidean distance between two coordinate arrays p1 and p2.
 * @see sparse/general.c:point_distance
 */
export function pointDistance(p1: Float64Array | number[], p2: Float64Array | number[], dim: number): number {
  let dist = 0.0;
  for (let i = 0; i < dim; i++) {
    const d = p1[i] - p2[i];
    dist += d * d;
  }
  return Math.sqrt(dist);
}

/**
 * y = x - y
 * @see sparse/general.c:vector_subtract_to
 */
export function vectorSubtractTo(n: number, x: Float64Array, y: Float64Array): Float64Array {
  for (let i = 0; i < n; i++) y[i] = x[i] - y[i];
  return y;
}

/**
 * Dot product of x and y.
 * @see sparse/general.c:vector_product
 */
export function vectorProduct(n: number, x: Float64Array, y: Float64Array): number {
  let res = 0.0;
  for (let i = 0; i < n; i++) res += x[i] * y[i];
  return res;
}

/**
 * y = x + beta * y
 * @see sparse/general.c:vector_saxpy
 */
export function vectorSaxpy(n: number, x: Float64Array, y: Float64Array, beta: number): Float64Array {
  for (let i = 0; i < n; i++) y[i] = x[i] + beta * y[i];
  return y;
}

/**
 * x = x + beta * y
 * @see sparse/general.c:vector_saxpy2
 */
export function vectorSaxpy2(n: number, x: Float64Array, y: Float64Array, beta: number): Float64Array {
  for (let i = 0; i < n; i++) x[i] = x[i] + beta * y[i];
  return x;
}

/**
 * Sort indices by ascending value.
 * @see sparse/general.c:vector_ordering
 */
export function vectorOrdering(n: number, v: Float64Array): Int32Array {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) pairs.push([v[i], i]);
  pairs.sort((a, b) => a[0] - b[0]);
  const p = new Int32Array(n);
  for (let i = 0; i < n; i++) p[i] = pairs[i][1];
  return p;
}

/**
 * Sort integer array in ascending order in-place.
 * @see sparse/general.c:vector_sort_int
 */
export function vectorSortInt(v: Int32Array): void {
  const arr = Array.from(v);
  arr.sort((a, b) => a - b);
  for (let i = 0; i < v.length; i++) v[i] = arr[i];
}

/**
 * Pseudo-random number in [0, 1).
 * @see sparse/general.c:drand
 */
export function drand(): number {
  return Math.random();
}
