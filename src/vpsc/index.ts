// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript bridge for the VPSC solver — mirrors csolve_VPSC.h.
 *
 * Also exports Rectangle and constraint-generation functions ported from
 * generate-constraints.cpp.
 *
 * @see lib/vpsc/csolve_VPSC.h
 * @see lib/vpsc/csolve_VPSC.cpp
 * @see lib/vpsc/generate-constraints.h
 * @see lib/vpsc/generate-constraints.cpp
 */

import { Variable } from "./Variable.js";
import { Constraint } from "./Constraint.js";
import { Rectangle, VPSC, IncVPSC } from "./Solver.js";
import { generateXConstraints, generateYConstraints } from "./SweepLine.js";

export { Variable, Constraint, Rectangle, VPSC, IncVPSC };

// ---------------------------------------------------------------------------
// Variable bridge
// @see lib/vpsc/csolve_VPSC.cpp
// ---------------------------------------------------------------------------

/** @see csolve_VPSC.cpp: Variable* newVariable(int id, double desiredPos, double weight) */
export function newVariable(id: number, desiredPos: number, weight: number): Variable {
  return new Variable(id, desiredPos, weight);
}

/** @see csolve_VPSC.cpp: void deleteVariable(Variable* v) */
export function deleteVariable(_v: Variable): void {
  // No heap allocation in TS; GC handles cleanup.
}

/** @see csolve_VPSC.cpp: void setVariableDesiredPos(Variable *, double) */
export function setVariableDesiredPos(v: Variable, pos: number): void {
  v.desiredPosition = pos;
}

/** @see csolve_VPSC.cpp: double getVariablePos(const Variable*) */
export function getVariablePos(v: Variable): number {
  return v.position();
}

// ---------------------------------------------------------------------------
// Constraint bridge
// @see lib/vpsc/csolve_VPSC.cpp
// ---------------------------------------------------------------------------

/** @see csolve_VPSC.cpp: Constraint* newConstraint(...) */
export function newConstraint(left: Variable, right: Variable, gap: number): Constraint {
  return new Constraint(left, right, gap);
}

/** @see csolve_VPSC.cpp: void deleteConstraint(Constraint* c) */
export function deleteConstraint(c: Constraint): void {
  c.destroy();
}

/** @see csolve_VPSC.cpp: void deleteConstraints(int m, Constraint **cs) */
export function deleteConstraints(cs: Constraint[]): void {
  for (const c of cs) c.destroy();
}

// ---------------------------------------------------------------------------
// VPSC bridge
// @see lib/vpsc/csolve_VPSC.cpp
// ---------------------------------------------------------------------------

/** @see csolve_VPSC.cpp: VPSC* newIncVPSC(int n, Variable* vs[], int m, Constraint* cs[]) */
export function newIncVPSC(vs: Variable[], cs: Constraint[]): IncVPSC {
  return new IncVPSC(vs, cs);
}

/**
 * Call in order: deleteVPSC → deleteConstraints → deleteVariable.
 * deleteVPSC releases block structures. Constraints still reference
 * Variables; delete constraints before variables to avoid dangling refs.
 *
 * @see csolve_VPSC.cpp: void deleteVPSC(VPSC *vpsc)
 */
export function deleteVPSC(_vpsc: VPSC): void {
  // No heap allocation in TS; documents teardown order only.
}

/** @see csolve_VPSC.cpp: void satisfyVPSC(VPSC* vpsc) */
export function satisfyVPSC(vpsc: VPSC): void {
  vpsc.satisfy();
}

/** @see csolve_VPSC.cpp: void solveVPSC(VPSC* vpsc) */
export function solveVPSC(vpsc: VPSC): void {
  vpsc.solve();
}

// ---------------------------------------------------------------------------
// Constraint generation
// @see lib/vpsc/generate-constraints.cpp: generateXConstraints, generateYConstraints
// @see lib/vpsc/csolve_VPSC.cpp: genXConstraints, genYConstraints
// ---------------------------------------------------------------------------

/**
 * Prepares constraints to apply VPSC horizontally (X axis).
 * @see lib/vpsc/csolve_VPSC.cpp: genXConstraints
 */
export function genXConstraints(
  rects: Rectangle[],
  vs: Variable[],
  useNeighbourLists: boolean
): Constraint[] {
  return generateXConstraints(rects, vs, useNeighbourLists);
}

/**
 * Prepares constraints to apply VPSC vertically (Y axis).
 * @see lib/vpsc/csolve_VPSC.cpp: genYConstraints
 */
export function genYConstraints(rects: Rectangle[], vs: Variable[]): Constraint[] {
  return generateYConstraints(rects, vs);
}
