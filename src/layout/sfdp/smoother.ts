// SPDX-License-Identifier: EPL-2.0
/**
 * Post-layout smoother stub.
 * @see lib/sfdpgen/SpringSmoother.c
 */

import type { SparseMatrix } from '../../sparse/SparseMatrix.js';

export const SMOOTHING_NONE = 0;
export const SMOOTHING_STRESS_MAJORIZATION_GRAPH_DIST = 1;
export const SMOOTHING_STRESS_MAJORIZATION_AVG_DIST = 2;
export const SMOOTHING_STRESS_MAJORIZATION_POWER_DIST = 3;
export const SMOOTHING_SPRING = 4;
export const SMOOTHING_TRIANGLE = 5;

/**
 * Apply post-layout smoothing.
 * Currently only SMOOTHING_NONE (0) is active; all other variants are stubs.
 * @see lib/sfdpgen/SpringSmoother.c
 */
export function postProcess(
  smoothing: number,
  _A: SparseMatrix,
  _dim: number,
  _x: Float64Array,
  _n: number,
): void {
  if (smoothing === SMOOTHING_NONE) return;
  /* TODO: port SpringSmoother.c variants; currently all non-NONE paths are no-ops */
}
