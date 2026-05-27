// SPDX-License-Identifier: EPL-2.0

/**
 * VPSC, IncVPSC, and Rectangle.
 *
 * @see lib/vpsc/solve_VPSC.h
 * @see lib/vpsc/solve_VPSC.cpp
 * @see lib/vpsc/generate-constraints.h  (Rectangle)
 * @see lib/vpsc/generate-constraints.cpp (Rectangle)
 */

import { Variable } from "./Variable.js";
import { Constraint } from "./Constraint.js";
import { Block } from "./Block.js";
import { Blocks } from "./Blocks.js";

// ---------------------------------------------------------------------------
// Rectangle
// Ported from lib/vpsc/generate-constraints.h + generate-constraints.cpp
// ---------------------------------------------------------------------------

/**
 * An axis-aligned rectangle used as input to constraint generation.
 *
 * @see lib/vpsc/generate-constraints.h: class Rectangle
 * @see lib/vpsc/generate-constraints.cpp: Rectangle::Rectangle(...)
 */
export class Rectangle {
  private minX: number;
  private maxX: number;
  private minY: number;
  private maxY: number;

  constructor(x: number, X: number, y: number, Y: number) {
    this.minX = x;
    this.maxX = X;
    this.minY = y;
    this.maxY = Y;
  }

  getMaxX(): number { return this.maxX; }
  getMaxY(): number { return this.maxY; }
  getMinX(): number { return this.minX; }
  getMinY(): number { return this.minY; }
  getCentreX(): number { return this.minX + this.width() / 2.0; }
  getCentreY(): number { return this.minY + this.height() / 2.0; }
  width(): number { return this.maxX - this.minX; }
  height(): number { return this.maxY - this.minY; }

  /** @see lib/vpsc/generate-constraints.h: double overlapX(const Rectangle &r) const */
  overlapX(r: Rectangle): number {
    if (this.getCentreX() <= r.getCentreX() && r.getMinX() < this.maxX)
      return this.maxX - r.getMinX();
    if (r.getCentreX() <= this.getCentreX() && this.minX < r.getMaxX())
      return r.getMaxX() - this.minX;
    return 0;
  }

  /** @see lib/vpsc/generate-constraints.h: double overlapY(const Rectangle &r) const */
  overlapY(r: Rectangle): number {
    if (this.getCentreY() <= r.getCentreY() && r.getMinY() < this.maxY)
      return this.maxY - r.getMinY();
    if (r.getCentreY() <= this.getCentreY() && this.minY < r.getMaxY())
      return r.getMaxY() - this.minY;
    return 0;
  }
}

// ---------------------------------------------------------------------------
// VPSC
// @see lib/vpsc/solve_VPSC.h
// @see lib/vpsc/solve_VPSC.cpp
// ---------------------------------------------------------------------------

/**
 * Variable Placement with Separation Constraints problem instance.
 *
 * @see lib/vpsc/solve_VPSC.h: struct VPSC
 * @see lib/vpsc/solve_VPSC.cpp
 */
export class VPSC {
  protected bs: Blocks;
  protected cs: Constraint[];

  /** @see lib/vpsc/solve_VPSC.cpp: VPSC::VPSC(...) */
  constructor(vs: Variable[], cs: Constraint[]) {
    this.bs = new Blocks(vs);
    this.cs = cs;
  }

  /**
   * Phase 1 (feasibility): topological sort, mergeLeft per variable, cleanup,
   * then verify no constraint has slack < -1e-7.
   * @see lib/vpsc/solve_VPSC.cpp: VPSC::satisfy()
   */
  satisfy(): void {
    const vs = this.bs.totalOrder();
    for (const v of vs) {
      if (!v.block!.deleted) this.bs.mergeLeft(v.block!);
    }
    this.bs.cleanup();
    this.verifyConstraints();
  }

  /** @see lib/vpsc/solve_VPSC.cpp: VPSC::refine() */
  private refine(): void {
    for (let solved = false; !solved;) {
      solved = true;
      for (const b of this.bs) {
        b.setUpInConstraints();
        b.setUpOutConstraints();
      }
      for (const b of this.bs) {
        const c = b.findMinLM();
        if (c !== null && c.lm < 0) {
          this.bs.split(b, c);
          this.bs.cleanup();
          solved = false;
          break;
        }
      }
    }
    this.verifyConstraints();
  }

  /**
   * Throw if any constraint has slack < -1e-7.
   * Shared between satisfy() and refine().
   */
  private verifyConstraints(): void {
    for (const c of this.cs) {
      if (c.slack() < -0.0000001) throw new Error("Unsatisfied constraint");
    }
  }

  /**
   * Optimal solution: satisfy() then refine().
   * @see lib/vpsc/solve_VPSC.cpp: VPSC::solve()
   */
  solve(): void {
    this.satisfy();
    this.refine();
  }
}

// ---------------------------------------------------------------------------
// IncVPSC
// @see lib/vpsc/solve_VPSC.h: struct IncVPSC
// @see lib/vpsc/solve_VPSC.cpp
// ---------------------------------------------------------------------------

/**
 * Incremental VPSC solver — allows refinement after blocks are moved.
 *
 * @see lib/vpsc/solve_VPSC.h: struct IncVPSC
 * @see lib/vpsc/solve_VPSC.cpp
 */
export class IncVPSC extends VPSC {
  splitCnt: number;
  private inactive: Constraint[];

  /** @see lib/vpsc/solve_VPSC.cpp: IncVPSC::IncVPSC(...) */
  constructor(vs: Variable[], cs: Constraint[]) {
    super(vs, cs);
    this.splitCnt = 0;
    this.inactive = cs.slice();
    for (const c of this.inactive) c.active = false;
  }

  /**
   * Incremental satisfy: split blocks, then merge across most-violated
   * inactive constraint until none remain violated.
   * @see lib/vpsc/solve_VPSC.cpp: IncVPSC::satisfy()
   */
  override satisfy(): void {
    this.splitBlocks();
    let splitCtr = 0;
    let v: Constraint | null = null;
    while (this.mostViolated((c) => { v = c; }) < -0.0000001) {
      const vc = v!;
      const lb = vc.left.block!;
      const rb = vc.right.block!;
      if (lb !== rb) {
        lb.mergeTwoArg(rb, vc);
      } else {
        if (++splitCtr > 10000) throw new Error("Cycle Error!");
        const [splitC, newLb, newRb] = lb.splitBetween(vc.left, vc.right);
        this.inactive.push(splitC);
        newLb.mergeTwoArg(newRb, vc);
        this.bs.insert(newLb);
      }
    }
    this.bs.cleanup();
    for (const c of this.cs) {
      if (c.slack() < -0.0000001) throw new Error("Unsatisfied constraint");
    }
  }

  /**
   * Move each block to its optimal unconstrained position.
   * @see lib/vpsc/solve_VPSC.cpp: IncVPSC::moveBlocks()
   */
  moveBlocks(): void {
    for (const b of this.bs) {
      b.wposn = b.desiredWeightedPosition();
      b.posn = b.wposn / b.weight;
    }
  }

  /**
   * Move blocks then split each block where min-LM constraint is negative.
   * @see lib/vpsc/solve_VPSC.cpp: IncVPSC::splitBlocks()
   */
  splitBlocks(): void {
    this.moveBlocks();
    this.splitCnt = 0;
    for (const b of this.bs) {
      const v = b.findMinLM();
      if (v !== null && v.lm < -0.0000001) {
        this.splitCnt++;
        const b2 = v.left.block!;
        const pos = b2.posn;
        const [l, r] = b2.splitInto(v);
        l.posn = pos; l.wposn = pos * l.weight;
        r.posn = pos; r.wposn = pos * r.weight;
        this.bs.insert(l);
        this.bs.insert(r);
        b2.deleted = true;
        this.inactive.push(v);
      }
    }
    this.bs.cleanup();
  }

  /**
   * Convergence loop: |Δcost| ≤ 0.0001.
   * @see lib/vpsc/solve_VPSC.cpp: IncVPSC::solve()
   */
  override solve(): void {
    let lastCost = Infinity;
    let cost = this.bs.cost();
    do {
      lastCost = cost;
      this.satisfy();
      this.splitBlocks();
      cost = this.bs.cost();
    } while (Math.abs(lastCost - cost) > 0.0001);
  }

  /**
   * Finds the most violated inactive constraint. Removes it via swap-and-pop.
   * @see lib/vpsc/solve_VPSC.cpp: IncVPSC::mostViolated
   */
  private mostViolated(setV: (c: Constraint) => void): number {
    let minSlack = Number.MAX_VALUE;
    let deletePoint = -1;
    const l = this.inactive;
    for (let i = 0; i < l.length; i++) {
      const slack = l[i]!.slack();
      if (slack < minSlack) {
        minSlack = slack;
        setV(l[i]!);
        deletePoint = i;
      }
    }
    if (deletePoint !== -1 && minSlack < -0.0000001) {
      l[deletePoint] = l[l.length - 1]!;
      l.pop();
    }
    return minSlack;
  }
}

export { Block, Blocks };
