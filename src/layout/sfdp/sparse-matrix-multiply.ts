// SPDX-License-Identifier: EPL-2.0

/**
 * SparseMatrix products and the supervariable decomposition used by
 * multilevel coarsening. Row entry order is the C mask-accumulator
 * append order (NOT sorted) — load-bearing downstream.
 *
 * @see lib/sparse/SparseMatrix.c (15.0.0)
 */

import {
  type SpMatrix,
  smNew,
  FORMAT_CSR,
} from './sparse-matrix.js';

/**
 * C = A·B (REAL). Two-phase: count distinct columns per output, then
 * mask-accumulate values in encounter order.
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_multiply
 */
export function smMultiply(A: SpMatrix, B: SpMatrix): SpMatrix {
  const C = smNew(A.m, B.n, A.type, FORMAT_CSR);
  const mask = new Array<number>(B.n).fill(-1);
  let nz = 0;
  C.ia[0] = 0;
  for (let i = 0; i < A.m; i++) {
    for (let j = A.ia[i]!; j < A.ia[i + 1]!; j++) {
      nz = multiplyRowPair(A.a![j]!, B, A.ja[j]!, C, mask, i, nz);
    }
    C.ia[i + 1] = nz;
  }
  C.nz = nz;
  return C;
}

/** Accumulate aij × (row jj of B) into output row i. */
function multiplyRowPair(
  aij: number, B: SpMatrix, jj: number,
  C: SpMatrix, mask: number[], i: number, nz: number,
): number {
  const b = B.a!;
  const c = C.a!;
  for (let k = B.ia[jj]!; k < B.ia[jj + 1]!; k++) {
    const col = B.ja[k]!;
    if (mask[col]! < C.ia[i]!) {
      mask[col] = nz;
      C.ja[nz] = col;
      c[nz] = aij * b[k]!;
      nz++;
    } else {
      c[mask[col]!]! += aij * b[k]!;
    }
  }
  return nz;
}

/**
 * D = A·B·C (REAL), accumulated in one triple loop (encounter order —
 * NOT the same float order as two pairwise multiplies).
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_multiply3
 */
export function smMultiply3(A: SpMatrix, B: SpMatrix, C: SpMatrix): SpMatrix {
  const D = smNew(A.m, C.n, A.type, FORMAT_CSR);
  const mask = new Array<number>(C.n).fill(-1);
  let nz = 0;
  D.ia[0] = 0;
  for (let i = 0; i < A.m; i++) {
    for (let j = A.ia[i]!; j < A.ia[i + 1]!; j++) {
      const jj = A.ja[j]!;
      for (let l = B.ia[jj]!; l < B.ia[jj + 1]!; l++) {
        nz = multiplyRowPair(
          A.a![j]! * B.a![l]!, C, B.ja[l]!, D, mask, i, nz);
      }
    }
    D.ia[i + 1] = nz;
  }
  D.nz = nz;
  return D;
}

/**
 * Group columns that share exactly the same row pattern (graph
 * modules) into supervariables.
 * The C walks an offset (nsuper++) pointer; here `ns` is indexed at
 * +1 during the partition-refinement phase.
 * @returns ncluster groups; cluster/clusterp in CSR-like layout
 * @see lib/sparse/SparseMatrix.c:SparseMatrix_decompose_to_supervariables
 */
export function smDecomposeToSupervariables(
  A: SpMatrix,
): { ncluster: number; cluster: number[]; clusterp: number[] } {
  const st: SuperState = {
    superOf: new Array<number>(A.n).fill(0),
    ns: new Array<number>(A.n + 1).fill(0),
    mask: new Array<number>(A.n).fill(-1),
    newmap: new Array<number>(A.n).fill(0),
    isup: 1,
  };
  st.ns[1 + 0] = A.n; /* every node belongs to super variable 0 by default */

  for (let i = 0; i < A.m; i++) refineByRow(A, st, i);

  return accumulateSupernodes(A.n, st);
}

/** Partition-refinement state; ns[1+s] = |group s| during refinement. */
interface SuperState {
  superOf: number[];
  ns: number[];
  mask: number[];
  newmap: number[];
  isup: number;
}

/** Split every group by membership in row i. @see SparseMatrix.c:1371-1411 */
function refineByRow(A: SpMatrix, st: SuperState, i: number): void {
  const { ia, ja } = A;
  const { superOf, ns, mask, newmap } = st;
  for (let j = ia[i]!; j < ia[i + 1]!; j++) {
    ns[1 + superOf[ja[j]!]!]!--; /* these entries move to different groups */
  }
  for (let j = ia[i]!; j < ia[i + 1]!; j++) {
    const isuper = superOf[ja[j]!]!;
    if (mask[isuper]! < i) {
      mask[isuper] = i;
      if (ns[1 + isuper] === 0) { /* whole group occurs in this row */
        ns[1 + isuper] = 1;
        newmap[isuper] = isuper;
      } else {
        newmap[isuper] = st.isup;
        ns[1 + st.isup] = 1;
        superOf[ja[j]!] = st.isup++;
      }
    } else {
      superOf[ja[j]!] = newmap[isuper]!;
      ns[1 + newmap[isuper]!]!++;
    }
  }
}

/** Prefix-sum groups into CSR-like layout. @see SparseMatrix.c:1420-1433 */
function accumulateSupernodes(
  n: number, st: SuperState,
): { ncluster: number; cluster: number[]; clusterp: number[] } {
  const { superOf, ns, newmap, isup } = st;
  ns[0] = 0;
  for (let i = 0; i < isup; i++) ns[i + 1]! += ns[i]!;

  const cluster = newmap;
  for (let i = 0; i < n; i++) {
    const isuper = superOf[i]!;
    cluster[ns[isuper]!] = i;
    ns[isuper] = ns[isuper]! + 1;
  }
  for (let i = isup; i > 0; i--) ns[i] = ns[i - 1]!;
  ns[0] = 0;

  return { ncluster: isup, cluster, clusterp: ns };
}
