// SPDX-License-Identifier: EPL-2.0

/**
 * Blocks: the block structure defined over the set of variables.
 *
 * Each block contains 1 or more variables. All constraints inside a block are
 * satisfied by keeping the variables fixed relative to one another.
 *
 * In C++ Blocks extends std::set<Block*>; here we use a Set<Block>.
 *
 * @see lib/vpsc/blocks.h
 * @see lib/vpsc/blocks.cpp
 */

import { Variable } from "./Variable.js";
import { Constraint } from "./Constraint.js";
import { Block } from "./Block.js";

export class Blocks {
  private _blocks: Set<Block>;
  private _vs: Variable[];

  /**
   * blockTimeCtr: private instance field on Blocks, NOT a module-level global.
   * Exposed as a readonly ref so Block instances can read and increment it.
   * @see lib/vpsc/blocks.cpp: long blockTimeCtr;  (was global; moved here per AD-4)
   */
  readonly timeCtr: { value: number };

  /** @see lib/vpsc/blocks.cpp: Blocks::Blocks(const int n, Variable *vs_[]) */
  constructor(vs: Variable[]) {
    this.timeCtr = { value: 0 };
    this._vs = vs;
    this._blocks = new Set<Block>();
    for (const v of vs) {
      this._blocks.add(new Block(this.timeCtr, v));
    }
  }

  /** Iterate over all blocks (including deleted ones not yet cleaned up). */
  [Symbol.iterator](): IterableIterator<Block> {
    return this._blocks[Symbol.iterator]();
  }

  /** Add a block to the set. */
  insert(b: Block): void {
    this._blocks.add(b);
  }

  /**
   * Returns a topologically sorted list of variables determined by the
   * constraint DAG.
   * @see lib/vpsc/blocks.cpp: Blocks::totalOrder
   */
  totalOrder(): Variable[] {
    const order: Variable[] = [];
    for (const v of this._vs) v.visited = false;
    for (const v of this._vs) {
      if (v.in.length === 0) this.dfsVisit(v, order);
    }
    return order;
  }

  /** @see lib/vpsc/blocks.cpp: Blocks::dfsVisit */
  private dfsVisit(v: Variable, order: Variable[]): void {
    v.visited = true;
    for (const c of v.out) {
      if (!c.right.visited) this.dfsVisit(c.right, order);
    }
    order.unshift(v);
  }

  /**
   * Processes incoming constraints most-violated first, merging with the left
   * neighbouring block until no more violated constraints exist.
   * @see lib/vpsc/blocks.cpp: Blocks::mergeLeft
   */
  mergeLeft(r: Block): void {
    r.timeStamp = ++this.timeCtr.value;
    r.setUpInConstraints();
    let c = r.findMinInConstraint();
    while (c !== null && c.slack() < 0) {
      r.deleteMinInConstraint();
      let l = c.left.block!;
      if (l.in.length === 0) l.setUpInConstraints();
      let dist = c.right.offset - c.left.offset - c.gap;
      if (r.vars.length < l.vars.length) {
        dist = -dist;
        [l, r] = [r, l];
      }
      this.timeCtr.value++;
      r.mergeInto(l, c, dist);
      r.mergeIn(l);
      r.timeStamp = this.timeCtr.value;
      this.removeBlock(l);
      c = r.findMinInConstraint();
    }
  }

  /**
   * Symmetrical to mergeLeft.
   * @see lib/vpsc/blocks.cpp: Blocks::mergeRight
   */
  mergeRight(l: Block): void {
    l.setUpOutConstraints();
    let c = l.findMinOutConstraint();
    while (c !== null && c.slack() < 0) {
      l.deleteMinOutConstraint();
      let r = c.right.block!;
      r.setUpOutConstraints();
      let dist = c.left.offset + c.gap - c.right.offset;
      if (l.vars.length > r.vars.length) {
        dist = -dist;
        [l, r] = [r, l];
      }
      l.mergeInto(r, c, dist);
      l.mergeOut(r);
      this.removeBlock(r);
      c = l.findMinOutConstraint();
    }
  }

  /** @see lib/vpsc/blocks.cpp: Blocks::removeBlock */
  private removeBlock(doomed: Block): void {
    doomed.deleted = true;
  }

  /** @see lib/vpsc/blocks.cpp: Blocks::cleanup */
  cleanup(): void {
    for (const b of this._blocks) {
      if (b.deleted) this._blocks.delete(b);
    }
  }

  /**
   * Splits block b across constraint c into two new blocks.
   * @see lib/vpsc/blocks.cpp: Blocks::split
   */
  split(b: Block, c: Constraint): [Block, Block] {
    const [l, r] = b.splitInto(c);
    r.posn = b.posn;
    r.wposn = r.posn * r.weight;
    this.mergeLeft(l);
    // r may have been merged into another block during mergeLeft
    const rActual = c.right.block!;
    rActual.wposn = rActual.desiredWeightedPosition();
    rActual.posn = rActual.wposn / rActual.weight;
    this.mergeRight(rActual);
    this.removeBlock(b);
    this._blocks.add(l);
    this._blocks.add(rActual);
    return [l, rActual];
  }

  /**
   * Total squared distance of all variables from their desired positions.
   * @see lib/vpsc/blocks.cpp: Blocks::cost
   */
  cost(): number {
    let c = 0;
    for (const b of this._blocks) c += b.cost();
    return c;
  }
}
