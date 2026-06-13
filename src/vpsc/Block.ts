// SPDX-License-Identifier: EPL-2.0

/**
 * Block: a group of variables that must be moved together to satisfy active
 * constraints. Variables in a block are spanned by a tree of active constraints.
 *
 * @see lib/vpsc/block.h
 * @see lib/vpsc/block.cpp
 */

import { Variable } from "./Variable.js";
import { Constraint } from "./Constraint.js";
import {
  makeHeap,
  heapFindMin,
  heapDeleteMin,
  heapInsert,
  mergeHeaps,
} from "./HeapUtils.js";

const enum Direction { NONE, LEFT, RIGHT }

export class Block {
  vars: Variable[];
  posn: number;
  weight: number;
  wposn: number;
  deleted: boolean;
  timeStamp: number;
  /** In-constraint min-heap: external constraints arriving at this block. */
  in: Constraint[];
  /** Out-constraint min-heap: external constraints leaving this block. */
  out: Constraint[];

  /** Shared reference to the owning Blocks instance's blockTimeCtr. */
  readonly timeCtr: { value: number };

  /** @see lib/vpsc/block.cpp: Block::Block(Variable *v) */
  constructor(timeCtr: { value: number }, v?: Variable) {
    this.timeCtr = timeCtr;
    this.timeStamp = 0;
    this.posn = 0;
    this.weight = 0;
    this.wposn = 0;
    this.deleted = false;
    this.vars = [];
    this.in = [];
    this.out = [];
    if (v !== undefined) {
      v.offset = 0;
      this.addVariable(v);
    }
  }

  /** @see lib/vpsc/block.cpp: Block::addVariable */
  addVariable(v: Variable): void {
    v.block = this;
    this.vars.push(v);
    this.weight += v.weight;
    this.wposn += v.weight * (v.desiredPosition - v.offset);
    this.posn = this.wposn / this.weight;
  }

  /** @see lib/vpsc/block.cpp: Block::desiredWeightedPosition */
  desiredWeightedPosition(): number {
    let wp = 0;
    for (const v of this.vars) {
      wp += (v.desiredPosition - v.offset) * v.weight;
    }
    return wp;
  }

  /** @see lib/vpsc/block.cpp: Block::setUpInConstraints */
  setUpInConstraints(): void {
    this.in = this.setupHeap(true);
  }

  /** @see lib/vpsc/block.cpp: Block::setUpOutConstraints */
  setUpOutConstraints(): void {
    this.out = this.setupHeap(false);
  }

  /** @see lib/vpsc/block.cpp: Block::setUpConstraintHeap */
  private setupHeap(useIn: boolean): Constraint[] {
    const h: Constraint[] = [];
    for (const v of this.vars) {
      const cs = useIn ? v.in : v.out;
      for (const c of cs) {
        c.timeStamp = this.timeCtr.value;
        const external = useIn
          ? c.left.block !== this
          : c.right.block !== this;
        if (external) h.push(c);
      }
    }
    makeHeap(h);
    return h;
  }

  /**
   * Two-arg merge: pick orientation then call three-arg.
   * @see lib/vpsc/block.cpp: Block::merge(Block* b, Constraint* c)
   */
  mergeTwoArg(b: Block, c: Constraint): void {
    const dist = c.right.offset - c.left.offset - c.gap;
    let l = c.left.block!;
    let r = c.right.block!;
    if (this.vars.length < b.vars.length) {
      r.mergeInto(l, c, dist);
    } else {
      l.mergeInto(r, c, -dist);
    }
  }

  /**
   * Merge block b into this across constraint c by dist.
   * @see lib/vpsc/block.cpp: Block::merge(Block *b, Constraint *c, double dist)
   */
  mergeInto(b: Block, c: Constraint, dist: number): void {
    c.active = true;
    this.wposn += b.wposn - dist * b.weight;
    this.weight += b.weight;
    this.posn = this.wposn / this.weight;
    for (const v of b.vars) {
      v.block = this;
      v.offset += dist;
      this.vars.push(v);
    }
    b.deleted = true;
  }

  /** @see lib/vpsc/block.cpp: Block::mergeIn */
  mergeIn(b: Block): void {
    this.findMinInConstraint();
    b.findMinInConstraint();
    mergeHeaps(this.in, b.in);
  }

  /** @see lib/vpsc/block.cpp: Block::mergeOut */
  mergeOut(b: Block): void {
    this.findMinOutConstraint();
    b.findMinOutConstraint();
    mergeHeaps(this.out, b.out);
  }

  /** @see lib/vpsc/block.cpp: Block::findMinInConstraint */
  findMinInConstraint(): Constraint | null {
    const outOfDate: Constraint[] = [];
    while (this.in.length > 0) {
      const v = heapFindMin(this.in);
      const lb = v.left.block!;
      const rb = v.right.block!;
      if (lb === rb) {
        heapDeleteMin(this.in);
      } else if (v.timeStamp < lb.timeStamp) {
        heapDeleteMin(this.in);
        outOfDate.push(v);
      } else {
        break;
      }
    }
    for (const c of outOfDate) {
      c.timeStamp = this.timeCtr.value;
      heapInsert(this.in, c);
    }
    return this.in.length === 0 ? null : heapFindMin(this.in);
  }

  /** @see lib/vpsc/block.cpp: Block::findMinOutConstraint */
  findMinOutConstraint(): Constraint | null {
    if (this.out.length === 0) return null;
    let v = heapFindMin(this.out);
    while (v.left.block === v.right.block) {
      heapDeleteMin(this.out);
      if (this.out.length === 0) return null;
      v = heapFindMin(this.out);
    }
    return v;
  }

  /** @see lib/vpsc/block.cpp: Block::deleteMinInConstraint */
  deleteMinInConstraint(): void { heapDeleteMin(this.in); }

  /** @see lib/vpsc/block.cpp: Block::deleteMinOutConstraint */
  deleteMinOutConstraint(): void { heapDeleteMin(this.out); }

  private canFollowLeft(c: Constraint, last: Variable | null): boolean {
    return c.left.block === this && c.active && last !== c.left;
  }

  private canFollowRight(c: Constraint, last: Variable | null): boolean {
    return c.right.block === this && c.active && last !== c.right;
  }

  /**
   * Resets LMs for all active constraints to 0 starting from v.
   * @see lib/vpsc/block.cpp: Block::reset_active_lm
   */
  private resetActiveLm(v: Variable, u: Variable | null): void {
    for (const c of v.out) {
      if (this.canFollowRight(c, u)) { c.lm = 0; this.resetActiveLm(c.right, v); }
    }
    for (const c of v.in) {
      if (this.canFollowLeft(c, u)) { c.lm = 0; this.resetActiveLm(c.left, v); }
    }
  }

  /**
   * Computes dfdv and Lagrange multipliers; records min-LM constraint.
   * @see lib/vpsc/block.cpp: Block::compute_dfdv
   */
  private computeDfdv(
    v: Variable,
    u: Variable | null,
    minLm: { c: Constraint | null }
  ): number {
    let dfdv = v.weight * (v.position() - v.desiredPosition);
    for (const c of v.out) {
      if (this.canFollowRight(c, u)) {
        c.lm = this.computeDfdv(c.right, v, minLm);
        dfdv += c.lm;
        if (minLm.c === null || c.lm < minLm.c.lm) minLm.c = c;
      }
    }
    for (const c of v.in) {
      if (this.canFollowLeft(c, u)) {
        c.lm = -this.computeDfdv(c.left, v, minLm);
        dfdv -= c.lm;
        if (minLm.c === null || c.lm < minLm.c.lm) minLm.c = c;
      }
    }
    return dfdv;
  }

  /**
   * Process one in-constraint during computeDfdvBetween.
   * Returns [dfdv contribution, updated r, updated m].
   */
  private processBetweenIn(
    c: Constraint,
    r: Variable | null,
    v: Variable,
    changedDir: boolean
  ): [number, Variable | null, Constraint | null] {
    let rr = r;
    let m: Constraint | null = null;
    if (c.left === rr) { rr = null; m = c; }
    const [pd, pm] = this.computeDfdvBetween(rr, c.left, v, Direction.LEFT, changedDir);
    c.lm = -pd;
    if (rr !== null && pm !== null) m = pm;
    return [-c.lm, rr, m];
  }

  /**
   * Process one out-constraint during computeDfdvBetween.
   * Returns [dfdv contribution, updated r, updated m].
   */
  private processBetweenOut(
    c: Constraint,
    r: Variable | null,
    v: Variable,
    changedDir: boolean
  ): [number, Variable | null, Constraint | null] {
    let rr = r;
    let m: Constraint | null = null;
    if (c.right === rr) { rr = null; m = c; }
    const [pd, pm] = this.computeDfdvBetween(rr, c.right, v, Direction.RIGHT, changedDir);
    c.lm = pd;
    if (rr !== null && pm !== null) {
      m = changedDir && c.lm < pm.lm ? c : pm;
    }
    return [c.lm, rr, m];
  }

  /**
   * Computes dfdv between two variables and finds the min-LM constraint.
   * @see lib/vpsc/block.cpp: Block::compute_dfdv_between
   */
  private computeDfdvBetween(
    r: Variable | null,
    v: Variable,
    u: Variable | null,
    dir: Direction = Direction.NONE,
    changedDir: boolean = false
  ): [number, Constraint | null] {
    let dfdv = v.weight * (v.position() - v.desiredPosition);
    let m: Constraint | null = null;
    for (const c of v.in) {
      if (!this.canFollowLeft(c, u)) continue;
      const cd = dir === Direction.RIGHT ? true : changedDir;
      const [contrib, rr, cm] = this.processBetweenIn(c, r, v, cd);
      dfdv += contrib;
      r = rr;
      if (cm !== null) m = cm;
    }
    for (const c of v.out) {
      if (!this.canFollowRight(c, u)) continue;
      const cd = dir === Direction.LEFT ? true : changedDir;
      const [contrib, rr, cm] = this.processBetweenOut(c, r, v, cd);
      dfdv += contrib;
      r = rr;
      if (cm !== null) m = cm;
    }
    return [dfdv, m];
  }

  /**
   * Finds the constraint with the minimum Lagrange multiplier.
   * @see lib/vpsc/block.cpp: Block::findMinLM
   */
  findMinLM(): Constraint | null {
    const minLm: { c: Constraint | null } = { c: null };
    this.resetActiveLm(this.vars[0]!, null);
    this.computeDfdv(this.vars[0]!, null, minLm);
    return minLm.c;
  }

  /** @see lib/vpsc/block.cpp: Block::findMinLMBetween */
  findMinLMBetween(lv: Variable, rv: Variable): Constraint | null {
    this.resetActiveLm(this.vars[0]!, null);
    const [, minLm] = this.computeDfdvBetween(rv, lv, null);
    return minLm;
  }

  /**
   * Populates block b by traversing the active constraint tree from v.
   * @see lib/vpsc/block.cpp: Block::populateSplitBlock
   */
  private populateSplit(b: Block, v: Variable, u: Variable | null): void {
    b.addVariable(v);
    for (const c of v.in) {
      if (this.canFollowLeft(c, u)) this.populateSplit(b, c.left, v);
    }
    for (const c of v.out) {
      if (this.canFollowRight(c, u)) this.populateSplit(b, c.right, v);
    }
  }

  /**
   * Creates two new blocks l and r, splitting this block across constraint c.
   * @see lib/vpsc/block.cpp: Block::split(Block* &l, Block* &r, Constraint* c)
   */
  splitInto(c: Constraint): [Block, Block] {
    c.active = false;
    const l = new Block(this.timeCtr);
    this.populateSplit(l, c.left, c.right);
    const r = new Block(this.timeCtr);
    this.populateSplit(r, c.right, c.left);
    return [l, r];
  }

  /**
   * Finds the split constraint between vl and vr and splits.
   * @see lib/vpsc/block.cpp: Block::splitBetween
   */
  splitBetween(vl: Variable, vr: Variable): [Constraint, Block, Block] {
    const c = this.findMinLMBetween(vl, vr)!;
    const [lb, rb] = this.splitInto(c);
    this.deleted = true;
    return [c, lb, rb];
  }

  /**
   * Squared euclidean distance of variables from their desired positions.
   * @see lib/vpsc/block.cpp: Block::cost
   */
  cost(): number {
    let c = 0;
    for (const v of this.vars) {
      const diff = v.position() - v.desiredPosition;
      c += v.weight * diff * diff;
    }
    return c;
  }
}
