// SPDX-License-Identifier: EPL-2.0

/**
 * VPSC-based overlap removal for the neato layout engine.
 *
 * Two independent VPSC passes (X then Y) ensure that no two node bounding
 * boxes intersect after the call returns. Each pass builds its own Variables,
 * Rectangles, and Constraints; none are shared between passes.
 *
 * @see lib/neatogen/adjust.c:vpscAdjust
 * @see lib/vpsc/csolve_VPSC.h
 */

import type { Node } from '../../model/node.js';
import {
  newVariable,
  deleteVariable,
  deleteVPSC,
  deleteConstraints,
  solveVPSC,
  genXConstraints,
  genYConstraints,
  type Variable,
  type Constraint,
  VPSC,
  Rectangle,
} from '../../vpsc/index.js';

/**
 * Builds one Rectangle per node centred on pos[], expanding each half-size
 * by sep/2 so the VPSC gap `(w_i+w_j)/2` incorporates the padding.
 *
 * @see lib/neatogen/adjust.c:vpscAdjust
 */
export function buildRectangles(
  nodes: Node[],
  sep: { x: number; y: number },
): Rectangle[] {
  return nodes.map((n) => {
    const x = n.info.pos?.[0] ?? 0;
    const y = n.info.pos?.[1] ?? 0;
    const hw = n.info.width / 2 + sep.x / 2;
    const hh = n.info.height / 2 + sep.y / 2;
    return new Rectangle(x - hw, x + hw, y - hh, y + hh);
  });
}

/**
 * Allocates one Variable per node for a single VPSC axis pass.
 *
 * @see lib/vpsc/csolve_VPSC.h:newVariable
 */
export function allocateVariables(nodes: Node[], axis: 0 | 1): Variable[] {
  return nodes.map((n, i) => newVariable(i, n.info.pos?.[axis] ?? 0, 1));
}

/**
 * Writes solved positions back into node.info.pos[axis].
 *
 * @see lib/neatogen/adjust.c:vpscAdjust (position write-back loop)
 */
export function writePositions(
  nodes: Node[],
  vars: Variable[],
  axis: 0 | 1,
): void {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (!n.info.pos) n.info.pos = [0, 0];
    n.info.pos[axis] =
      vars[i]!.block !== null ? vars[i]!.position() : vars[i]!.desiredPosition;
  }
}

/**
 * Tears down a VPSC pass in mandatory order (AD-4):
 * deleteVPSC → deleteConstraints → deleteVariable per variable.
 *
 * @see lib/neatogen/adjust.c:vpscAdjust teardown sequence
 */
export function teardownPass(
  vpsc: VPSC,
  constraints: Constraint[],
  vars: Variable[],
): void {
  deleteVPSC(vpsc);
  deleteConstraints(constraints);
  for (const v of vars) deleteVariable(v);
}

/**
 * Runs one complete VPSC axis pass: solve constraints then write positions.
 *
 * @see lib/neatogen/adjust.c:vpscAdjust
 */
export function runAxisPass(
  nodes: Node[],
  sep: { x: number; y: number },
  constraints: Constraint[],
  vars: Variable[],
  axis: 0 | 1,
): void {
  const vpsc = new VPSC(vars, constraints);
  solveVPSC(vpsc);
  writePositions(nodes, vars, axis);
  teardownPass(vpsc, constraints, vars);
}

/**
 * One full VPSC pass on the X axis.
 *
 * @see lib/neatogen/adjust.c:vpscAdjust (X pass section)
 */
export function runXPass(
  nodes: Node[],
  sep: { x: number; y: number },
): void {
  const rects = buildRectangles(nodes, sep);
  const vars = allocateVariables(nodes, 0);
  const cs = genXConstraints(rects, vars, true);
  runAxisPass(nodes, sep, cs, vars, 0);
}

/**
 * One full VPSC pass on the Y axis.
 *
 * @see lib/neatogen/adjust.c:vpscAdjust (Y pass section)
 */
export function runYPass(
  nodes: Node[],
  sep: { x: number; y: number },
): void {
  const rects = buildRectangles(nodes, sep);
  const vars = allocateVariables(nodes, 1);
  const cs = genYConstraints(rects, vars);
  runAxisPass(nodes, sep, cs, vars, 1);
}

/**
 * Removes overlaps between nodes using two independent VPSC passes (X then Y).
 *
 * After this call no two node bounding boxes intersect (with sep padding).
 * Positions are written into node.info.pos[0] (X) and node.info.pos[1] (Y).
 *
 * @param nodes - Nodes with info.pos, info.width, info.height set.
 * @param sep   - Minimum padding added beyond each node's half-size per axis.
 *
 * @see lib/neatogen/adjust.c:vpscAdjust
 * @see lib/vpsc/csolve_VPSC.h
 */
export function removeOverlap(
  nodes: Node[],
  sep: { x: number; y: number },
): void {
  if (nodes.length < 2) return;
  runXPass(nodes, sep);
  runYPass(nodes, sep);
}
