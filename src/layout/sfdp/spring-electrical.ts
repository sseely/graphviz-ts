// SPDX-License-Identifier: EPL-2.0

/**
 * Spring-electrical embedding — the sfdp force model.
 *
 * Spec read at the 15.0.0 tag. Float discipline: the arm64 reference
 * binary contracts every `acc += Δ·Δ`-shaped accumulation to fmadd
 * (verified by disassembling _distance, _average_edge_length and
 * _spring_electrical_embedding), the attractive update to
 * `fnmul`+`fmadd` (the CRK·Δ product is rounded, then fused with
 * dist), and the position update to fmadd. The repulsive pow() is a
 * REAL libm call in the binary (runtime exponent) — reproduced by the
 * bit-exact Apple pow port in src/common/apple-pow.ts (its ~0.5-ULP
 * roundings flip adaptive-cooling branches if approximated).
 *
 * The slow (QUAD_TREE_NONE) and fast (QUAD_TREE_FAST/large-HYBRID)
 * embedding variants are unreachable at sfdp defaults and not ported.
 *
 * @see lib/sfdpgen/spring_electrical.c (15.0.0)
 */

import { fma } from '../../common/fma.js';
import { armPow } from '../../common/arm-pow.js';
import { csrand, cdrand } from '../../common/crand.js';
import {
  type SpMatrix,
  smSymmetrize,
} from './sparse-matrix.js';
import { quadTreeNewFromPointList, quadTreeGetSupernodes } from './quadtree.js';

/** @see lib/sfdpgen/spring_electrical.h:AUTOP */
export const AUTOP = -1.0001234;

/** @see lib/sfdpgen/spring_electrical.h: QUAD_TREE_* */
export const QUAD_TREE_NONE = 0;
export const QUAD_TREE_NORMAL = 1;
export const QUAD_TREE_FAST = 2;
export const QUAD_TREE_HYBRID = 3;

/** fₐ scale. @see lib/sfdpgen/spring_electrical.c:C */
const C_PARAM = 0.2;
/** Quadtree cutoff size. @see spring_electrical.c:quadtree_size */
const QUADTREE_SIZE = 45;
/** Barnes–Hut opening criterion. @see spring_electrical.c:bh */
const BH = 0.6;
/** Step-size termination tolerance. @see spring_electrical.c:tol */
const TOL = 0.001;
/** Cooling factor. @see spring_electrical.c:cool */
const COOL = 0.9;
/** @see lib/sparse/general.h:MINDIST */
const MINDIST = 1e-15;
/** @see lib/sparse/general.h:MACHINEACC */
const MACHINEACC = 1.0e-16;

/** @see lib/sfdpgen/spring_electrical.h:spring_electrical_control */
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

/** @see lib/sfdpgen/spring_electrical.c:spring_electrical_control_new */
export function springElectricalControlNew(): SpringElectricalControl {
  return {
    p: AUTOP,
    randomStart: true,
    K: -1,
    multilevels: 0,
    maxQtreeLevel: 10,
    maxiter: 500,
    step: 0.1,
    adaptiveCooling: true,
    randomSeed: 123,
    beautifyLeaves: false,
    smoothing: 0, // SMOOTHING_NONE
    overlap: 0,
    doShrinking: true,
    tscheme: QUAD_TREE_HYBRID,
    initialScaling: -4,
    rotation: 0,
    edgeLabelingScheme: 0,
  };
}

// ---------------------------------------------------------------------------
// oned_optimizer
// ---------------------------------------------------------------------------

/** @see lib/sfdpgen/spring_electrical.c:MAX_I/OPT_* */
const MAX_I = 20;
const OPT_UP = 1;
const OPT_DOWN = -1;
const OPT_INIT = 0;

/** @see lib/sfdpgen/spring_electrical.c:oned_optimizer */
export interface OnedOptimizer {
  i: number;
  work: number[];
  direction: number;
}

/** @see spring_electrical.c:oned_optimizer_new */
export function onedOptimizerNew(i: number): OnedOptimizer {
  return { i, work: new Array<number>(MAX_I + 1).fill(0), direction: OPT_INIT };
}

/** @see spring_electrical.c:oned_optimizer_train */
export function onedOptimizerTrain(opt: OnedOptimizer, work: number): void {
  const i = opt.i;
  opt.work[i] = work;
  if (opt.direction === OPT_INIT) {
    if (opt.i === MAX_I) {
      opt.direction = OPT_DOWN;
      opt.i = opt.i - 1;
    } else {
      opt.direction = OPT_UP;
      opt.i = Math.min(MAX_I, opt.i + 1);
    }
  } else if (opt.direction === OPT_UP) {
    if (opt.work[i]! < opt.work[i - 1]! && opt.i < MAX_I) {
      opt.i = Math.min(MAX_I, opt.i + 1);
    } else {
      opt.i--;
      opt.direction = OPT_DOWN;
    }
  } else {
    if (opt.work[i]! < opt.work[i + 1]! && opt.i > 0) {
      opt.i = Math.max(0, opt.i - 1);
    } else {
      opt.i++;
      opt.direction = OPT_UP;
    }
  }
}

// ---------------------------------------------------------------------------
// Distances (fmadd accumulation per the reference binary)
// ---------------------------------------------------------------------------

/** @see lib/sparse/general.c:distance */
export function distance(x: number[], dim: number, i: number, j: number): number {
  let dist = 0;
  for (let k = 0; k < dim; k++) {
    const d = x[i * dim + k]! - x[j * dim + k]!;
    dist = fma(d, d, dist);
  }
  return Math.sqrt(dist);
}

/** @see lib/sparse/general.c:distance_cropped */
export function distanceCropped(x: number[], dim: number, i: number, j: number): number {
  return Math.max(distance(x, dim, i, j), MINDIST);
}

// ---------------------------------------------------------------------------
// beautify_leaves — fan a node's degree-1 leaves radially around it
// @see lib/sfdpgen/spring_electrical.c:beautify_leaves
// ---------------------------------------------------------------------------

/** Gather parent p's degree-1 leaves (in ja order), marking them checked, and
 *  return them with their average distance from p. @see beautify_leaves loop */
function gatherLeaves(
  A: SpMatrix, p: number, checked: boolean[], x: number[], dim: number,
): { leaves: number[]; avgDist: number } {
  const { ia, ja } = A;
  const leaves: number[] = [];
  let dist = 0;
  for (let j = ia[p]!; j < ia[p + 1]!; j++) {
    const c = ja[j]!;
    if (ia[c + 1]! - ia[c]! === 1) {
      checked[c] = true;
      dist += distance(x, dim, p, c);
      leaves.push(c);
    }
  }
  return { leaves, avgDist: dist / leaves.length };
}

/**
 * Reposition every degree-1 leaf radially around its parent at the parent's
 * average leaf distance, evenly fanned over `[pad, 2π−pad]` (pad = 0.1). Each
 * parent is processed once. Assumes A has no diagonal (guaranteed upstream).
 * @see lib/sfdpgen/spring_electrical.c:beautify_leaves
 */
export function beautifyLeaves(dim: number, A: SpMatrix, x: number[]): void {
  const { ia, ja, m } = A;
  const checked = new Array<boolean>(m).fill(false);
  const pad = 0.1;
  for (let i = 0; i < m; i++) {
    if (ia[i + 1]! - ia[i]! !== 1 || checked[i]) continue;
    const p = ja[ia[i]!]!;
    if (checked[p]) continue;
    checked[p] = true;
    const { leaves, avgDist } = gatherLeaves(A, p, checked, x, dim);
    const cx = x[dim * p]!, cy = x[dim * p + 1]!;
    let ang = pad;
    const step = leaves.length > 1 ? (2 * Math.PI - 2 * pad) / leaves.length : 0;
    for (const leaf of leaves) {
      // cos/sin·dist + base fused to match the C binary's fmadd (set_leaves).
      x[dim * leaf] = fma(Math.cos(ang), avgDist, cx);
      x[dim * leaf + 1] = fma(Math.sin(ang), avgDist, cy);
      ang += step;
    }
  }
}

/** @see lib/sfdpgen/spring_electrical.c:average_edge_length */
export function averageEdgeLength(A: SpMatrix, dim: number, coord: number[]): number {
  let dist = 0;
  const { ia, ja } = A;
  if (ia[A.m] === 0) return 1;
  for (let i = 0; i < A.m; i++) {
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      let d = 0;
      for (let k = 0; k < dim; k++) {
        const dd = coord[dim * i + k]! - coord[dim * ja[j]!]!;
        d = fma(dd, dd, d);
      }
      dist += Math.sqrt(d);
    }
  }
  return dist / ia[A.m]!;
}

/** @see lib/sfdpgen/spring_electrical.c:update_step */
function updateStep(
  adaptiveCooling: boolean, step: number, fnorm: number, fnorm0: number,
): number {
  if (!adaptiveCooling) return COOL * step;
  if (fnorm >= fnorm0) {
    return COOL * step;
  } else if (fnorm > 0.95 * fnorm0) {
    return step;
  }
  return 0.99 * step / COOL;
}

/**
 * pow(dist, 1−p). The reference binary issues a real libm pow() here
 * (runtime exponent); we use the legally clean ARM optimized-routines
 * pow (~0.54 ULP). It is NOT the same libm that produced the macOS
 * golden refs, so chaotic amplification means larger sfdp graphs will
 * not reproduce the refs bit-for-bit — see the mission journal.
 */
function repulsivePow(dist: number, p: number): number {
  return armPow(dist, 1 - p);
}

// ---------------------------------------------------------------------------
// spring_electrical_embedding (QUAD_TREE_NORMAL scheme)
// ---------------------------------------------------------------------------

/** Loop-invariant force parameters for one embedding run. */
interface ForceParams {
  K: number;
  p: number;
  KP: number;
  CRK: number;
}

/** Attractive force over CSR row i. @see spring_electrical.c:599-608 */
function attractiveForce(
  A: SpMatrix, x: number[], dim: number, i: number, f: number[], fp: ForceParams,
): void {
  const { ia, ja } = A;
  for (let j = ia[i]!; j < ia[i + 1]!; j++) {
    if (ja[j] === i) continue;
    const dist = distance(x, dim, i, ja[j]!);
    for (let k = 0; k < dim; k++) {
      // binary: fnmul(CRK·Δ) rounded, then fmadd with dist
      const t = fp.CRK * (x[i * dim + k]! - x[ja[j]! * dim + k]!);
      f[k] = fma(-t, dist, f[k]!);
    }
  }
}

/** All-pairs repulsive force on node i. @see spring_electrical.c:630-638 */
function repulsiveForceDirect(
  x: number[], dim: number, n: number, i: number, f: number[], fp: ForceParams,
): void {
  for (let j = 0; j < n; j++) {
    if (j === i) continue;
    const dist = distanceCropped(x, dim, i, j);
    for (let k = 0; k < dim; k++) {
      f[k]! += fp.KP * (x[i * dim + k]! - x[j * dim + k]!) / repulsivePow(dist, fp.p);
    }
  }
}

/** Supernode-approximated repulsion. @see spring_electrical.c:611-629 */
function repulsiveForceQT(
  qt: ReturnType<typeof quadTreeNewFromPointList>,
  x: number[], dim: number, i: number, f: number[], fp: ForceParams,
  acc: { nsuperAvg: number; countsAvg: number },
): void {
  const { nsuper, center, supernodeWgts, distances, counts } =
    quadTreeGetSupernodes(qt, BH, x, i * dim, i);
  acc.countsAvg += counts;
  acc.nsuperAvg += nsuper;
  for (let j = 0; j < nsuper; j++) {
    const dist = Math.max(distances[j]!, MINDIST);
    for (let k = 0; k < dim; k++) {
      f[k]! += supernodeWgts[j]! * fp.KP * (x[i * dim + k]! - center[j * dim + k]!)
        / repulsivePow(dist, fp.p);
    }
  }
}

/** Normalize force and move node i; returns |f|. @see spring_electrical.c:640-649 */
function moveNode(
  x: number[], dim: number, i: number, f: number[], step: number,
): number {
  let F = 0;
  for (let k = 0; k < dim; k++) F = fma(f[k]!, f[k]!, F);
  F = Math.sqrt(F);
  if (F > 0) for (let k = 0; k < dim; k++) f[k] = f[k]! / F;
  for (let k = 0; k < dim; k++) {
    x[i * dim + k] = fma(step, f[k]!, x[i * dim + k]!);
  }
  return F;
}

/**
 * The NORMAL-scheme embedding: per-node attract + repulse (direct or
 * Barnes–Hut above QUADTREE_SIZE), normalized move, adaptive cooling.
 * Mutates ctrl.K/p/maxQtreeLevel as the C does.
 * @see lib/sfdpgen/spring_electrical.c:spring_electrical_embedding
 */
export function springElectricalEmbedding(
  dim: number, A0: SpMatrix, ctrl: SpringElectricalControl, x: number[],
): void {
  let A = A0;
  const n = A.n;
  if (n <= 0 || ctrl.maxiter <= 0) return;
  const useQT = n >= QUADTREE_SIZE;
  let maxQtreeLevel = ctrl.maxQtreeLevel;
  const optimizer = onedOptimizerNew(maxQtreeLevel);

  A = smSymmetrize(A, true);

  if (ctrl.randomStart) {
    csrand(ctrl.randomSeed);
    for (let i = 0; i < dim * n; i++) x[i] = cdrand();
  }
  if (ctrl.K < 0) {
    ctrl.K = averageEdgeLength(A, dim, x);
  }
  if (ctrl.p >= 0) ctrl.p = -1;
  const fp: ForceParams = {
    K: ctrl.K,
    p: ctrl.p,
    KP: Math.pow(ctrl.K, 1 - ctrl.p),
    CRK: Math.pow(C_PARAM, (2 - ctrl.p) / 3) / ctrl.K,
  };

  const f = new Array<number>(dim).fill(0);
  let step = ctrl.step;
  let Fnorm = 0;
  let iter = 0;
  do {
    iter++;
    const Fnorm0 = Fnorm;
    Fnorm = 0;
    const acc = { nsuperAvg: 0, countsAvg: 0 };

    let qt = null;
    if (useQT) {
      maxQtreeLevel = optimizer.i;
      qt = quadTreeNewFromPointList(dim, n, maxQtreeLevel, x);
    }

    for (let i = 0; i < n; i++) {
      for (let k = 0; k < dim; k++) f[k] = 0;
      attractiveForce(A, x, dim, i, f, fp);
      if (qt !== null) {
        repulsiveForceQT(qt, x, dim, i, f, fp, acc);
      } else {
        repulsiveForceDirect(x, dim, n, i, f, fp);
      }
      Fnorm += moveNode(x, dim, i, f, step);
    }

    if (qt !== null) {
      acc.nsuperAvg /= n;
      acc.countsAvg /= n;
      // binary: fmadd(nsuper_avg, 5, counts_avg)
      onedOptimizerTrain(optimizer, fma(acc.nsuperAvg, 5, acc.countsAvg));
    }

    step = updateStep(ctrl.adaptiveCooling, step, Fnorm, Fnorm0);
  } while (step > TOL && iter < ctrl.maxiter);

  if (ctrl.beautifyLeaves) {
    throw new Error('sfdp beautify_leaves not ported (no supported input sets beautify)');
  }

  if (useQT) ctrl.maxQtreeLevel = maxQtreeLevel;
}

