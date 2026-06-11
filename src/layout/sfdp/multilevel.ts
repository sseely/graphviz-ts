// SPDX-License-Identifier: EPL-2.0

/**
 * Multilevel graph coarsening for sfdp: repeated heavy-edge matching
 * (visiting nodes in a gvPermutation random order, drawn from the
 * global crand stream) with supernode pre-clustering, building
 * prolongation/restriction operators between levels.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/sfdpgen/Multilevel.c (15.0.0)
 */

import { gvPermutation } from '../../common/crand.js';
import {
  type SpMatrix,
  smFromCoordinateArrays,
  smIsSymmetric,
  smGetRealAdjacencySymmetrized,
  smRemoveDiagonal,
  smDivideRowByDegree,
  smTranspose,
  MATRIX_TYPE_REAL,
} from './sparse-matrix.js';
import {
  smMultiply,
  smMultiply3,
  smDecomposeToSupervariables,
} from './sparse-matrix-multiply.js';

/** @see lib/sfdpgen/Multilevel.c:minsize */
const MINSIZE = 4;
/** @see lib/sfdpgen/Multilevel.c:min_coarsen_factor */
const MIN_COARSEN_FACTOR = 0.75;
/** @see lib/sfdpgen/Multilevel.h:MAX_CLUSTER_SIZE */
const MAX_CLUSTER_SIZE = 4;

/** @see lib/sfdpgen/Multilevel.h:Multilevel_struct */
export interface Multilevel {
  level: number;
  n: number;
  A: SpMatrix;
  /** Prolongation from this level to the FINER level. */
  P: SpMatrix | null;
  /** Restriction to the COARSER level. */
  R: SpMatrix | null;
  next: Multilevel | null;
  prev: Multilevel | null;
}

/** @see lib/sfdpgen/Multilevel.c:Multilevel_init */
function multilevelInit(A: SpMatrix): Multilevel {
  return { level: 0, n: A.n, A, P: null, R: null, next: null, prev: null };
}

/** Matching state for one coarsening pass. */
interface MatchState {
  cluster: number[];
  clusterp: number[];
  ncluster: number;
}

const MATCHED = -1;

/**
 * Group nodes: first whole supervariable groups (split at
 * MAX_CLUSTER_SIZE), then heaviest-edge pairs visiting nodes in a
 * random permutation, then singletons.
 * @see Multilevel.c:maximal_independent_edge_set_heavest_edge_pernode_supernodes_first
 */
function heaviestEdgeMatching(A: SpMatrix): MatchState {
  const m = A.m;
  const st: MatchState = {
    cluster: new Array<number>(m).fill(0),
    clusterp: new Array<number>(m + 1).fill(0),
    ncluster: 0,
  };
  const matched: number[] = [];
  for (let i = 0; i < m; i++) matched.push(i);

  let nz = matchSupernodes(A, st, matched);
  nz = matchHeaviestPairs(A, st, matched, nz);

  for (let i = 0; i < m; i++) {
    if (matched[i] === i) {
      st.cluster[nz++] = i;
      st.clusterp[++st.ncluster] = nz;
    }
  }
  return st;
}

/** Pre-cluster supervariable groups. @see Multilevel.c:88-100 */
function matchSupernodes(A: SpMatrix, st: MatchState, matched: number[]): number {
  const { ncluster: nsuper, cluster: superArr, clusterp: superp } =
    smDecomposeToSupervariables(A);
  let nz = 0;
  for (let i = 0; i < nsuper; i++) {
    if (superp[i + 1]! - superp[i]! <= 1) continue;
    let nz0 = st.clusterp[st.ncluster]!;
    for (let j = superp[i]!; j < superp[i + 1]!; j++) {
      matched[superArr[j]!] = MATCHED;
      st.cluster[nz++] = superArr[j]!;
      if (nz - nz0 >= MAX_CLUSTER_SIZE) {
        st.clusterp[++st.ncluster] = nz;
        nz0 = nz;
      }
    }
    if (nz > nz0) st.clusterp[++st.ncluster] = nz;
  }
  return nz;
}

/** Heaviest-edge pairing in random node order. @see Multilevel.c:102-129 */
function matchHeaviestPairs(
  A: SpMatrix, st: MatchState, matched: number[], nzIn: number,
): number {
  const { ia, ja, m } = A;
  const a = A.a!;
  let nz = nzIn;
  const p = gvPermutation(m);
  for (let ii = 0; ii < m; ii++) {
    const i = p[ii]!;
    let first = true;
    let amax = 0;
    let jamax = 0;
    if (matched[i] === MATCHED) continue;
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      if (i === ja[j]) continue;
      if (matched[ja[j]!] !== MATCHED && matched[i] !== MATCHED) {
        if (first) {
          amax = a[j]!;
          jamax = ja[j]!;
          first = false;
        } else if (a[j]! > amax) {
          amax = a[j]!;
          jamax = ja[j]!;
        }
      }
    }
    if (!first) {
      matched[jamax] = MATCHED;
      matched[i] = MATCHED;
      st.cluster[nz++] = i;
      st.cluster[nz++] = jamax;
      st.clusterp[++st.ncluster] = nz;
    }
  }
  return nz;
}

/**
 * One coarsening step: matching → P/R → cA = R·A·P.
 * @see lib/sfdpgen/Multilevel.c:Multilevel_coarsen_internal
 */
function coarsenInternal(
  A: SpMatrix,
): { cA: SpMatrix; P: SpMatrix; R: SpMatrix } | null {
  const n = A.m;
  const { cluster, clusterp, ncluster } = heaviestEdgeMatching(A);
  const nc = ncluster;
  if (nc === n || nc < MINSIZE) return null;

  const irn: number[] = new Array<number>(n).fill(0);
  const jcn: number[] = new Array<number>(n).fill(0);
  const val: number[] = new Array<number>(n).fill(0);
  let nzc = 0;
  for (let i = 0; i < ncluster; i++) {
    for (let j = clusterp[i]!; j < clusterp[i + 1]!; j++) {
      irn[nzc] = cluster[j]!;
      jcn[nzc] = i;
      val[nzc++] = 1.0;
    }
  }
  const P = smFromCoordinateArrays(nzc, n, nc, { irn, jcn, val }, MATRIX_TYPE_REAL);
  let R = smTranspose(P);

  const cA = smMultiply3(R, A, P);

  R = smDivideRowByDegree(R);
  cA.isSymmetric = true;
  cA.isPatternSymmetric = true;
  smRemoveDiagonal(cA);
  return { cA, P, R };
}

/**
 * Coarsen until a sufficient size reduction (composing P/R across
 * insufficient steps).
 * @see lib/sfdpgen/Multilevel.c:Multilevel_coarsen
 */
function coarsen(
  A0: SpMatrix,
): { cA: SpMatrix; P: SpMatrix; R: SpMatrix } | null {
  let A = A0;
  const n = A0.n;
  let P: SpMatrix | null = null;
  let R: SpMatrix | null = null;
  let cA: SpMatrix | null = null;
  let nc = 0;

  do { /* this loop forces a sufficient reduction */
    const step = coarsenInternal(A);
    if (step === null) {
      return cA === null ? null : { cA, P: P!, R: R! };
    }
    nc = step.cA.n;
    if (P !== null) {
      P = smMultiply(P, step.P);
      R = smMultiply(step.R, R!);
    } else {
      P = step.P;
      R = step.R;
    }
    cA = step.cA;
    A = cA;
  } while (nc > MIN_COARSEN_FACTOR * n);

  return { cA: cA!, P: P!, R: R! };
}

/** @see lib/sfdpgen/Multilevel.c:Multilevel_establish */
function establish(grid: Multilevel, maxlevel: number): void {
  if (grid.level >= maxlevel - 1) return;
  const step = coarsen(grid.A);
  if (step === null) return;

  const cgrid = multilevelInit(step.cA);
  grid.next = cgrid;
  cgrid.level = grid.level + 1;
  cgrid.n = step.cA.m;
  cgrid.P = step.P;
  grid.R = step.R;
  cgrid.prev = grid;
  establish(cgrid, maxlevel);
}

/**
 * Build the multilevel hierarchy for weighting matrix A.
 * @see lib/sfdpgen/Multilevel.c:Multilevel_new
 */
export function multilevelNew(A0: SpMatrix, maxlevel: number): Multilevel {
  let A = A0;
  if (!smIsSymmetric(A, false) || A.type !== MATRIX_TYPE_REAL) {
    A = smGetRealAdjacencySymmetrized(A);
  }
  const grid = multilevelInit(A);
  establish(grid, maxlevel);
  return grid;
}

/** @see lib/sfdpgen/Multilevel.c:Multilevel_get_coarsest */
export function multilevelGetCoarsest(grid: Multilevel): Multilevel {
  let g = grid;
  while (g.next !== null) g = g.next;
  return g;
}

/** Multilevel_is_finest. @see lib/sfdpgen/Multilevel.h */
export function multilevelIsFinest(grid: Multilevel): boolean {
  return grid.prev === null;
}
