// SPDX-License-Identifier: EPL-2.0

/**
 * A constraint determines a minimum spacing required between two variables:
 *   right.position() - left.position() >= gap
 *
 * @see lib/vpsc/constraint.h
 * @see lib/vpsc/constraint.cpp
 */

import type { Block } from "./Solver.js";
import { Variable } from "./Variable.js";

/**
 * Compare two constraints for ordering in a min-heap.
 * Ports the `compareConstraints` inline from constraint.h.
 *
 * @see lib/vpsc/constraint.h: static inline bool compareConstraints(...)
 */
export function compareConstraints(l: Constraint, r: Constraint): boolean {
  const NEG_MAX = -Number.MAX_VALUE;
  const sl =
    l.left.block!.timeStamp > l.timeStamp || l.left.block === l.right.block
      ? NEG_MAX
      : l.slack();
  const sr =
    r.left.block!.timeStamp > r.timeStamp || r.left.block === r.right.block
      ? NEG_MAX
      : r.slack();
  if (sl === sr) {
    if (l.left.id === r.left.id) {
      return l.right.id < r.right.id;
    }
    return l.left.id < r.left.id;
  }
  return sl < sr;
}

export class Constraint {
  left: Variable;
  right: Variable;
  gap: number;
  /** Lagrange multiplier. @see lib/vpsc/constraint.h */
  lm: number;
  /** Timestamp for block membership staleness detection. @see lib/vpsc/constraint.h */
  timeStamp: number;
  /** Whether this constraint is currently active (part of a block's spanning tree). */
  active: boolean;
  /** Visited flag used during DFS traversals. */
  visited: boolean;

  /**
   * Construct a constraint and register it on both variables.
   * @see lib/vpsc/constraint.cpp: Constraint::Constraint(...)
   */
  constructor(left: Variable, right: Variable, gap: number) {
    this.left = left;
    this.right = right;
    this.gap = gap;
    this.lm = 0;
    this.timeStamp = 0;
    this.active = false;
    this.visited = false;
    // Register: left.out.push_back(this); right.in.push_back(this)
    left.out.push(this);
    right.in.push(this);
  }

  /**
   * Compute slack: how much room exists above the minimum separation.
   * @see lib/vpsc/constraint.h: double slack() const { return right->position() - gap - left->position(); }
   */
  slack(): number {
    return this.right.position() - this.gap - this.left.position();
  }

  /**
   * Unregister this constraint from both variables' in/out lists.
   * Replaces the C++ destructor logic.
   * @see lib/vpsc/constraint.cpp: Constraint::~Constraint()
   */
  destroy(): void {
    const oi = this.left.out.indexOf(this);
    if (oi !== -1) this.left.out.splice(oi, 1);
    const ii = this.right.in.indexOf(this);
    if (ii !== -1) this.right.in.splice(ii, 1);
  }
}

/**
 * Re-export Block type used in compareConstraints so callers don't have a
 * circular dependency when they only need the type.
 */
export type { Block };
