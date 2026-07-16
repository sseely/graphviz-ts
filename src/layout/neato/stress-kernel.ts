// SPDX-License-Identifier: EPL-2.0

/**
 * Dense k-D stress majorization — a float32-faithful port of
 * stress_majorization_kD_mkernel and conjugate_gradient_mkernel.
 * Replicates C numerics exactly (decision D3): float storage and
 * chained-operation rounding via Math.fround, double accumulators
 * where C uses double/long double (long double == double on AArch64
 * macOS, where the reference SVGs were generated).
 *
 * smart_init (sparse subspace estimation) is not ported — no `start`
 * attr in the suite, so checkStart always yields INIT_RANDOM.
 *
 * @see lib/neatogen/stress.c:stress_majorization_kD_mkernel
 * @see lib/neatogen/conjgrad.c:conjugate_gradient_mkernel
 */

import type { Node } from '../../model/node.js';
import { drand48 } from '../../common/random.js';
import { bfs } from './bfs.js';
import { dijkstra, type VtxData } from './dijkstra.js';
import {
  copyVectorF,
  invertSqrtVec,
  invertVec,
  maxAbsF,
  orthog1,
  orthog1f,
  rightMultWithVectorFF,
  sqrtVecF,
  squareVec,
  vectorsInnerProductF,
  vectorsMultAdditionF,
  vectorsSubtractionF,
} from './matrix-ops.js';

const fr = Math.fround;

/** @see lib/neatogen/stress.h:tolerance_cg */
const TOLERANCE_CG = 1e-3;

/** Stress options bit: weight exponent (1 or 2). @see lib/neatogen/stress.h */
export const OPT_EXP_FLAG = 2;
/** Stress options bit: smart initialisation. @see lib/neatogen/stress.h */
export const OPT_SMART_INIT = 1;

/**
 * Packed all-pairs shortest paths over unit weights (BFS hops).
 * @see lib/neatogen/stress.c:compute_apsp_packed
 */
export function computeApspPacked(graph: VtxData[], n: number): Float32Array {
  const Dij = new Float32Array((n * (n + 1)) / 2);
  const Di = new Int32Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    bfs(i, graph, n, Di);
    for (let j = i; j < n; j++) Dij[count++] = Di[j]!;
  }
  return Dij;
}

/**
 * Packed all-pairs shortest paths over float edge lengths.
 * @see lib/neatogen/stress.c:compute_weighted_apsp_packed
 */
export function computeWeightedApspPacked(graph: VtxData[], n: number): Float32Array {
  const Dij = new Float32Array((n * (n + 1)) / 2);
  const Di = new Float32Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    dijkstra(i, graph, n, Di);
    for (let j = i; j < n; j++) Dij[count++] = Di[j]!;
  }
  return Dij;
}

/**
 * Has the node a user-supplied position? The TS model tracks pinned
 * as a boolean (C distinguishes P_SET/P_PIN; no suite input pins).
 * @see lib/neatogen/stress.c:hasPos
 */
function hasPos(n: Node): boolean {
  return n.info.pinned === true;
}

/** Is the node pinned? @see lib/neatogen/stress.c:isFixed (P_PIN) */
function isFixed(n: Node): boolean {
  return n.info.pinned === true;
}

/**
 * Random (drand48) or user-position layout initialisation; centers
 * each axis. Returns true if some node is pinned.
 * @see lib/neatogen/stress.c:initLayout
 */
export function initLayout(
  n: number, dim: number, coords: Float64Array[], nodes: Node[],
): boolean {
  let pinned = false;
  for (let i = 0; i < n; i++) {
    const np = nodes[i]!;
    if (hasPos(np)) {
      coords[0]![i] = np.info.pos?.[0] ?? 0;
      coords[1]![i] = np.info.pos?.[1] ?? 0;
      if (isFixed(np)) pinned = true;
    } else {
      coords[0]![i] = drand48();
      coords[1]![i] = drand48();
      for (let d = 2; d < dim; d++) coords[d]![i] = drand48();
    }
  }
  for (let d = 0; d < dim; d++) orthog1(n, coords[d]!);
  return pinned;
}

/**
 * Conjugate gradients on a packed symmetric float matrix.
 * Returns negative on error.
 * @see lib/neatogen/conjgrad.c:conjugate_gradient_mkernel
 */
/** Mutable CG iteration state. */
interface CgState {
  A: Float32Array;
  x: Float32Array;
  b: Float32Array;
  n: number;
  r: Float32Array;
  p: Float32Array;
  Ap: Float32Array;
  rR: number;
}

/** One CG step; returns false on a zero-length residual error. */
function cgStep(st: CgState, last: boolean): boolean {
  const { n } = st;
  orthog1f(n, st.p);
  orthog1f(n, st.x);
  orthog1f(n, st.r);
  rightMultWithVectorFF(st.A, n, st.p, st.Ap);
  orthog1f(n, st.Ap);
  const pAp = vectorsInnerProductF(n, st.p, st.Ap);
  if (pAp === 0) return true; // C: break
  const alpha = st.rR / pAp;
  vectorsMultAdditionF(n, st.x, alpha, st.p);
  if (!last) {
    vectorsMultAdditionF(n, st.r, -alpha, st.Ap);
    const rRNew = vectorsInnerProductF(n, st.r, st.r);
    if (st.rR === 0) return false;
    const betaF = fr(rRNew / st.rR);
    st.rR = rRNew;
    for (let j = 0; j < n; j++) st.p[j] = fr(betaF * st.p[j]!) + st.r[j]!;
  }
  return true;
}

export function conjugateGradientMkernel(
  A: Float32Array, x: Float32Array, b: Float32Array, n: number,
  tol: number, maxIterations: number,
): number {
  const st: CgState = {
    A, x, b, n,
    r: new Float32Array(n),
    p: new Float32Array(n),
    Ap: new Float32Array(n),
    rR: 0,
  };
  orthog1f(n, x);
  orthog1f(n, b);
  const Ax = new Float32Array(n);
  rightMultWithVectorFF(A, n, x, Ax);
  orthog1f(n, Ax);
  vectorsSubtractionF(n, b, Ax, st.r);
  copyVectorF(n, st.r, st.p);
  st.rR = vectorsInnerProductF(n, st.r, st.r);

  for (let i = 0; i < maxIterations && maxAbsF(n, st.r) > tol; i++) {
    if (!cgStep(st, i >= maxIterations - 1)) return -1;
  }
  return 0;
}

/** Laplacian off-diagonal prep + diagonal degrees. @see stress.c (Laplacian computation) */
function buildLap2(lap2: Float32Array, n: number, exp: number): void {
  const lapLength = (n * (n + 1)) / 2;
  if (exp === 2) squareVec(lapLength, lap2);
  invertVec(lapLength, lap2);
  const degrees = new Float64Array(n);
  let count = 0;
  for (let i = 0; i < n - 1; i++) {
    let degree = 0;
    count++; // skip main diag entry
    for (let j = 1; j < n - i; j++, count++) {
      const val = lap2[count]!;
      degree += val;
      degrees[i + j] = degrees[i + j]! - val;
    }
    degrees[i] = degrees[i]! - degree;
  }
  count = 0;
  for (let i = 0, step = n; i < n; i++, count += step, step--) {
    lap2[count] = degrees[i]!;
  }
}

/** Per-iteration Laplacian of 1/(d_ij*|p_i-p_j|). @see stress.c (main loop head) */
function buildLap1(
  lap1: Float32Array, lap2: Float32Array, coords: Float32Array[],
  shape: { n: number; dim: number; exp: number },
): void {
  const { n, dim, exp } = shape;
  const lapLength = (n * (n + 1)) / 2;
  const degrees = new Float64Array(n);
  const distAccumulator = new Float32Array(n);
  if (exp === 2) sqrtVecF(lapLength, lap2, lap1);
  let count = 0;
  for (let i = 0; i < n - 1; i++) {
    const len = n - i - 1;
    for (let x = 0; x < len; x++) distAccumulator[x] = 0;
    for (let k = 0; k < dim; k++) {
      const ck = coords[k]!;
      for (let x = 0; x < len; x++) {
        const tmp = fr(ck[i]! + fr(-1 * ck[i + 1 + x]!));
        distAccumulator[x] = distAccumulator[x]! + fr(tmp * tmp);
      }
    }
    invertSqrtVec(len, distAccumulator);
    for (let j = 0; j < len; j++) {
      const da = distAccumulator[j]!;
      if (da >= 3.4028234663852886e38 || da < 0) distAccumulator[j] = 0;
    }
    count++; // main diagonal entry placeholder
    let degree = 0;
    if (exp === 2) {
      for (let j = 0; j < len; j++, count++) {
        const val = (lap1[count] = fr(lap1[count]! * distAccumulator[j]!));
        degree += val;
        degrees[i + j + 1] = degrees[i + j + 1]! - val;
      }
    } else {
      for (let j = 0; j < len; j++, count++) {
        const val = (lap1[count] = distAccumulator[j]!);
        degree += val;
        degrees[i + j + 1] = degrees[i + j + 1]! - val;
      }
    }
    degrees[i] = degrees[i]! - degree;
  }
  count = 0;
  for (let i = 0, step = n; i < n; i++, count += step, step--) {
    lap1[count] = degrees[i]!;
  }
}

/** Inputs for the kernel main loop. */
interface KernelState {
  n: number;
  dim: number;
  exp: number;
  lap1: Float32Array;
  lap2: Float32Array;
  coords: Float32Array[];
  b: Float32Array[];
  tmpCoords: Float32Array;
  constantTerm: number;
}

/** One stress evaluation. @see stress.c (compute new stress block) */
function computeStress(st: KernelState): number {
  let stress = 0;
  for (let k = 0; k < st.dim; k++) {
    rightMultWithVectorFF(st.lap1, st.n, st.coords[k]!, st.b[k]!);
    stress += vectorsInnerProductF(st.n, st.coords[k]!, st.b[k]!);
  }
  stress *= 2;
  stress += st.constantTerm;
  for (let k = 0; k < st.dim; k++) {
    rightMultWithVectorFF(st.lap2, st.n, st.coords[k]!, st.tmpCoords);
    stress -= vectorsInnerProductF(st.n, st.coords[k]!, st.tmpCoords);
  }
  return stress;
}

/** Solve one axis, respecting pinned nodes. @see stress.c (CG block) */
function solveAxis(st: KernelState, k: number, havePinned: boolean, nodes: Node[]): number {
  if (!havePinned) {
    return conjugateGradientMkernel(st.lap2, st.coords[k]!, st.b[k]!, st.n, TOLERANCE_CG, st.n);
  }
  copyVectorF(st.n, st.coords[k]!, st.tmpCoords);
  const rc = conjugateGradientMkernel(st.lap2, st.tmpCoords, st.b[k]!, st.n, TOLERANCE_CG, st.n);
  if (rc < 0) return rc;
  for (let i = 0; i < st.n; i++) {
    if (!isFixed(nodes[i]!)) st.coords[k]![i] = st.tmpCoords[i]!;
  }
  return 0;
}

/** Options for stressMajorizationKDMkernel. */
export interface StressOpts {
  dim: number;
  /** opt_exp_flag (2 = squared weights, default) | opt_smart_init. */
  opts: number;
  /** MODEL_* — only the resulting Dij matters here; pass it in. */
  maxi: number;
  epsilon: number;
}

/**
 * Dense stress majorization. Mutates dCoords in place; returns the
 * iteration count (negative on error).
 * @see lib/neatogen/stress.c:stress_majorization_kD_mkernel
 */
export function stressMajorizationKDMkernel(
  Dij: Float32Array, n: number, dCoords: Float64Array[], nodes: Node[], o: StressOpts,
): number {
  const { dim, maxi } = o;
  const exp = o.opts & OPT_EXP_FLAG;
  if (maxi < 0) return 0;
  const havePinned = initLayout(n, dim, dCoords, nodes);
  if (n === 1 || maxi === 0) return 0;

  const coords: Float32Array[] = [];
  for (let i = 0; i < dim; i++) {
    const c = new Float32Array(n);
    for (let j = 0; j < n; j++) c[j] = fr(dCoords[i]![j]!);
    coords.push(c);
  }
  const constantTerm = fr((n * (n - 1)) / 2);
  const lap2 = Dij;
  buildLap2(lap2, n, exp);

  const lapLength = (n * (n + 1)) / 2;
  const st: KernelState = {
    n, dim, exp, lap2,
    lap1: new Float32Array(lapLength),
    coords,
    b: Array.from({ length: dim }, () => new Float32Array(n)),
    tmpCoords: new Float32Array(n),
    constantTerm,
  };

  let oldStress = Number.MAX_VALUE;
  let converged = false;
  let iterations = 0;
  for (; iterations < maxi && !converged; iterations++) {
    buildLap1(st.lap1, lap2, coords, { n, dim, exp });
    const newStress = computeStress(st);
    if (typeof process !== 'undefined' && process.env['STRESS_DEBUG'] && iterations % 5 === 0) console.error(newStress.toFixed(3));
    const change = Math.abs(oldStress - newStress);
    converged = change / oldStress < o.epsilon || newStress < o.epsilon;
    oldStress = newStress;
    for (let k = 0; k < dim; k++) {
      if (solveAxis(st, k, havePinned, nodes) < 0) return -1;
    }
  }

  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < n; j++) dCoords[i]![j] = coords[i]![j]!;
  }
  return iterations;
}
