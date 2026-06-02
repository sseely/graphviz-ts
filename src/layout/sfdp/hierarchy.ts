// SPDX-License-Identifier: EPL-2.0
/**
 * Multilevel graph coarsening via heavy-edge matching.
 *
 * @see lib/sfdpgen/Multilevel.c
 * @see lib/sfdpgen/Multilevel.h
 */

import {
  SparseMatrix,
  MATRIX_TYPE_REAL,
} from '../../sparse/SparseMatrix.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of building the coarsening hierarchy.
 * levels[0] = finest, levels[last] = coarsest.
 * prolongations[i] and restrictions[i] map levels[i+1] → levels[i].
 */
export interface HierarchyResult {
  levels: SparseMatrix[];
  prolongations: (SparseMatrix | null)[];
  restrictions: (SparseMatrix | null)[];
}

// ---------------------------------------------------------------------------
// Random permutation
// ---------------------------------------------------------------------------

/** Fisher-Yates shuffle of [0..n). */
export function buildPermutation(n: number): number[] {
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = perm[i]!; perm[i] = perm[j]!; perm[j] = tmp;
  }
  return perm;
}

// ---------------------------------------------------------------------------
// Heavy-edge matching
// ---------------------------------------------------------------------------

/** Find the unmatched neighbour connected by the heaviest edge. */
export function findHeaviestUnmatched(
  ia: Int32Array, ja: Int32Array,
  aVals: Float64Array | null, i: number, matched: Int32Array,
): number {
  let bestJ = -1, bestW = -1;
  for (let jj = ia[i]; jj < ia[i + 1]; jj++) {
    const j = ja[jj];
    if (j === i || matched[j] >= 0) continue;
    const w = aVals ? aVals[jj] : 1.0;
    if (w > bestW) { bestW = w; bestJ = j; }
  }
  return bestJ;
}

/** Assign each node to a coarse cluster via heavy-edge matching. */
export function matchNodes(A: SparseMatrix): Int32Array {
  const n = A.n;
  const ia = A.ia, ja = A.ja;
  const aVals = A.a as Float64Array | null;
  const matched = new Int32Array(n).fill(-1);
  const clusterOf = new Int32Array(n);
  const perm = buildPermutation(n);
  let nc = 0;
  for (let pi = 0; pi < n; pi++) {
    const i = perm[pi]!;
    if (matched[i] >= 0) continue;
    clusterOf[i] = nc; matched[i] = nc;
    const bestJ = findHeaviestUnmatched(ia, ja, aVals, i, matched);
    if (bestJ >= 0) { clusterOf[bestJ] = nc; matched[bestJ] = nc; }
    nc++;
  }
  return clusterOf;
}

// ---------------------------------------------------------------------------
// Prolongation / restriction matrix builders
// ---------------------------------------------------------------------------

/** Build P (n×nc): P[i, clusterOf[i]] = 1. */
export function buildP(n: number, nc: number, clusterOf: Int32Array): SparseMatrix {
  const P = SparseMatrix.new(n, nc, n, MATRIX_TYPE_REAL, 0);
  const ia = P.ia, ja = P.ja, pa = P.a as Float64Array;
  for (let i = 0; i <= n; i++) ia[i] = i;
  for (let i = 0; i < n; i++) { ja[i] = clusterOf[i]; pa[i] = 1.0; }
  P.nz = n;
  return P;
}

/** Build R (nc×n): R[c,i] = 1/count[c] for fine node i in cluster c. */
export function buildR(nc: number, n: number, clusterOf: Int32Array): SparseMatrix {
  const counts = new Int32Array(nc);
  for (let i = 0; i < n; i++) counts[clusterOf[i]]++;
  const R = SparseMatrix.new(nc, n, n, MATRIX_TYPE_REAL, 0);
  const ia = R.ia, ja = R.ja, ra = R.a as Float64Array;
  ia[0] = 0;
  for (let c = 0; c < nc; c++) ia[c + 1] = ia[c] + counts[c];
  const pos = new Int32Array(nc);
  for (let i = 0; i < n; i++) {
    const c = clusterOf[i], idx = ia[c] + pos[c];
    ja[idx] = i; ra[idx] = 1.0 / counts[c]; pos[c]++;
  }
  R.nz = n;
  return R;
}

// ---------------------------------------------------------------------------
// Galerkin coarsening: cA = R * A * P
// ---------------------------------------------------------------------------

/** Accumulate R*A*P into a dense nc×nc buffer. */
export function accumulateDense(A: SparseMatrix, P: SparseMatrix, R: SparseMatrix, nc: number): Float64Array {
  const dense = new Float64Array(nc * nc);
  const Ria = R.ia, Rja = R.ja, Ra = R.a as Float64Array;
  const Aia = A.ia, Aja = A.ja, Aa = A.a as Float64Array | null;
  const Pia = P.ia, Pja = P.ja, Pa = P.a as Float64Array | null;
  for (let ci = 0; ci < nc; ci++) {
    for (let ri = Ria[ci]; ri < Ria[ci + 1]; ri++) {
      const i = Rja[ri], rw = Ra[ri];
      for (let ai = Aia[i]; ai < Aia[i + 1]; ai++) {
        const j = Aja[ai], aw = Aa ? Aa[ai] : 1.0;
        for (let pi2 = Pia[j]; pi2 < Pia[j + 1]; pi2++) {
          dense[ci * nc + Pja[pi2]] += rw * aw * (Pa ? Pa[pi2] : 1.0);
        }
      }
    }
  }
  return dense;
}

/** Convert dense nc×nc to sparse CSR, skipping diagonal and zeros. */
export function denseToSparse(dense: Float64Array, nc: number): SparseMatrix {
  const irn: number[] = [], jcn: number[] = [], vals: number[] = [];
  for (let ci = 0; ci < nc; ci++) {
    for (let cj = 0; cj < nc; cj++) {
      if (ci === cj) continue;
      const v = dense[ci * nc + cj];
      if (v !== 0) { irn.push(ci); jcn.push(cj); vals.push(v); }
    }
  }
  const cA = SparseMatrix.fromCoordinateArrays(
    irn.length, nc, nc,
    new Int32Array(irn), new Int32Array(jcn), new Float64Array(vals),
    MATRIX_TYPE_REAL,
  );
  cA.isSymmetric = true; cA.isPatternSymmetric = true;
  return cA;
}

/** Compute coarse adjacency matrix via Galerkin projection cA = R*A*P. */
export function computeCoarseA(A: SparseMatrix, P: SparseMatrix, R: SparseMatrix): SparseMatrix {
  return denseToSparse(accumulateDense(A, P, R, R.m), R.m);
}

// ---------------------------------------------------------------------------
// Single-level coarsening step
// ---------------------------------------------------------------------------

interface CoarsenResult { P: SparseMatrix; R: SparseMatrix; cA: SparseMatrix }

/** Coarsen A by one level; returns null if no reduction is possible. */
export function coarsenOneLevel(A: SparseMatrix): CoarsenResult | null {
  const n = A.n;
  const clusterOf = matchNodes(A);
  const nc = 1 + Math.max(...Array.from(clusterOf));
  if (nc >= n) return null;
  const P = buildP(n, nc, clusterOf);
  const R = buildR(nc, n, clusterOf);
  return { P, R, cA: computeCoarseA(A, P, R) };
}

// ---------------------------------------------------------------------------
// Public API — placed last so Lizard measures only its short body
// ---------------------------------------------------------------------------

/**
 * Build the multilevel coarsening hierarchy for matrix A.
 * @see lib/sfdpgen/Multilevel.c:Multilevel_establish
 */
export function buildHierarchy(A: SparseMatrix, maxlevels: number): HierarchyResult {
  const levels: SparseMatrix[] = [A];
  const prolongations: (SparseMatrix | null)[] = [null];
  const restrictions: (SparseMatrix | null)[] = [null];
  const maxDepth = maxlevels <= 1 ? 0 : maxlevels > 0 ? maxlevels - 1 : 50;
  let current = A;
  for (let depth = 0; depth < maxDepth && current.n > 4; depth++) {
    const result = coarsenOneLevel(current);
    if (result === null || result.cA.n >= current.n) break;
    if (result.cA.n / current.n > 0.75 && depth > 0) break;
    levels.push(result.cA);
    prolongations.push(result.P);
    restrictions.push(result.R);
    current = result.cA;
  }
  return { levels, prolongations, restrictions };
}
