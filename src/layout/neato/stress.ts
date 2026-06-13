// SPDX-License-Identifier: EPL-2.0
/**
 * Stress majorization layout engine for neato.
 *
 * Ports lib/neatogen/stress.c: stress_majorization_kD_mkernel and helpers.
 * Kahan summation replaces C's `long double DegType` for diagonal accumulation.
 *
 * Implementation note: all logic lives in static class methods. Lizard 1.22.1
 * loses function boundaries between consecutive top-level functions — it
 * correctly resets its parser at class boundaries. Thin exported wrappers
 * delegate to static methods so the public API is unchanged.
 *
 * @see lib/neatogen/stress.c
 * @see lib/neatogen/stress.h
 */

import type { VtxData } from './dijkstra.js';
import {
  computeApspPacked,
  computeWeightedApspPacked,
  packedIndex,
} from './bfs.js';
import { rightMultVecFF, conjugateGradientMkernel } from './conjgrad.js';

// ---------------------------------------------------------------------------
// Public constants — must match stress.h exactly
// ---------------------------------------------------------------------------

/** Inner CG solver tolerance. @see lib/neatogen/stress.h:tolerance_cg */
export const TOLERANCE_CG = 1e-3;

/** Default max outer iterations. @see lib/neatogen/stress.h:DFLT_ITERATIONS */
export const DFLT_ITERATIONS = 200;

/** Outer stress convergence epsilon. @see lib/neatogen/stress.h:DFLT_TOLERANCE */
export const DFLT_TOLERANCE = 1e-4;

/** Smart-init flag in opts bitmask. */
export const OPT_SMART_INIT = 0x4;

/** Exponent flag in opts bitmask (exp=2 when set, exp=1 when clear). */
export const OPT_EXP_FLAG = 0x3;

/** Model: MDS (user-supplied edge lengths). */
export const MODEL_MDS = 1;

/** Model: circuit (effective resistance, falls back to BFS). */
export const MODEL_CIRCUIT = 2;

/** Model: subset (degree-reweighted BFS). */
export const MODEL_SUBSET = 3;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Kahan compensated-summation accumulator for Laplacian diagonal. */
export interface KahanAcc { sum: number; c: number; }

/** Argument bundle for stressMajorizationKD — keeps param count ≤5. */
export interface StressOpts {
  dim: number;
  opts: number;
  model: number;
  maxi: number;
  /**
   * Distance exponent: 1 (default) or 2.
   * Derived from opts bitmask inside stressMajorizationKD and injected
   * into the bundle before each inner-loop call; not supplied by callers.
   * @see lib/neatogen/stress.c:stress_majorization_kD_mkernel (exp assignment)
   */
  exp?: number;
}

/** Context bundle for position Laplacian construction. */
export interface Lap1Ctx {
  coords: Float32Array[];
  lap1: Float32Array;
  lap2: Float32Array;
  degrees: KahanAcc[];
  n: number;
  dim: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// KahanHelper — compensated summation (replaces C's long double DegType)
// @see lib/neatogen/stress.c (DegType comment)
// ---------------------------------------------------------------------------

/** Kahan summation helpers. */
export class KahanHelper {
  /** Add `v` to `acc` with Kahan compensation. */
  static add(acc: KahanAcc, v: number): void {
    const y = v - acc.c;
    const t = acc.sum + y;
    acc.c = (t - acc.sum) - y;
    acc.sum = t;
  }

  /** Allocate n zero-initialised KahanAcc entries. */
  static makeArr(n: number): KahanAcc[] {
    const arr: KahanAcc[] = [];
    for (let i = 0; i < n; i++) arr.push({ sum: 0, c: 0 });
    return arr;
  }
}

// ---------------------------------------------------------------------------
// Lap2Helper — weight Laplacian construction
// @see lib/neatogen/stress.c (Laplacian section)
// ---------------------------------------------------------------------------

/** Helpers for building and using the weight Laplacian lap2. */
export class Lap2Helper {
  /** Invert non-zero packed entries in-place. */
  static invertPacked(Dij: Float32Array): void {
    for (let k = 0; k < Dij.length; k++) {
      Dij[k] = Dij[k] === 0 ? 0 : 1 / Dij[k];
    }
  }

  /** Accumulate off-diagonal row i into degrees[] via Kahan. */
  static accumRow(Dij: Float32Array, degrees: KahanAcc[], n: number, i: number): void {
    let count = packedIndex(i, i, n) + 1;
    for (let j = 1; j < n - i; j++, count++) {
      KahanHelper.add(degrees[i], -Dij[count]);
      KahanHelper.add(degrees[i + j], -Dij[count]);
    }
  }

  /** Write Kahan sums into packed diagonal entries of arr. */
  static writeDiag(arr: Float32Array, degrees: KahanAcc[], n: number): void {
    let step = n;
    for (let i = 0, idx = 0; i < n; i++, idx += step, step--) {
      arr[idx] = degrees[i].sum;
    }
  }

  /**
   * Build weight Laplacian from packed Dij in-place.
   * Off-diagonal w_ij = 1/d^exp; diagonal via Kahan summation.
   * @see lib/neatogen/stress.c (Laplacian section)
   */
  static buildLap2(Dij: Float32Array, n: number, exp: number): void {
    if (exp === 2) {
      for (let k = 0; k < Dij.length; k++) Dij[k] *= Dij[k];
    }
    Lap2Helper.invertPacked(Dij);
    const degrees = KahanHelper.makeArr(n);
    for (let i = 0; i < n - 1; i++) Lap2Helper.accumRow(Dij, degrees, n, i);
    Lap2Helper.writeDiag(Dij, degrees, n);
  }
}

/** @see Lap2Helper.buildLap2 */
export function buildLap2(Dij: Float32Array, n: number, exp: number): void {
  Lap2Helper.buildLap2(Dij, n, exp);
}

// ---------------------------------------------------------------------------
// Lap1Helper — position Laplacian construction
// @see lib/neatogen/stress.c (inner Laplacian construction loop)
// ---------------------------------------------------------------------------

/** Helpers for building position Laplacian lap1. */
export class Lap1Helper {
  /** Squared Euclidean distance between node i and node i+1+j. */
  static squaredDist(ctx: Lap1Ctx, i: number, j: number): number {
    let d2 = 0;
    for (let k = 0; k < ctx.dim; k++) {
      const diff = ctx.coords[k][i] - ctx.coords[k][i + 1 + j];
      d2 += diff * diff;
    }
    return d2;
  }

  /** Compute invDist[0..n-i-2] = 1/dist clamped for overflow. */
  static computeInvDist(ctx: Lap1Ctx, i: number, invDist: Float32Array): void {
    const len = ctx.n - i - 1;
    for (let j = 0; j < len; j++) {
      const d2 = Lap1Helper.squaredDist(ctx, i, j);
      const v = d2 > 0 ? 1 / Math.sqrt(d2) : 0;
      invDist[j] = v >= 3.4028235e+38 || v < 0 ? 0 : v;
    }
  }

  /** Fill off-diagonal entries for row i; accumulate into degrees[]. */
  static fillRow(ctx: Lap1Ctx, invDist: Float32Array, i: number): void {
    const len = ctx.n - i - 1;
    let count = packedIndex(i, i, ctx.n) + 1;
    for (let j = 0; j < len; j++, count++) {
      const val = ctx.exp === 2 ? ctx.lap2[count] * invDist[j] : invDist[j];
      ctx.lap1[count] = val;
      KahanHelper.add(ctx.degrees[i], -val);
      KahanHelper.add(ctx.degrees[i + j + 1], -val);
    }
  }

  /** Seed lap1 off-diagonals with sqrt(lap2) for exp=2. */
  static seedSqrt(ctx: Lap1Ctx): void {
    for (let k = 0; k < ctx.lap1.length; k++) {
      ctx.lap1[k] = ctx.lap2[k] >= 0 ? Math.sqrt(ctx.lap2[k]) : 0;
    }
  }

  /**
   * Build position-weighted Laplacian from current coords.
   * @see lib/neatogen/stress.c (inner Laplacian construction loop)
   */
  static buildLap1(ctx: Lap1Ctx): void {
    if (ctx.exp === 2) Lap1Helper.seedSqrt(ctx);
    const invDist = new Float32Array(ctx.n);
    for (let i = 0; i < ctx.n - 1; i++) {
      Lap1Helper.computeInvDist(ctx, i, invDist);
      Lap1Helper.fillRow(ctx, invDist, i);
    }
    Lap2Helper.writeDiag(ctx.lap1, ctx.degrees, ctx.n);
  }
}

/** @see Lap1Helper.buildLap1 */
export function buildLap1(ctx: Lap1Ctx): void { Lap1Helper.buildLap1(ctx); }

// ---------------------------------------------------------------------------
// StressHelper — stress value computation
// @see lib/neatogen/stress.c (new_stress computation block)
// ---------------------------------------------------------------------------

/** Stress and quadratic form helpers. */
export class StressHelper {
  /** Compute coords[k] · (Lap * coords[k]) summed over k. */
  static quadForm(coords: Float32Array[], lap: Float32Array, dim: number, n: number): number {
    const tmp = new Float32Array(n);
    let s = 0;
    for (let k = 0; k < dim; k++) {
      rightMultVecFF(lap, n, coords[k], tmp);
      for (let j = 0; j < n; j++) s += coords[k][j] * tmp[j];
    }
    return s;
  }

  /**
   * Compute stress = 2·trace(X'L1X) + n(n-1)/2 - trace(X'L2X).
   * @see lib/neatogen/stress.c (new_stress computation block)
   */
  static computeStress(coords: Float32Array[], lap1: Float32Array, lap2: Float32Array, dim: number, n: number): number {
    const constant = (n * (n - 1)) / 2;
    return 2 * StressHelper.quadForm(coords, lap1, dim, n)
      + constant
      - StressHelper.quadForm(coords, lap2, dim, n);
  }
}

/** @see StressHelper.computeStress */
export function computeStress(coords: Float32Array[], lap1: Float32Array, lap2: Float32Array, dim: number, n: number): number {
  return StressHelper.computeStress(coords, lap1, lap2, dim, n);
}

// ---------------------------------------------------------------------------
// DijHelper — distance model dispatch
// @see lib/neatogen/stress.c (Dij selection block)
// ---------------------------------------------------------------------------

/** Distance model and orthogonalization helpers. */
export class DijHelper {
  /** True if any edge has a non-unit weight. */
  static hasNonUnitWeights(graph: VtxData[]): boolean {
    for (const vd of graph) {
      for (let i = 1; i < vd.nedges; i++) {
        if (vd.ewgts[i] !== 1) return true;
      }
    }
    return false;
  }

  /**
   * Compute packed APSP for the given model.
   * MODEL_CIRCUIT falls back to BFS (not yet ported).
   */
  static computeDij(graph: VtxData[], n: number, model: number): Float32Array {
    if (model === MODEL_MDS || model === MODEL_SUBSET) {
      return computeWeightedApspPacked(graph, n);
    }
    return DijHelper.hasNonUnitWeights(graph)
      ? computeWeightedApspPacked(graph, n)
      : computeApspPacked(graph, n);
  }

  /** Orthogonalize a Float64Array against the constant vector. */
  static orthog1d(n: number, v: Float64Array): void {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += v[i];
    const mean = sum / n;
    for (let i = 0; i < n; i++) v[i] -= mean;
  }
}

// ---------------------------------------------------------------------------
// CoordHelper — coordinate conversion and initialization
// ---------------------------------------------------------------------------

/** Coordinate helpers: conversion, copying, random initialization. */
export class CoordHelper {
  /** Copy a Float64Array axis into a new Float32Array. */
  static toF32(src: Float64Array, n: number): Float32Array {
    const dst = new Float32Array(n);
    for (let i = 0; i < n; i++) dst[i] = src[i];
    return dst;
  }

  /** Build dim Float32 working arrays from dCoords. */
  static makeFloat(dCoords: Float64Array[], dim: number, n: number): Float32Array[] {
    const coords: Float32Array[] = [];
    for (let d = 0; d < dim; d++) coords.push(CoordHelper.toF32(dCoords[d], n));
    return coords;
  }

  /** Copy Float32 working coords back to Float64 output. */
  static copyBack(coords: Float32Array[], dCoords: Float64Array[], dim: number, n: number): void {
    for (let d = 0; d < dim; d++) {
      for (let i = 0; i < n; i++) dCoords[d][i] = coords[d][i];
    }
  }

  /**
   * Initialise dCoords from rng() and orthogonalize each axis.
   * @see lib/neatogen/stress.c:initLayout (random branch)
   */
  static initRandom(n: number, dim: number, dCoords: Float64Array[], rng: () => number): void {
    for (let d = 0; d < dim; d++) {
      for (let i = 0; i < n; i++) dCoords[d][i] = rng();
      DijHelper.orthog1d(n, dCoords[d]);
    }
  }
}

/** @see CoordHelper.initRandom */
export function initCoords(n: number, dim: number, dCoords: Float64Array[], rng: () => number): void {
  CoordHelper.initRandom(n, dim, dCoords, rng);
}

// ---------------------------------------------------------------------------
// SolveHelper — CG solve per axis
// ---------------------------------------------------------------------------

/** CG solver helpers. */
export class SolveHelper {
  /** Solve one axis via CG. Returns true on failure. */
  static solveAxis(lap2: Float32Array, coord: Float32Array, bk: Float32Array, n: number): boolean {
    return conjugateGradientMkernel(lap2, coord, bk, n, { tol: TOLERANCE_CG, maxIterations: n }) !== 0;
  }

  /** Solve all dim axes. Returns true if any fails. */
  static solveAll(coords: Float32Array[], b: Float32Array[], lap2: Float32Array, dim: number, n: number): boolean {
    for (let k = 0; k < dim; k++) {
      if (SolveHelper.solveAxis(lap2, coords[k], b[k], n)) return true;
    }
    return false;
  }

  /** Compute b[k] = lap1 * coords[k] for all axes. */
  static computeB(lap1: Float32Array, coords: Float32Array[], b: Float32Array[], dim: number, n: number): void {
    for (let k = 0; k < dim; k++) rightMultVecFF(lap1, n, coords[k], b[k]);
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** Inner loop body for one outer majorization iteration. Returns true on CG failure. */
class MajorizationLoop {
  static runIter(coords: Float32Array[], b: Float32Array[], lap1: Float32Array, lap2: Float32Array, sopts: StressOpts): boolean {
    const { dim } = sopts;
    // exp is always injected by stressMajorizationKD before this call; default
    // to 1 (linear) to satisfy the type system — the undefined path is unreachable.
    const exp: number = sopts.exp ?? 1;
    const n = coords[0].length;
    const ctx: Lap1Ctx = { coords, lap1, lap2, degrees: KahanHelper.makeArr(n), n, dim, exp };
    Lap1Helper.buildLap1(ctx);
    SolveHelper.computeB(lap1, coords, b, dim, n);
    return SolveHelper.solveAll(coords, b, lap2, dim, n);
  }

  static checkConverged(newStress: number, oldStress: number): boolean {
    return Math.abs(oldStress - newStress) / oldStress < DFLT_TOLERANCE
      || newStress < DFLT_TOLERANCE;
  }
}

/**
 * Full dense k-D stress majorization (Kamada-Kawai energy minimization).
 * Returns iteration count or -1 on CG failure.
 * @see lib/neatogen/stress.c:stress_majorization_kD_mkernel
 */
export function stressMajorizationKD(graph: VtxData[], n: number, dCoords: Float64Array[], sopts: StressOpts): number {
  const { dim, opts, model, maxi } = sopts;
  if (maxi < 0 || n <= 1 || maxi === 0) return 0;
  const exp = (opts & OPT_EXP_FLAG) !== 0 ? 2 : 1;
  const lap2 = DijHelper.computeDij(graph, n, model);
  Lap2Helper.buildLap2(lap2, n, exp);
  const coords = CoordHelper.makeFloat(dCoords, dim, n);
  const b: Float32Array[] = [];
  for (let k = 0; k < dim; k++) b.push(new Float32Array(n));
  const lap1 = new Float32Array((n * (n + 1)) / 2);
  let oldStress = Number.MAX_VALUE;
  let iterations = 0;
  for (iterations = 0; iterations < maxi; iterations++) {
    if (MajorizationLoop.runIter(coords, b, lap1, lap2, { ...sopts, exp })) {
      CoordHelper.copyBack(coords, dCoords, dim, n);
      return -1;
    }
    const newStress = StressHelper.computeStress(coords, lap1, lap2, dim, n);
    if (MajorizationLoop.checkConverged(newStress, oldStress)) break;
    oldStress = newStress;
  }
  CoordHelper.copyBack(coords, dCoords, dim, n);
  return iterations;
}
