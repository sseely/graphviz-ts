// SPDX-License-Identifier: EPL-2.0

/**
 * A variable in the VPSC (Variable Placement with Separation Constraints) problem.
 * Each variable has a desired position and a weight controlling how strongly it is
 * attracted to that position.
 *
 * @see lib/vpsc/variable.h
 * @see lib/vpsc/variable.cpp
 */

import type { Block } from "./Solver.js";
import type { Constraint } from "./Constraint.js";

export class Variable {
  /** Useful identifier, mirrored from C source `const int id`. */
  id: number;
  /** Desired (ideal) position for this variable. @see variable.h */
  desiredPosition: number;
  /** Weight controlling attraction to desiredPosition. @see variable.h */
  weight: number;
  /** Offset within the block. Mutated during block merges. @see variable.h */
  offset: number;
  /** Block this variable belongs to. Null until assigned by Blocks constructor. */
  block: Block | null;
  /** Visited flag used by topological sort in Blocks.totalOrder(). */
  visited: boolean;
  /** Constraints where this variable is the right endpoint. @see variable.h `in` */
  in: Constraint[];
  /** Constraints where this variable is the left endpoint. @see variable.h `out` */
  out: Constraint[];

  /**
   * @see lib/vpsc/variable.h: Variable(const int id_, const double desiredPos_, const double weight_)
   */
  constructor(id: number, desiredPos: number, weight: number) {
    this.id = id;
    this.desiredPosition = desiredPos;
    this.weight = weight;
    this.offset = 0;
    this.block = null;
    this.visited = false;
    this.in = [];
    this.out = [];
  }

  /**
   * Compute the current position: block reference position plus this variable's offset.
   * @see lib/vpsc/variable.h: double position() const { return block->posn+offset; }
   */
  position(): number {
    return this.block!.posn + this.offset;
  }
}
