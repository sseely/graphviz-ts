// SPDX-License-Identifier: EPL-2.0
/**
 * Spring-electrical control struct, constants, and factory.
 *
 * @see lib/sfdpgen/spring_electrical.h
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @see lib/sfdpgen/spring_electrical.h:AUTOP */
export const AUTOP = -1.0001234;

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

/** @see lib/sfdpgen/spring_electrical.c:C */
export const C_FORCE = 0.2;

/** @see lib/sfdpgen/spring_electrical.c:quadtree_size */
export const QUADTREE_SIZE = 45;

/** @see lib/sfdpgen/spring_electrical.c:bh */
export const BH = 0.6;

/** @see lib/sfdpgen/spring_electrical.c:tol */
export const TOL = 0.001;

/** @see lib/sfdpgen/spring_electrical.c:cool */
export const COOL = 0.90;

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
