// SPDX-License-Identifier: EPL-2.0
/**
 * Core spring-electrical force model and multilevel driver.
 *
 * @see lib/sfdpgen/spring_electrical.c
 * @see lib/sfdpgen/spring_electrical.h
 */

import {
  SparseMatrix,
  MATRIX_TYPE_REAL,
} from '../../sparse/SparseMatrix.js';
import {
  symmetrize,
  getRealAdjacencyMatrixSymmetrized,
  isSymmetric,
} from '../../sparse/SparseMatrixOps.js';
import { QuadTree, type ForceParams } from '../../sparse/QuadTree.js';
import { distance, distanceCropped, MINDIST } from '../../sparse/general.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @see lib/sfdpgen/spring_electrical.h:AUTOP */
export const AUTOP = -1.0001234;

/** @see lib/sfdpgen/spring_electrical.c:C */
const C_FORCE = 0.2;

/** @see lib/sfdpgen/spring_electrical.c:quadtree_size */
const QUADTREE_SIZE = 45;

/** @see lib/sfdpgen/spring_electrical.c:bh */
const BH = 0.6;

/** @see lib/sfdpgen/spring_electrical.c:tol */
const TOL = 0.001;

/** @see lib/sfdpgen/spring_electrical.c:cool */
const COOL = 0.90;

/** @see lib/sfdpgen/spring_electrical.h:ERROR_NOT_SQUARE_MATRIX */
export const ERROR_NOT_SQUARE_MATRIX = -100;

/** @see lib/sfdpgen/spring_electrical.h:SMOOTHING_NONE */
export const SMOOTHING_NONE = 0;
export const SMOOTHING_STRESS_MAJORIZATION_GRAPH_DIST = 1;
export const SMOOTHING_STRESS_MAJORIZATION_AVG_DIST = 2;
export const SMOOTHING_STRESS_MAJORIZATION_POWER_DIST = 3;
export const SMOOTHING_SPRING = 4;

/** @see lib/sfdpgen/spring_electrical.h:QUAD_TREE_* */
export const QUAD_TREE_NONE = 0;
export const QUAD_TREE_NORMAL = 1;
export const QUAD_TREE_FAST = 2;
export const QUAD_TREE_HYBRID = 3;
export const QUAD_TREE_HYBRID_SIZE = 10000;

// ---------------------------------------------------------------------------
// Control struct
// ---------------------------------------------------------------------------

/**
 * Configuration for the spring-electrical force model.
 * @see lib/sfdpgen/spring_electrical.h:spring_electrical_control
 */
export interface SpringElectricalControl {
  p: number;
  K: number;
  multilevels: number;
  maxQtreeLevel: number;
  maxiter: number;
  step: number;
  randomSeed: number;
  randomStart: boolean;
  adaptiveCooling: boolean;
  beautifyLeaves: boolean;
  smoothing: number;
  overlap: number;
  doShrinking: boolean;
  tscheme: number;
  initialScaling: number;
  rotation: number;
  edgeLabelingScheme: number;
}

/**
 * Default-initialize a SpringElectricalControl.
 * @see lib/sfdpgen/spring_electrical.c:spring_electrical_control_new
 */
export function springElectricalControlNew(): SpringElectricalControl {
  return {
    p: AUTOP,
    K: -1,
    multilevels: 0,
    maxQtreeLevel: 10,
    maxiter: 500,
    step: 0.1,
    randomSeed: 123,
    randomStart: true,
    adaptiveCooling: true,
    beautifyLeaves: false,
    smoothing: SMOOTHING_NONE,
    overlap: 0,
    doShrinking: true,
    tscheme: QUAD_TREE_HYBRID,
    initialScaling: -4,
    rotation: 0,
    edgeLabelingScheme: 0,
  };
}

// ---------------------------------------------------------------------------
// Cooling / convergence
// ---------------------------------------------------------------------------

/**
 * Update the step size based on force norms.
 * @see lib/sfdpgen/spring_electrical.c:update_step
 */
export function updateStep(
  step: number,
  cool: number,
  fnorm: number,
  fnorm0: number,
): number {
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
export function averageEdgeLength(
  A: SparseMatrix,
  dim: number,
  coord: Float64Array,
): number {
  const ia = A.ia, ja = A.ja;
  if (ia[A.m] === 0) return 1;
  let dist = 0;
  for (let i = 0; i < A.m; i++) {
    for (let j = ia[i]; j < ia[i + 1]; j++) {
      dist += distance(coord, dim, i, ja[j]);
    }
  }
  return dist / ia[A.m];
}

// ---------------------------------------------------------------------------
// Leaf beautification
// ---------------------------------------------------------------------------

export function setLeaves(
  x: Float64Array,
  dim: number,
  dist: number,
  ang: number,
  i: number,
  j: number,
): void {
  x[dim * j] = Math.cos(ang) * dist + x[dim * i];
  x[dim * j + 1] = Math.sin(ang) * dist + x[dim * i + 1];
}

/**
 * Evenly redistribute leaf nodes around their parent.
 * @see lib/sfdpgen/spring_electrical.c:beautify_leaves
 */
export function beautifyLeaves(
  dim: number,
  A: SparseMatrix,
  x: Float64Array,
): void {
  const ia = A.ia, ja = A.ja, m = A.m;
  const checked = new Uint8Array(m);
  const PAD = 0.1;
  for (let i = 0; i < m; i++) {
    if (ia[i + 1] - ia[i] !== 1) continue;
    if (checked[i]) continue;
    const p = ja[ia[i]];
    if (!checked[p]) {
      checked[p] = 1;
      let dist = 0;
      const leaves: number[] = [];
      for (let j = ia[p]; j < ia[p + 1]; j++) {
        const deg = ia[ja[j] + 1] - ia[ja[j]];
        if (deg === 1) {
          checked[ja[j]] = 1;
          dist += distance(x, dim, p, ja[j]);
          leaves.push(ja[j]);
        }
      }
      if (leaves.length === 0) continue;
      dist /= leaves.length;
      const ang1start = PAD;
      const ang2 = 2 * Math.PI - PAD;
      const step = leaves.length > 1 ? (ang2 - ang1start) / leaves.length : 0;
      let ang = ang1start;
      for (const lf of leaves) {
        setLeaves(x, dim, dist, ang, p, lf);
        ang += step;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Power-law graph heuristic
// ---------------------------------------------------------------------------

/**
 * True if graph matches power-law degree distribution heuristic.
 * @see lib/sfdpgen/spring_electrical.c:power_law_graph
 */
export function powerLawGraph(A: SparseMatrix): boolean {
  const ia = A.ia, ja = A.ja, m = A.m;
  const mask = new Int32Array(m + 1);
  let maxCount = 0;
  for (let i = 0; i < m; i++) {
    let deg = 0;
    for (let j = ia[i]; j < ia[i + 1]; j++) {
      if (i !== ja[j]) deg++;
    }
    mask[deg]++;
    if (mask[deg] > maxCount) maxCount = mask[deg];
  }
  return mask[1] > 0.8 * maxCount && mask[1] > 0.3 * m;
}

// ---------------------------------------------------------------------------
// O(n²) embedding (slow, for small n or QUAD_TREE_NONE)
// ---------------------------------------------------------------------------

export function embedSlow(
  dim: number,
  A: SparseMatrix,
  ctrl: SpringElectricalControl,
  x: Float64Array,
  flag: { value: number },
): void {
  const n = A.n;
  const ia = A.ia, ja = A.ja;
  let { p, K } = ctrl;
  const maxiter = ctrl.maxiter;
  let step = ctrl.step;

  if (ctrl.randomStart) {
    let seed = ctrl.randomSeed;
    for (let i = 0; i < dim * n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; x[i] = (seed >>> 0) / 0xffffffff; }
  }
  if (K < 0) { ctrl.K = K = averageEdgeLength(A, dim, x); }
  if (p >= 0) { ctrl.p = p = -1; }
  const KP = Math.pow(K, 1 - p);
  const CRK = Math.pow(C_FORCE, (2 - p) / 3) / K;

  const force = new Float64Array(dim * n);
  let fnorm = 0, fnorm0 = 0, iter = 0;
  do {
    force.fill(0);
    iter++;
    fnorm0 = fnorm;
    fnorm = 0;
    computeRepulsiveSlow(n, dim, x, KP, p, force);
    computeAttractive(n, dim, ia, ja, x, CRK, force);
    fnorm = applyForces(n, dim, x, force, step);
    step = updateStep(step, COOL, fnorm, fnorm0);
  } while (step > TOL && iter < maxiter);

  if (ctrl.beautifyLeaves) beautifyLeaves(dim, A, x);
}

export function computeRepulsiveSlow(
  n: number,
  dim: number,
  x: Float64Array,
  KP: number,
  p: number,
  force: Float64Array,
): void {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dist = distanceCropped(x, dim, i, j);
      const scale = KP / Math.pow(dist, 1 - p);
      for (let k = 0; k < dim; k++) {
        force[i * dim + k] += scale * (x[i * dim + k] - x[j * dim + k]);
      }
    }
  }
}

export function computeAttractive(
  n: number,
  dim: number,
  ia: Int32Array,
  ja: Int32Array,
  x: Float64Array,
  CRK: number,
  force: Float64Array,
): void {
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

export function applyForces(
  n: number,
  dim: number,
  x: Float64Array,
  force: Float64Array,
  step: number,
): number {
  let fnorm = 0;
  for (let i = 0; i < n; i++) {
    let F = 0;
    for (let k = 0; k < dim; k++) F += force[i * dim + k] * force[i * dim + k];
    F = Math.sqrt(F);
    fnorm += F;
    if (F > 0) {
      for (let k = 0; k < dim; k++) x[i * dim + k] += step * force[i * dim + k] / F;
    }
  }
  return fnorm;
}

// ---------------------------------------------------------------------------
// Fast embedding (bulk Barnes-Hut)
// ---------------------------------------------------------------------------

/**
 * Force iteration with bulk Barnes-Hut quadtree.
 * @see lib/sfdpgen/spring_electrical.c:spring_electrical_embedding_fast
 */
export function springElectricalEmbeddingFast(
  dim: number,
  A0: SparseMatrix,
  ctrl: SpringElectricalControl,
  x: Float64Array,
  flag: { value: number },
): void {
  const A = A0.m !== A0.n
    ? (() => { flag.value = ERROR_NOT_SQUARE_MATRIX; return null; })()
    : symmetrize(A0, true);
  if (!A) return;

  const n = A.n;
  const ia = A.ia, ja = A.ja;
  let { p, K } = ctrl;
  const maxiter = ctrl.maxiter;
  let step = ctrl.step;

  initPositions(ctrl, dim, n, x);
  if (K < 0) { ctrl.K = K = averageEdgeLength(A, dim, x); }
  if (p >= 0) { ctrl.p = p = -1; }
  const KP = Math.pow(K, 1 - p);
  const CRK = Math.pow(C_FORCE, (2 - p) / 3) / K;

  const force = new Float64Array(dim * n);
  const counts = new Float64Array(4);
  const params: ForceParams = { bh: BH, p, KP };
  let fnorm = 0, fnorm0 = 0, iter = 0;

  do {
    force.fill(0);
    iter++;
    fnorm0 = fnorm;
    fnorm = 0;
    const qt = QuadTree.newFromPointList(dim, n, ctrl.maxQtreeLevel, x);
    qt.getRepulsiveForce(force, x, params, counts);
    computeAttractive(n, dim, ia, ja, x, CRK, force);
    fnorm = applyForces(n, dim, x, force, step);
    step = updateStep(step, COOL, fnorm, fnorm0);
  } while (step > TOL && iter < maxiter);

  if (ctrl.beautifyLeaves) beautifyLeaves(dim, A, x);
  ctrl.maxQtreeLevel = ctrl.maxQtreeLevel;
  if (A !== A0) { /* A is a local copy from symmetrize, will be GC'd */ }
}

// ---------------------------------------------------------------------------
// Normal embedding (per-vertex Barnes-Hut)
// ---------------------------------------------------------------------------

/**
 * Force iteration with per-vertex Barnes-Hut or O(n²) fallback.
 * @see lib/sfdpgen/spring_electrical.c:spring_electrical_embedding
 */
export function springElectricalEmbedding(
  dim: number,
  A0: SparseMatrix,
  ctrl: SpringElectricalControl,
  x: Float64Array,
  flag: { value: number },
): void {
  if (A0.m !== A0.n) { flag.value = ERROR_NOT_SQUARE_MATRIX; return; }
  const A = symmetrize(A0, true);
  const n = A.n;
  const ia = A.ia, ja = A.ja;
  let { p, K } = ctrl;
  const maxiter = ctrl.maxiter;
  let step = ctrl.step;

  initPositions(ctrl, dim, n, x);
  if (K < 0) { ctrl.K = K = averageEdgeLength(A, dim, x); }
  if (p >= 0) { ctrl.p = p = -1; }
  const KP = Math.pow(K, 1 - p);
  const CRK = Math.pow(C_FORCE, (2 - p) / 3) / K;

  const useQt = n >= QUADTREE_SIZE;
  const force = new Float64Array(dim * n);
  const counts = new Float64Array(4);
  const params: ForceParams = { bh: BH, p, KP };
  let fnorm = 0, fnorm0 = 0, iter = 0;

  do {
    force.fill(0);
    iter++;
    fnorm0 = fnorm;
    fnorm = 0;
    if (useQt) {
      const qt = QuadTree.newFromPointList(dim, n, ctrl.maxQtreeLevel, x);
      qt.getRepulsiveForce(force, x, params, counts);
    } else {
      computeRepulsiveSlow(n, dim, x, KP, p, force);
    }
    computeAttractive(n, dim, ia, ja, x, CRK, force);
    fnorm = applyForces(n, dim, x, force, step);
    step = updateStep(step, COOL, fnorm, fnorm0);
  } while (step > TOL && iter < maxiter);

  if (ctrl.beautifyLeaves) beautifyLeaves(dim, A, x);
  if (useQt) ctrl.maxQtreeLevel = ctrl.maxQtreeLevel;
}

// ---------------------------------------------------------------------------
// PCP rotation
// ---------------------------------------------------------------------------

/**
 * Principal-component rotation of layout to align major axis with x-axis.
 * @see lib/sfdpgen/spring_electrical.c:pcp_rotate
 */
export function pcpRotate(n: number, dim: number, x: Float64Array): void {
  const center = new Float64Array(dim);
  for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) center[k] += x[i * dim + k];
  for (let k = 0; k < dim; k++) center[k] /= n;
  for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) x[i * dim + k] -= center[k];

  const y = new Float64Array(4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < dim; k++) for (let l = 0; l < dim; l++) y[dim * k + l] += x[i * dim + k] * x[i * dim + l];
  }

  let ax0: number, ax1: number;
  if (y[1] === 0) { ax0 = 0; ax1 = 1; }
  else {
    ax0 = -(-y[0] + y[3] - Math.sqrt(y[0] * y[0] + 4 * y[1] * y[1] - 2 * y[0] * y[3] + y[3] * y[3])) / (2 * y[1]);
    ax1 = 1;
  }
  const d = Math.sqrt(1 + ax0 * ax0);
  ax0 /= d; ax1 /= d;
  for (let i = 0; i < n; i++) {
    const x0 = x[dim * i] * ax0 + x[dim * i + 1] * ax1;
    const x1 = -x[dim * i] * ax1 + x[dim * i + 1] * ax0;
    x[dim * i] = x0; x[dim * i + 1] = x1;
  }
}

/**
 * Rotate layout by angle degrees (clockwise positive).
 * @see lib/sfdpgen/spring_electrical.c:rotate
 */
export function rotateLayout(
  n: number,
  dim: number,
  x: Float64Array,
  angle: number,
): void {
  const radian = Math.PI / 180;
  const center = new Float64Array(dim);
  for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) center[k] += x[i * dim + k];
  for (let k = 0; k < dim; k++) center[k] /= n;
  for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) x[i * dim + k] -= center[k];
  const cos = Math.cos(-angle * radian);
  const sin = Math.sin(-angle * radian);
  for (let i = 0; i < n; i++) {
    const x0 = x[dim * i] * cos + x[dim * i + 1] * sin;
    const x1 = -x[dim * i] * sin + x[dim * i + 1] * cos;
    x[dim * i] = x0; x[dim * i + 1] = x1;
  }
}

// ---------------------------------------------------------------------------
// Coordinate prolongation helpers
// ---------------------------------------------------------------------------

/**
 * Smooth prolongated coordinates using neighbor averaging.
 * @see lib/sfdpgen/spring_electrical.c:interpolate_coord
 */
export function interpolateCoord(
  dim: number,
  A: SparseMatrix,
  x: Float64Array,
): void {
  const ia = A.ia, ja = A.ja;
  const alpha = 0.5;
  const y = new Float64Array(dim);
  for (let i = 0; i < A.m; i++) {
    y.fill(0);
    let nz = 0;
    for (let j = ia[i]; j < ia[i + 1]; j++) {
      if (ja[j] === i) continue;
      nz++;
      for (let k = 0; k < dim; k++) y[k] += x[ja[j] * dim + k];
    }
    if (nz > 0) {
      const beta = (1 - alpha) / nz;
      for (let k = 0; k < dim; k++) x[i * dim + k] = alpha * x[i * dim + k] + beta * y[k];
    }
  }
}

/**
 * Prolong coarse coordinates xc to fine coordinates xf.
 * Writes result into xf.
 * @see lib/sfdpgen/spring_electrical.c:prolongate
 */
export function prolongateCoords(
  dim: number,
  Afine: SparseMatrix,
  P: SparseMatrix,
  R: SparseMatrix,
  xc: Float64Array,
  xf: Float64Array,
  delta: number,
): void {
  multiplyDense(P, xc, xf, dim);
  interpolateCoord(dim, Afine, xf);
  const nc = R.m;
  const ia = R.ia, ja = R.ja;
  for (let i = 0; i < nc; i++) {
    for (let j = ia[i] + 1; j < ia[i + 1]; j++) {
      for (let k = 0; k < dim; k++) {
        xf[ja[j] * dim + k] += delta * (Math.random() - 0.5);
      }
    }
  }
}

/**
 * P * xc → y (dense multiply): y[i*dim+k] = sum_j P[i,j] * xc[j*dim+k]
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_multiply_dense
 */
export function multiplyDense(
  P: SparseMatrix,
  xc: Float64Array,
  y: Float64Array,
  dim: number,
): void {
  y.fill(0);
  const ia = P.ia, ja = P.ja;
  const hasVals = P.a !== null && P.type === MATRIX_TYPE_REAL;
  const pa = hasVals ? (P.a as Float64Array) : null;
  for (let i = 0; i < P.m; i++) {
    for (let jj = ia[i]; jj < ia[i + 1]; jj++) {
      const j = ja[jj];
      const w = pa ? pa[jj] : 1.0;
      for (let k = 0; k < dim; k++) y[i * dim + k] += w * xc[j * dim + k];
    }
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function initPositions(
  ctrl: SpringElectricalControl,
  dim: number,
  n: number,
  x: Float64Array,
): void {
  if (!ctrl.randomStart) return;
  let seed = ctrl.randomSeed >>> 0;
  for (let i = 0; i < dim * n; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    x[i] = (seed >>> 0) / 0xffffffff;
  }
}

// ---------------------------------------------------------------------------
// Multilevel driver
// ---------------------------------------------------------------------------

/**
 * Full multilevel spring-electrical embedding.
 * Saves ctrl on entry and restores on exit (always, even on error).
 *
 * @see lib/sfdpgen/spring_electrical.c:multilevel_spring_electrical_embedding
 */
export function multilevelSpringElectricalEmbedding(
  dim: number,
  A: SparseMatrix,
  ctrl: SpringElectricalControl,
  labelSizes: Float64Array | null,
  x: Float64Array,
  nEdgeLabelNodes: number,
  edgeLabelNodes: number[],
  flag: { value: number },
): void {
  // SAVE — ctrl is mutated during multilevel; must be restored
  const ctrl0 = { ...ctrl };
  try {
    multilevelEmbeddingBody(
      dim, A, ctrl, labelSizes, x, nEdgeLabelNodes, edgeLabelNodes, flag,
    );
  } finally {
    // RESTORE — always, even on error
    Object.assign(ctrl, ctrl0);
  }
}

export function multilevelEmbeddingBody(
  dim: number,
  A0: SparseMatrix,
  ctrl: SpringElectricalControl,
  _labelSizes: Float64Array | null,
  x: Float64Array,
  _nEdgeLabelNodes: number,
  _edgeLabelNodes: number[],
  flag: { value: number },
): void {
  flag.value = 0;
  const n = A0.n;
  if (n <= 0 || dim <= 0) return;

  let A: SparseMatrix;
  if (!isSymmetric(A0, false) || A0.type !== MATRIX_TYPE_REAL) {
    A = getRealAdjacencyMatrixSymmetrized(A0);
  } else {
    A = A0.copy();
    A.removeDiagonal();
  }

  if (ctrl.p === AUTOP) {
    ctrl.p = -1;
    if (powerLawGraph(A)) ctrl.p = -1.8;
  }

  const { levels, prolongations, restrictions } = buildHierarchy(A, ctrl.multilevels);
  const coarsestIdx = levels.length - 1;

  // Allocate coordinate buffers per level
  let xc: Float64Array = coarsestIdx === 0
    ? x
    : new Float64Array(levels[coarsestIdx]!.n * dim);

  // Solve coarsest level
  runEmbedding(dim, levels[coarsestIdx]!, ctrl, xc, flag);
  if (flag.value !== 0 && coarsestIdx !== 0) { return; }

  // Prolong and refine
  for (let lvl = coarsestIdx - 1; lvl >= 0; lvl--) {
    const fineA = levels[lvl]!;
    const nfine = fineA.n;
    const xf: Float64Array = lvl === 0 ? x : new Float64Array(nfine * dim);

    prolongateCoords(dim, fineA, prolongations[lvl]!, restrictions[lvl]!, xc, xf, ctrl.K * 0.001);
    xc = xf;
    ctrl.randomStart = false;
    ctrl.K *= 0.75;
    ctrl.adaptiveCooling = false;
    ctrl.step = 0.1;
    runEmbedding(dim, fineA, ctrl, xc, flag);
    if (flag.value !== 0) { return; }
  }

  if (dim === 2) pcpRotate(n, dim, x);
  if (ctrl.rotation !== 0) rotateLayout(n, dim, x, ctrl.rotation);
}

export function runEmbedding(
  dim: number,
  A: SparseMatrix,
  ctrl: SpringElectricalControl,
  x: Float64Array,
  flag: { value: number },
): void {
  if (ctrl.tscheme === QUAD_TREE_NONE) {
    embedSlow(dim, A, ctrl, x, flag);
  } else if (
    ctrl.tscheme === QUAD_TREE_FAST ||
    (ctrl.tscheme === QUAD_TREE_HYBRID && A.m > QUAD_TREE_HYBRID_SIZE)
  ) {
    springElectricalEmbeddingFast(dim, A, ctrl, x, flag);
  } else {
    springElectricalEmbedding(dim, A, ctrl, x, flag);
  }
}

// ---------------------------------------------------------------------------
// Hierarchy build (used by multilevelEmbeddingBody)
// ---------------------------------------------------------------------------

interface HierarchyResult {
  levels: SparseMatrix[];
  prolongations: (SparseMatrix | null)[];
  restrictions: (SparseMatrix | null)[];
}

export function buildHierarchy(
  A: SparseMatrix,
  maxlevels: number,
): HierarchyResult {
  const levels: SparseMatrix[] = [A];
  const prolongations: (SparseMatrix | null)[] = [null];
  const restrictions: (SparseMatrix | null)[] = [null];

  let current = A;
  let depth = 0;
  const maxDepth = maxlevels <= 1 ? 0 : (maxlevels > 0 ? maxlevels - 1 : 50);

  while (depth < maxDepth && current.n > 4) {
    const nc = current.n;
    const { P, R, cA } = coarsenOneLevel(current);
    if (cA === null || cA.n >= nc) break;
    const ratio = cA.n / nc;
    if (ratio > 0.75 && depth > 0) break;
    levels.push(cA);
    prolongations.push(P);
    restrictions.push(R);
    current = cA;
    depth++;
  }

  return { levels, prolongations, restrictions };
}

export function coarsenOneLevel(A: SparseMatrix): {
  P: SparseMatrix;
  R: SparseMatrix;
  cA: SparseMatrix | null;
} {
  const n = A.n;
  const ia = A.ia, ja = A.ja;
  const aVals = A.a as Float64Array | null;

  // Heavy-edge matching with random permutation
  const matched = new Int32Array(n).fill(-1);
  const perm = buildPermutation(n);
  const clusterOf = new Int32Array(n);
  let nc = 0;

  for (let pi = 0; pi < n; pi++) {
    const i = perm[pi]!;
    if (matched[i] >= 0) continue;
    let bestJ = -1, bestW = -1;
    for (let jj = ia[i]; jj < ia[i + 1]; jj++) {
      const j = ja[jj];
      if (j === i || matched[j] >= 0) continue;
      const w = aVals ? aVals[jj] : 1.0;
      if (w > bestW) { bestW = w; bestJ = j; }
    }
    clusterOf[i] = nc;
    matched[i] = nc;
    if (bestJ >= 0) { clusterOf[bestJ] = nc; matched[bestJ] = nc; }
    nc++;
  }

  if (nc >= n) return { P: buildIdentityP(n), R: buildIdentityR(n), cA: null };

  const P = buildP(n, nc, clusterOf);
  const R = buildR(nc, n, clusterOf);
  const cA = computeCoarseA(A, P, R);
  return { P, R, cA };
}

export function buildPermutation(n: number): number[] {
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = perm[i]!; perm[i] = perm[j]!; perm[j] = tmp;
  }
  return perm;
}

export function buildP(n: number, nc: number, clusterOf: Int32Array): SparseMatrix {
  const P = SparseMatrix.new(n, nc, n, MATRIX_TYPE_REAL, 0);
  const ia = P.ia, ja = P.ja;
  const pa = P.a as Float64Array;
  for (let i = 0; i <= n; i++) ia[i] = i;
  for (let i = 0; i < n; i++) { ja[i] = clusterOf[i]; pa[i] = 1.0; }
  P.nz = n;
  return P;
}

export function buildR(nc: number, n: number, clusterOf: Int32Array): SparseMatrix {
  // R is P^T normalized by row degree (weighted average)
  const counts = new Int32Array(nc);
  for (let i = 0; i < n; i++) counts[clusterOf[i]]++;

  const R = SparseMatrix.new(nc, n, n, MATRIX_TYPE_REAL, 0);
  const ia = R.ia, ja = R.ja;
  const ra = R.a as Float64Array;
  // Build row pointers: each coarse node has counts[c] entries
  ia[0] = 0;
  for (let c = 0; c < nc; c++) ia[c + 1] = ia[c] + counts[c];

  // Fill in column indices and values
  const pos = new Int32Array(nc);
  for (let i = 0; i < n; i++) {
    const c = clusterOf[i];
    const idx = ia[c] + pos[c];
    ja[idx] = i;
    ra[idx] = 1.0 / counts[c];
    pos[c]++;
  }
  R.nz = n;
  return R;
}

export function buildIdentityP(n: number): SparseMatrix {
  return buildP(n, n, Int32Array.from({ length: n }, (_, i) => i));
}

export function buildIdentityR(n: number): SparseMatrix {
  return buildR(n, n, Int32Array.from({ length: n }, (_, i) => i));
}

export function computeCoarseA(
  A: SparseMatrix,
  P: SparseMatrix,
  R: SparseMatrix,
): SparseMatrix {
  // cA = R * A * P  (Galerkin projection)
  const nc = R.m;
  const n = A.m;
  const Ria = R.ia, Rja = R.ja;
  const Ra = R.a as Float64Array;
  const Aia = A.ia, Aja = A.ja;
  const Aa = A.a as Float64Array | null;
  const Pia = P.ia, Pja = P.ja;
  const Pa = P.a as Float64Array | null;

  // Accumulate into a dense nc×nc array then convert to sparse
  const dense = new Float64Array(nc * nc);
  for (let ci = 0; ci < nc; ci++) {
    for (let ri = Ria[ci]; ri < Ria[ci + 1]; ri++) {
      const i = Rja[ri];
      const rw = Ra[ri];
      for (let ai = Aia[i]; ai < Aia[i + 1]; ai++) {
        const j = Aja[ai];
        const aw = Aa ? Aa[ai] : 1.0;
        for (let pi2 = Pia[j]; pi2 < Pia[j + 1]; pi2++) {
          const cj = Pja[pi2];
          const pw = Pa ? Pa[pi2] : 1.0;
          dense[ci * nc + cj] += rw * aw * pw;
        }
      }
    }
  }

  // Build CSR from dense, skipping diagonal and zeros
  const irn: number[] = [], jcn: number[] = [], vals: number[] = [];
  for (let ci = 0; ci < nc; ci++) {
    for (let cj = 0; cj < nc; cj++) {
      if (ci === cj) continue;
      const v = dense[ci * nc + cj];
      if (v !== 0) { irn.push(ci); jcn.push(cj); vals.push(v); }
    }
  }

  const irnArr = new Int32Array(irn);
  const jcnArr = new Int32Array(jcn);
  const vArr = new Float64Array(vals);
  const cA = SparseMatrix.fromCoordinateArrays(irn.length, nc, nc, irnArr, jcnArr, vArr, MATRIX_TYPE_REAL);
  cA.isSymmetric = true; cA.isPatternSymmetric = true;
  return cA;
}

// Export MINDIST for use in tests
export { MINDIST };
