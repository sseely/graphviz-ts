// SPDX-License-Identifier: EPL-2.0

/**
 * R-tree quadratic node splitter.
 * @see label/split.q.h
 * @see label/split.q.c
 */

import { type Rect, combineRect, rectArea, nullRect } from './rectangle.js';
import {
  NODECARD,
  type Branch,
  type Node,
  type PartitionVars,
  type RTreeBase,
  addBranch,
  initNode,
  rTreeNewNode,
  registerSplitNode,
} from './node.js';

// ---------------------------------------------------------------------------
// Unsigned 64-bit arithmetic helpers
//
// C split.q.c declares waste/growth/diff/area as uint64_t.  Subtraction wraps
// mod 2^64.  JavaScript uses IEEE-754 doubles, so we use BigInt for these
// comparisons to faithfully reproduce the C unsigned-overflow behaviour.
// ---------------------------------------------------------------------------

const UINT64_MOD = 2n ** 64n;

/** Simulate C uint64_t subtraction: wraps mod 2^64. */
function u64sub(a: number, b: number): bigint {
  const r = BigInt(a) - BigInt(b);
  return r < 0n ? r + UINT64_MOD : r;
}

// ---------------------------------------------------------------------------
// Internal helpers — mirror static functions in split.q.c
// ---------------------------------------------------------------------------

/** @see label/split.q.c:InitPVars */
function initPVars(rtp: RTreeBase): void {
  const p = rtp.split.partitions[0];
  p.count[0] = p.count[1] = 0;
  p.cover[0] = nullRect();
  p.cover[1] = nullRect();
  p.area[0] = p.area[1] = 0;
  for (let i = 0; i < NODECARD + 1; i++) {
    p.taken[i] = false;
    p.partition[i] = -1;
  }
}

/** @see label/split.q.c:Classify */
function classify(rtp: RTreeBase, i: number, group: number): void {
  const p: PartitionVars = rtp.split.partitions[0];
  p.partition[i] = group;
  p.taken[i] = true;
  if (p.count[group] === 0) {
    p.cover[group] = rtp.split.branchBuf[i].rect;
  } else {
    p.cover[group] = combineRect(rtp.split.branchBuf[i].rect, p.cover[group]);
  }
  p.area[group] = rectArea(p.cover[group]);
  p.count[group]++;
}

/** @see label/split.q.c:PickSeeds */
function pickSeeds(rtp: RTreeBase): void {
  const area: number[] = new Array<number>(NODECARD + 1);
  for (let i = 0; i < NODECARD + 1; i++) {
    area[i] = rectArea(rtp.split.branchBuf[i].rect);
  }
  let worst = 0n;
  let seed0 = 0;
  let seed1 = 0;
  for (let i = 0; i < NODECARD; i++) {
    for (let j = i + 1; j < NODECARD + 1; j++) {
      const rect: Rect = combineRect(
        rtp.split.branchBuf[i].rect,
        rtp.split.branchBuf[j].rect,
      );
      // C: uint64_t waste = RectArea(rect) - area[i] - area[j]  (wraps on underflow)
      const combArea = rectArea(rect);
      const waste = u64sub(combArea, area[i] + area[j]);
      if (waste > worst) {
        worst = waste;
        seed0 = i;
        seed1 = j;
      }
    }
  }
  classify(rtp, seed0, 0);
  classify(rtp, seed1, 1);
}

/** Deep-copy a Rect boundary so the copy is independent of the source. */
function copyRect(r: Rect): Rect {
  return { boundary: [r.boundary[0], r.boundary[1], r.boundary[2], r.boundary[3]] };
}

/** @see label/split.q.c:GetBranches */
function getBranches(rtp: RTreeBase, n: Node, b: Branch): void {
  for (let i = 0; i < NODECARD; i++) {
    rtp.split.branchBuf[i] = { rect: copyRect(n.branch[i].rect), child: n.branch[i].child };
  }
  rtp.split.branchBuf[NODECARD] = { rect: copyRect(b.rect), child: b.child };
  rtp.split.coverSplit = rtp.split.branchBuf[0].rect;
  for (let i = 1; i < NODECARD + 1; i++) {
    rtp.split.coverSplit = combineRect(
      rtp.split.coverSplit,
      rtp.split.branchBuf[i].rect,
    );
  }
  rtp.split.coverSplitArea = rectArea(rtp.split.coverSplit);
  initNode(n);
}

/** @see label/split.q.c:LoadNodes */
function loadNodes(rtp: RTreeBase, n: Node, q: Node): void {
  for (let i = 0; i < NODECARD + 1; i++) {
    const part = rtp.split.partitions[0].partition[i];
    if (part === 0) {
      addBranch(rtp, rtp.split.branchBuf[i], n, { value: null });
    } else if (part === 1) {
      addBranch(rtp, rtp.split.branchBuf[i], q, { value: null });
    }
  }
}

/** @see label/split.q.c:MethodZero */
function methodZero(rtp: RTreeBase): void {
  initPVars(rtp);
  pickSeeds(rtp);
  const p = rtp.split.partitions[0];
  while (
    p.count[0] + p.count[1] < NODECARD + 1 &&
    p.count[0] < NODECARD + 1 &&
    p.count[1] < NODECARD + 1
  ) {
    pickAndClassifyBest(rtp);
  }
  flushRemaining(rtp);
}

/** Running best state for pickAndClassifyBest. */
interface DiffBest { set: boolean; diff: bigint; chosen: number; group: number; }

/** Compute preferred group and diff for one untaken branch (uint64 semantics). */
function branchDiff(
  growth0: bigint, growth1: bigint,
): { diff: bigint; group: number } {
  if (growth1 >= growth0) return { diff: growth1 - growth0, group: 0 };
  return { diff: growth0 - growth1, group: 1 };
}

/** Update DiffBest with candidate i if it is a new best. */
function updateDiffBest(
  best: DiffBest, i: number, diff: bigint, group: number,
  p: PartitionVars,
): void {
  if (!best.set || diff > best.diff) {
    best.diff = diff; best.set = true; best.chosen = i; best.group = group;
  } else if (diff === best.diff && p.count[group] < p.count[best.group]) {
    best.chosen = i; best.group = group;
  }
}

/**
 * One iteration of MethodZero's inner loop: pick the unassigned branch
 * with the greatest inter-group difference and classify it.
 */
function pickAndClassifyBest(rtp: RTreeBase): void {
  const p = rtp.split.partitions[0];
  const best: DiffBest = { set: false, diff: 0n, chosen: 0, group: 0 };
  for (let i = 0; i < NODECARD + 1; i++) {
    if (!p.taken[i]) {
      const r: Rect = rtp.split.branchBuf[i].rect;
      // C: uint64_t growth0 = RectArea(combine) - area[0]  (uint64 subtraction)
      const growth0 = u64sub(rectArea(combineRect(r, p.cover[0])), p.area[0]);
      const growth1 = u64sub(rectArea(combineRect(r, p.cover[1])), p.area[1]);
      const { diff, group } = branchDiff(growth0, growth1);
      updateDiffBest(best, i, diff, group, p);
    }
  }
  classify(rtp, best.chosen, best.group);
}

/**
 * After MethodZero's main loop, assign any remaining unclassified branches
 * to the group that still has room.
 */
function flushRemaining(rtp: RTreeBase): void {
  const p = rtp.split.partitions[0];
  if (p.count[0] + p.count[1] >= NODECARD + 1) return;
  let group = 0;
  if (p.count[0] >= NODECARD + 1) group = 1;
  for (let i = 0; i < NODECARD + 1; i++) {
    if (!p.taken[i]) classify(rtp, i, group);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Split a node. Divides the node's branches and the extra one between two
 * nodes. Old node is one of the two; a new node is created and returned via
 * nn.value.
 * @see label/split.q.c:SplitNode
 */
export function splitNode(
  rtp: RTreeBase,
  n: Node,
  b: Branch,
  nn: { value: Node | null },
): void {
  const level = n.level;
  getBranches(rtp, n, b);
  methodZero(rtp);
  nn.value = rTreeNewNode();
  (nn.value as Node).level = n.level = level;
  loadNodes(rtp, n, nn.value as Node);
}

// Register with node.ts so addBranch can call splitNode without a
// module-evaluation-time circular import.
registerSplitNode(splitNode);

// METHODS constant — number of partition methods (only 0 is used).
// @see label/split.q.h:METHODS
const METHODS = 1;

// Re-export METHODS count for consumers that need it (mirrors index.h exposure).
export { METHODS };
