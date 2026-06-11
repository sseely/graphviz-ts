// SPDX-License-Identifier: EPL-2.0

/**
 * The multilevel spring-electrical driver: coarsest-to-finest
 * embedding with prolongation, principal-axis rotation, and the
 * ntry=0 ("prism0") slice of remove_overlap.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/sfdpgen/spring_electrical.c:multilevel_spring_electrical_embedding (15.0.0)
 * @see lib/neatogen/overlap.c:remove_overlap (15.0.0)
 */

import { fma } from '../../common/fma.js';
import { cdrand } from '../../common/crand.js';
import {
  type SpMatrix,
  smIsSymmetric,
  smGetRealAdjacencySymmetrized,
  smRemoveDiagonal,
  smMultiplyDense,
  MATRIX_TYPE_REAL,
} from './sparse-matrix.js';
import {
  type Multilevel,
  multilevelNew,
  multilevelGetCoarsest,
  multilevelIsFinest,
} from './multilevel.js';
import {
  type SpringElectricalControl,
  AUTOP,
  springElectricalEmbedding,
  averageEdgeLength,
} from './spring-electrical.js';

/** @see lib/sparse/general.h:MACHINEACC */
const MACHINEACC = 1.0e-16;

// ---------------------------------------------------------------------------
// Multilevel driver helpers
// ---------------------------------------------------------------------------

/** @see lib/sfdpgen/spring_electrical.c:power_law_graph */
export function powerLawGraph(A: SpMatrix): boolean {
  const { ia, ja, m } = A;
  const mask = new Array<number>(m + 1).fill(0);
  let max = 0;
  for (let i = 0; i < m; i++) {
    let deg = 0;
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      if (i === ja[j]) continue;
      deg++;
    }
    mask[deg]!++;
    max = Math.max(max, mask[deg]!);
  }
  return mask[1]! > 0.8 * max && mask[1]! > 0.3 * m;
}

/**
 * Principal-component rotation about the centroid.
 * @see lib/sfdpgen/spring_electrical.c:pcp_rotate
 */
export function pcpRotate(n: number, dim: number, x: number[]): void {
  const y = [0, 0, 0, 0];
  const center = [0, 0];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < dim; k++) center[k]! += x[i * dim + k]!;
  }
  for (let i = 0; i < dim; i++) center[i]! /= n;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < dim; k++) x[dim * i + k]! -= center[k]!;
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < dim; k++) {
      for (let l = 0; l < dim; l++) {
        y[dim * k + l] = fma(x[i * dim + k]!, x[i * dim + l]!, y[dim * k + l]!);
      }
    }
  }
  const axis = [0, 1];
  if (y[1] !== 0) {
    axis[0] = -(-y[0]! + y[3]! -
      Math.sqrt(y[0]! * y[0]! + 4 * y[1]! * y[1]! - 2 * y[0]! * y[3]! + y[3]! * y[3]!))
      / (2 * y[1]!);
    axis[1] = 1;
  }
  const dist = Math.sqrt(1 + axis[0]! * axis[0]!);
  axis[0] = axis[0]! / dist;
  axis[1] = axis[1]! / dist;
  for (let i = 0; i < n; i++) {
    const x0 = x[dim * i]! * axis[0]! + x[dim * i + 1]! * axis[1]!;
    const x1 = -x[dim * i]! * axis[1]! + x[dim * i + 1]! * axis[0]!;
    x[dim * i] = x0;
    x[dim * i + 1] = x1;
  }
}

/** Pull each node halfway toward its neighbor average. @see spring_electrical.c:interpolate_coord */
function interpolateCoord(dim: number, A: SpMatrix, x: number[]): void {
  const { ia, ja } = A;
  const alpha = 0.5;
  const y = new Array<number>(dim).fill(0);
  for (let i = 0; i < A.m; i++) {
    for (let k = 0; k < dim; k++) y[k] = 0;
    let nz = 0;
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      if (ja[j] === i) continue;
      nz++;
      for (let k = 0; k < dim; k++) {
        y[k]! += x[ja[j]! * dim + k]!;
      }
    }
    if (nz > 0) {
      const beta = (1 - alpha) / nz;
      for (let k = 0; k < dim; k++) {
        // binary fuses the first product: fma(alpha, x, beta·y)
        x[i * dim + k] = fma(alpha, x[i * dim + k]!, beta * y[k]!);
      }
    }
  }
}

/**
 * Prolong coarse positions to the finer level, smooth, and jitter the
 * non-representative cluster members.
 * @see lib/sfdpgen/spring_electrical.c:prolongate
 */
function prolongate(
  dim: number, A: SpMatrix, P: SpMatrix, R: SpMatrix,
  xc: number[], y: number[], delta: number,
): void {
  smMultiplyDense(P, xc, y, dim);
  interpolateCoord(dim, A, y);
  const nc = R.m;
  const { ia, ja } = R;
  for (let i = 0; i < nc; i++) {
    for (let j = ia[i]! + 1; j < ia[i + 1]!; j++) {
      for (let k = 0; k < dim; k++) {
        y[ja[j]! * dim + k] = fma(delta, cdrand() - 0.5, y[ja[j]! * dim + k]!);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// remove_overlap, ntry = 0 path (the only reachable path: "prism0")
// ---------------------------------------------------------------------------

/** Uniform scale so the average edge length = avgLabelSize. @see neatogen/overlap.c:scale_to_edge_length */
function scaleToEdgeLength(dim: number, A: SpMatrix, x: number[], avgLabelSize: number): void {
  let dist = averageEdgeLength(A, dim, x);
  dist = avgLabelSize / Math.max(dist, MACHINEACC);
  for (let i = 0; i < dim * A.m; i++) x[i]! *= dist;
}

/**
 * The reachable slice of remove_overlap: initial scaling only, then
 * `if (!ntry) return`. ntry > 0 (real prism) is not ported — sfdp's
 * default is "prism0" and no supported input overrides overlap.
 * @see lib/neatogen/overlap.c:remove_overlap (15.0.0)
 */
export function removeOverlapScalingOnly(
  dim: number, A: SpMatrix, x: number[], labelSizes: number[] | null,
  ntry: number, initialScaling: number,
): void {
  if (!labelSizes) return;
  if (initialScaling < 0) {
    let avgLabelSize = 0;
    for (let i = 0; i < A.m; i++) {
      avgLabelSize += labelSizes[i * dim]! + labelSizes[i * dim + 1]!;
    }
    avgLabelSize /= A.m;
    scaleToEdgeLength(dim, A, x, -initialScaling * avgLabelSize);
  } else if (initialScaling > 0) {
    scaleToEdgeLength(dim, A, x, initialScaling);
  }
  if (!ntry) return;
  throw new Error(
    `sfdp remove_overlap ntry=${ntry}: the prism OverlapSmoother is not ` +
    'ported (unreachable at sfdp defaults); see mission 8 journal');
}

// ---------------------------------------------------------------------------
// multilevel_spring_electrical_embedding
// ---------------------------------------------------------------------------

/**
 * Coarsen, embed coarsest-to-finest with prolongation, rotate to the
 * principal axis, and apply the overlap scaling.
 * The edge-label-scheme path is not ported (no |edgelabel| nodes in
 * any supported input).
 * @see lib/sfdpgen/spring_electrical.c:multilevel_spring_electrical_embedding
 */
export function multilevelSpringElectricalEmbedding(
  dim: number, A0: SpMatrix, ctrl: SpringElectricalControl,
  labelSizes: number[] | null, x: number[],
): void {
  const ctrl0 = { ...ctrl };
  const n = A0.n;
  if (n <= 0 || dim <= 0) return;

  let A = A0;
  if (!smIsSymmetric(A, false) || A.type !== MATRIX_TYPE_REAL) {
    A = smGetRealAdjacencySymmetrized(A);
  } else {
    A = smRemoveDiagonal(A);
  }

  const grid0 = multilevelNew(A, ctrl.multilevels);
  let grid: Multilevel | null = multilevelGetCoarsest(grid0);
  let xc: number[] = multilevelIsFinest(grid) ? x : new Array<number>(grid.n * dim).fill(0);

  const plg = powerLawGraph(A);
  if (ctrl.p === AUTOP) {
    ctrl.p = -1;
    if (plg) ctrl.p = -1.8;
  }

  for (;;) {
    springElectricalEmbedding(dim, grid!.A, ctrl, xc);
    if (multilevelIsFinest(grid!)) break;
    const P = grid!.P!;
    grid = grid!.prev;
    const xf: number[] = multilevelIsFinest(grid!)
      ? x
      : new Array<number>(grid!.n * dim).fill(0);
    prolongate(dim, grid!.A, P, grid!.R!, xc, xf, ctrl.K * 0.001);
    xc = xf;
    ctrl.randomStart = false;
    ctrl.K = ctrl.K * 0.75;
    ctrl.adaptiveCooling = false;
    ctrl.step = 0.1;
  }

  // post_process_smoothing: no-op for SMOOTHING_NONE (the default)

  /* rotation has to be done before overlap removal */
  if (dim === 2) pcpRotate(n, dim, x);
  // ctrl.rotation === 0 for all supported inputs (rotate() not ported)

  removeOverlapScalingOnly(dim, A, x, labelSizes, ctrl.overlap, ctrl.initialScaling);

  Object.assign(ctrl, ctrl0); // C: *ctrl = ctrl0
}
