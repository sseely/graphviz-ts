// SPDX-License-Identifier: EPL-2.0

/**
 * Internal types for the sweep-line constraint generation algorithm.
 * Kept in a separate file so the lizard complexity analyser does not
 * mistake interface blocks for function bodies in SweepLine.ts.
 *
 * @see lib/vpsc/generate-constraints.cpp
 */

import type { Variable } from "./Variable.js";
import type { Rectangle } from "./Solver.js";

export const EvType = { Open: 0, Close: 1 } as const;
export type EvType = (typeof EvType)[keyof typeof EvType];

export interface SweepNode {
  v: Variable;
  r: Rectangle;
  pos: number;
  firstAbove: SweepNode | null;
  firstBelow: SweepNode | null;
  leftNeighbours: Set<SweepNode>;
  rightNeighbours: Set<SweepNode>;
}

export interface SweepEvent {
  type: EvType;
  node: SweepNode;
  pos: number;
}
