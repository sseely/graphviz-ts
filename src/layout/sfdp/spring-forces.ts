// SPDX-License-Identifier: EPL-2.0
/**
 * Spring-electrical force computation helpers and embedding variants.
 *
 * @see lib/sfdpgen/spring_electrical.c
 */

import type { SparseMatrix } from '../../sparse/SparseMatrix.js';
import { symmetrize } from '../../sparse/SparseMatrixOps.js';
import { QuadTree, type ForceParams } from '../../sparse/QuadTree.js';
import { distance, distanceCropped } from '../../sparse/general.js';
import {
  type SpringElectricalControl,
  C_FORCE,
  BH,
  TOL,
  COOL,
  QUADTREE_SIZE,
  ERROR_NOT_SQUARE_MATRIX,
} from './spring-types.js';

// ---------------------------------------------------------------------------
// Reusable parameter bundles (reduce per-function param counts)
// ---------------------------------------------------------------------------

/** Packed CSR graph + coordinate context. */
export interface GraphCsr {
  ia: Int32Array;
  ja: Int32Array;
  x: Float64Array;
  dim: number;
  n: number;
}

/** Derived force amplitude constants. */
export interface ForceConst {
  KP: number;
  CRK: number;
  p: number;
  K: number;
}

/** Options for building an IterCtx. */
export interface IterOpts {
  dim: number;
  useQt: boolean;
}

/** Bundle for the shared iteration loop. */
export interface IterCtx {
  g: GraphCsr;
  fc: ForceConst;
  maxiter: number;
  useQt: boolean;
  maxQtreeLevel: number;
  params: ForceParams;
}

// ---------------------------------------------------------------------------
// Cooling / convergence
// ---------------------------------------------------------------------------

/**
 * Update the step size based on force norms (adaptive or fixed cooling).
 * @see lib/sfdpgen/spring_electrical.c:update_step
 */
export function updateStep(step: number, cool: number, fnorm: number, fnorm0: number): number {
  if (fnorm >= fnorm0) return step * cool;
  if (fnorm > 0.95 * fnorm0) return step;
  return step * 0.99 / cool;
}

// ---------------------------------------------------------------------------
// Average edge length
// ---------------------------------------------------------------------------

/**
 * Mean Euclidean edge length in current layout.
 * @see lib/sfdpgen/spring_electrical.c:average_edge_length
 */
export function averageEdgeLength(A: SparseMatrix, dim: number, coord: Float64Array): number {
  const ia = A.ia, ja = A.ja;
  if (ia[A.m] === 0) return 1;
  let dist = 0;
  for (let i = 0; i < A.m; i++) {
    for (let j = ia[i]; j < ia[i + 1]; j++) dist += distance(coord, dim, i, ja[j]);
  }
  return dist / ia[A.m];
}

// ---------------------------------------------------------------------------
// Power-law graph heuristic
// ---------------------------------------------------------------------------

/** Count non-self-loop degree for each node into a histogram. */
export function buildDegreeHistogram(A: SparseMatrix): { hist: Int32Array; maxCount: number } {
  const ia = A.ia, ja = A.ja, m = A.m;
  const hist = new Int32Array(m + 1);
  let maxCount = 0;
  for (let i = 0; i < m; i++) {
    let deg = 0;
    for (let j = ia[i]; j < ia[i + 1]; j++) if (i !== ja[j]) deg++;
    hist[deg]++;
    if (hist[deg] > maxCount) maxCount = hist[deg];
  }
  return { hist, maxCount };
}

/**
 * True if graph matches power-law degree distribution.
 * @see lib/sfdpgen/spring_electrical.c:power_law_graph
 */
export function powerLawGraph(A: SparseMatrix): boolean {
  const { hist, maxCount } = buildDegreeHistogram(A);
  return hist[1] > 0.8 * maxCount && hist[1] > 0.3 * A.m;
}

// ---------------------------------------------------------------------------
// Leaf beautification
// ---------------------------------------------------------------------------

/** Collect degree-1 neighbours of node p; return indices and mean dist. */
export function collectLeaves(g: GraphCsr, p: number, checked: Uint8Array): { leaves: number[]; avgDist: number } {
  const { ia, ja, x, dim } = g;
  let dist = 0;
  const leaves: number[] = [];
  for (let j = ia[p]; j < ia[p + 1]; j++) {
    const leaf = ja[j];
    if (ia[leaf + 1] - ia[leaf] !== 1) continue;
    checked[leaf] = 1;
    dist += distance(x, dim, p, leaf);
    leaves.push(leaf);
  }
  return { leaves, avgDist: leaves.length > 0 ? dist / leaves.length : 0 };
}

/** Place leaves evenly around parent p at radius avgDist. */
export function placeLeaves(g: GraphCsr, leaves: number[], p: number, avgDist: number): void {
  const { x, dim } = g;
  const pad = 0.1;
  const step = leaves.length > 1 ? (2 * Math.PI - 2 * pad) / leaves.length : 0;
  let ang = pad;
  for (const lf of leaves) {
    x[dim * lf] = Math.cos(ang) * avgDist + x[dim * p];
    x[dim * lf + 1] = Math.sin(ang) * avgDist + x[dim * p + 1];
    ang += step;
  }
}

/**
 * Evenly redistribute leaf nodes around their parent.
 * @see lib/sfdpgen/spring_electrical.c:beautify_leaves
 */
export function beautifyLeaves(dim: number, A: SparseMatrix, x: Float64Array): void {
  const ia = A.ia, ja = A.ja, m = A.m;
  const g: GraphCsr = { ia, ja, x, dim, n: m };
  const checked = new Uint8Array(m);
  for (let i = 0; i < m; i++) {
    if (ia[i + 1] - ia[i] !== 1 || checked[i]) continue;
    const p = ja[ia[i]];
    if (checked[p]) continue;
    checked[p] = 1;
    const { leaves, avgDist } = collectLeaves(g, p, checked);
    if (leaves.length > 0) placeLeaves(g, leaves, p, avgDist);
  }
}

// ---------------------------------------------------------------------------
// Shared position / force helpers
// ---------------------------------------------------------------------------

/** LCG random position initialisation matching C srand/drand. */
export function initPositions(ctrl: SpringElectricalControl, dim: number, n: number, x: Float64Array): void {
  if (!ctrl.randomStart) return;
  let seed = ctrl.randomSeed >>> 0;
  for (let i = 0; i < dim * n; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    x[i] = (seed >>> 0) / 0xffffffff;
  }
}

/** Resolve K and p, mutate ctrl, return derived force constants. */
export function resolveForceParams(ctrl: SpringElectricalControl, A: SparseMatrix, dim: number, x: Float64Array): ForceConst {
  let { p, K } = ctrl;
  if (K < 0) { ctrl.K = K = averageEdgeLength(A, dim, x); }
  if (p >= 0) { ctrl.p = p = -1; }
  return { KP: Math.pow(K, 1 - p), CRK: Math.pow(C_FORCE, (2 - p) / 3) / K, p, K };
}

// ---------------------------------------------------------------------------
// Repulsive / attractive force computation
// ---------------------------------------------------------------------------

/** Repulsive contribution from j onto node i's force entry. */
export function addRepulsivePair(g: GraphCsr, fc: ForceConst, i: number, j: number, force: Float64Array): void {
  const { x, dim } = g;
  const dist = distanceCropped(x, dim, i, j);
  const scale = fc.KP / Math.pow(dist, 1 - fc.p);
  for (let k = 0; k < dim; k++) force[i * dim + k] += scale * (x[i * dim + k] - x[j * dim + k]);
}

/**
 * O(n²) all-pairs repulsive forces.
 * @see lib/sfdpgen/spring_electrical.c (slow embedding inner loop)
 */
export function computeRepulsiveSlow(g: GraphCsr, fc: ForceConst, force: Float64Array): void {
  const { n } = g;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j !== i) addRepulsivePair(g, fc, i, j, force);
    }
  }
}

/**
 * Attractive forces along graph edges.
 * @see lib/sfdpgen/spring_electrical.c (attractive force loop)
 */
export function computeAttractive(g: GraphCsr, CRK: number, force: Float64Array): void {
  const { n, dim, ia, ja, x } = g;
  for (let i = 0; i < n; i++) {
    for (let jj = ia[i]; jj < ia[i + 1]; jj++) {
      const j = ja[jj];
      if (j === i) continue;
      const dist = distance(x, dim, i, j);
      for (let k = 0; k < dim; k++) {
        force[i * dim + k] -= CRK * (x[i * dim + k] - x[j * dim + k]) * dist;
      }
    }
  }
}

/** Normalise and apply force for one node; return |F|. */
export function applyNodeForce(i: number, dim: number, x: Float64Array, force: Float64Array, step: number): number {
  let F = 0;
  for (let k = 0; k < dim; k++) F += force[i * dim + k] * force[i * dim + k];
  F = Math.sqrt(F);
  if (F > 0) for (let k = 0; k < dim; k++) x[i * dim + k] += step * force[i * dim + k] / F;
  return F;
}

/** Normalise forces, move all nodes, return total force norm. */
export function applyForces(g: GraphCsr, force: Float64Array, step: number): number {
  let fnorm = 0;
  for (let i = 0; i < g.n; i++) fnorm += applyNodeForce(i, g.dim, g.x, force, step);
  return fnorm;
}

// ---------------------------------------------------------------------------
// Iteration loop
// ---------------------------------------------------------------------------

/** Apply repulsive forces via quadtree or O(n²). */
export function applyRepulsive(ctx: IterCtx, force: Float64Array, counts: Float64Array): void {
  if (ctx.useQt) {
    const qt = QuadTree.newFromPointList(ctx.g.dim, ctx.g.n, ctx.maxQtreeLevel, ctx.g.x);
    qt.getRepulsiveForce(force, ctx.g.x, ctx.params, counts);
  } else {
    computeRepulsiveSlow(ctx.g, ctx.fc, force);
  }
}

/** One force iteration: repulsive + attractive + move. Returns new fnorm. */
export function oneIteration(ctx: IterCtx, force: Float64Array, counts: Float64Array, step: number): number {
  force.fill(0);
  applyRepulsive(ctx, force, counts);
  computeAttractive(ctx.g, ctx.fc.CRK, force);
  return applyForces(ctx.g, force, step);
}

/**
 * Run force iterations until convergence or maxiter.
 * @see lib/sfdpgen/spring_electrical.c (main do-while loop)
 */
export function runIterationLoop(ctx: IterCtx, force: Float64Array, counts: Float64Array, initStep: number): void {
  let step = initStep, fnorm = 0, fnorm0 = 0, iter = 0;
  do {
    iter++; fnorm0 = fnorm;
    fnorm = oneIteration(ctx, force, counts, step);
    step = updateStep(step, COOL, fnorm, fnorm0);
  } while (step > TOL && iter < ctx.maxiter);
}

/**
 * Build an IterCtx from resolved parameters.
 * opts.dim: coordinate dimension; opts.useQt: whether to use Barnes-Hut.
 */
export function buildIterCtx(A: SparseMatrix, ctrl: SpringElectricalControl, x: Float64Array, fc: ForceConst, opts: IterOpts): IterCtx {
  const g: GraphCsr = { ia: A.ia, ja: A.ja, x, dim: opts.dim, n: A.n };
  return {
    g, fc, maxiter: ctrl.maxiter, useQt: opts.useQt,
    maxQtreeLevel: ctrl.maxQtreeLevel,
    params: { bh: BH, p: fc.p, KP: fc.KP },
  };
}

// ---------------------------------------------------------------------------
// O(n²) embedding (slow path)
// ---------------------------------------------------------------------------

/**
 * @see lib/sfdpgen/spring_electrical.c:spring_electrical_embedding_slow
 */
export function embedSlow(dim: number, A: SparseMatrix, ctrl: SpringElectricalControl, x: Float64Array, flag: { value: number }): void {
  if (A.m !== A.n) { flag.value = ERROR_NOT_SQUARE_MATRIX; return; }
  initPositions(ctrl, dim, A.n, x);
  const fc = resolveForceParams(ctrl, A, dim, x);
  const ctx = buildIterCtx(A, ctrl, x, fc, { dim, useQt: false });
  runIterationLoop(ctx, new Float64Array(dim * A.n), new Float64Array(4), ctrl.step);
  if (ctrl.beautifyLeaves) beautifyLeaves(dim, A, x);
}

// ---------------------------------------------------------------------------
// Fast embedding (bulk Barnes-Hut)
// ---------------------------------------------------------------------------

/**
 * Force iteration with bulk Barnes-Hut quadtree.
 * @see lib/sfdpgen/spring_electrical.c:spring_electrical_embedding_fast
 */
export function springElectricalEmbeddingFast(dim: number, A0: SparseMatrix, ctrl: SpringElectricalControl, x: Float64Array, flag: { value: number }): void {
  if (A0.m !== A0.n) { flag.value = ERROR_NOT_SQUARE_MATRIX; return; }
  const A = symmetrize(A0, true);
  initPositions(ctrl, dim, A.n, x);
  const fc = resolveForceParams(ctrl, A, dim, x);
  const ctx = buildIterCtx(A, ctrl, x, fc, { dim, useQt: true });
  runIterationLoop(ctx, new Float64Array(dim * A.n), new Float64Array(4), ctrl.step);
  if (ctrl.beautifyLeaves) beautifyLeaves(dim, A, x);
}

// ---------------------------------------------------------------------------
// Normal embedding (per-vertex Barnes-Hut or O(n²))
// ---------------------------------------------------------------------------

/**
 * Force iteration with per-vertex Barnes-Hut or O(n²) fallback.
 * @see lib/sfdpgen/spring_electrical.c:spring_electrical_embedding
 */
export function springElectricalEmbedding(dim: number, A0: SparseMatrix, ctrl: SpringElectricalControl, x: Float64Array, flag: { value: number }): void {
  if (A0.m !== A0.n) { flag.value = ERROR_NOT_SQUARE_MATRIX; return; }
  const A = symmetrize(A0, true);
  initPositions(ctrl, dim, A.n, x);
  const fc = resolveForceParams(ctrl, A, dim, x);
  const ctx = buildIterCtx(A, ctrl, x, fc, { dim, useQt: A.n >= QUADTREE_SIZE });
  runIterationLoop(ctx, new Float64Array(dim * A.n), new Float64Array(4), ctrl.step);
  if (ctrl.beautifyLeaves) beautifyLeaves(dim, A, x);
}
