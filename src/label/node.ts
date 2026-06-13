// SPDX-License-Identifier: EPL-2.0

/**
 * R-tree node types and node-level operations.
 * @see label/node.h
 * @see label/node.c
 * @see label/index.h
 */

import { type Rect, initRect, combineRect, rectArea, nullRect } from './rectangle.js';

// C node.c uses uint64_t for bestIncr, bestArea, increase — subtraction wraps.
const _U64_MOD = 2n ** 64n;
/** Simulate C uint64_t subtraction (wraps mod 2^64). */
function u64sub(a: number, b: number): bigint {
  const r = BigInt(a) - BigInt(b);
  return r < 0n ? r + _U64_MOD : r;
}

/** @see label/index.h:NODECARD */
export const NODECARD = 64;

/**
 * METHODS constant — number of partition methods.
 * Only method 0 (quadratic) is used.
 * @see label/split.q.h:METHODS
 */
const METHODS = 1;

/**
 * A single branch in an R-tree node: a bounding rectangle and a child pointer.
 * @see label/node.h:Branch_t
 */
export interface Branch {
  rect: Rect;
  /** null means this slot is empty; pointer to child Node otherwise */
  child: Node | null;
}

/**
 * An R-tree node: up to NODECARD branches.
 * level 0 = leaf, positive = internal.
 * @see label/node.h:Node_t
 */
export interface Node {
  count: number;
  /** 0 is leaf, others positive */
  level: number;
  branch: Branch[];   // length == NODECARD
}

/**
 * Per-split partition bookkeeping.
 * @see label/split.q.h:PartitionVars
 */
export interface PartitionVars {
  partition: number[];   // length NODECARD+1
  taken: boolean[];      // length NODECARD+1
  count: [number, number];
  cover: [Rect, Rect];
  area: [number, number];
}

/**
 * Quadratic-split scratchpad stored in the RTree.
 * @see label/split.q.h:SplitQ_t / split_q_s
 */
export interface SplitQ {
  branchBuf: Branch[];         // length NODECARD+1
  coverSplit: Rect;
  coverSplitArea: number;
  partitions: PartitionVars[]; // length METHODS
}

/**
 * Minimal RTree fields touched by node.c and split.q.c.
 * T3 (index.c) will flesh out the full RTree type; this structural
 * base keeps T2 self-contained.
 * @see label/index.h:struct RTree
 */
export interface RTreeBase {
  root: Node | null;
  split: SplitQ;
}

// ---------------------------------------------------------------------------
// Helpers to build fresh structs
// ---------------------------------------------------------------------------

/** Build an empty PartitionVars. */
function makePartitionVars(): PartitionVars {
  return {
    partition: new Array<number>(NODECARD + 1).fill(-1),
    taken:     new Array<boolean>(NODECARD + 1).fill(false),
    count:     [0, 0],
    cover:     [nullRect(), nullRect()],
    area:      [0, 0],
  };
}

/** Build an empty branch. */
function makeBranch(): Branch {
  return { rect: { boundary: [0, 0, 0, 0] }, child: null };
}

/** Build an empty SplitQ. */
export function makeSplitQ(): SplitQ {
  return {
    branchBuf: Array.from({ length: NODECARD + 1 }, makeBranch),
    coverSplit: { boundary: [0, 0, 0, 0] },
    coverSplitArea: 0,
    partitions: Array.from({ length: METHODS }, makePartitionVars),
  };
}

// ---------------------------------------------------------------------------
// node.c functions
// ---------------------------------------------------------------------------

/**
 * Initialize one branch cell: zeroed rect, null child.
 * @see label/node.c:InitBranch
 */
export function initBranch(b: Branch): void {
  initRect(b.rect);
  b.child = null;
}

/**
 * Initialize a Node structure: count=0, level=-1, all branches empty.
 * @see label/node.c:InitNode
 */
export function initNode(n: Node): void {
  n.count = 0;
  n.level = -1;
  for (let i = 0; i < NODECARD; i++) {
    initBranch(n.branch[i]);
  }
}

/**
 * Allocate and initialize a new Node.
 * @see label/node.c:RTreeNewNode
 */
export function rTreeNewNode(): Node {
  const branches: Branch[] = Array.from({ length: NODECARD }, makeBranch);
  const n: Node = { count: 0, level: -1, branch: branches };
  initNode(n);
  return n;
}

// ---------------------------------------------------------------------------
// pickBranch helpers — placed before nodeCover so lizard measures nodeCover
// length correctly (it uses the next function start as the end marker).
// ---------------------------------------------------------------------------

/** State carrier for pickBranch's running best. */
interface PickBest {
  idx: number;
  area: number;
  incr: bigint;  // uint64_t in C — uses wrapping subtraction
  set: boolean;
}

/**
 * Update running-best for one candidate branch.
 * Extracted to keep pickBranch CCN within limit.
 * incr uses uint64 semantics (C: uint64_t increase = RectArea(combined) - area).
 */
function updatePickBest(best: PickBest, i: number, area: number, increase: bigint): void {
  if (!best.set || increase < best.incr) {
    best.idx = i; best.area = area; best.incr = increase; best.set = true;
  } else if (increase === best.incr && area < best.area) {
    best.idx = i; best.area = area; best.incr = increase;
  }
}

/** Smallest rect enclosing all occupied branch rects. @see label/node.c:NodeCover */
export function nodeCover(n: Node): Rect {
  let r: Rect = { boundary: [0, 0, 0, 0] };
  initRect(r);
  let flag = true;
  for (let i = 0; i < NODECARD; i++) {
    if (n.branch[i].child !== null) {
      if (flag) { r = n.branch[i].rect; flag = false; }
      else { r = combineRect(r, n.branch[i].rect); }
    }
  }
  return r;
}

/**
 * Pick the branch that will need the smallest area increase to
 * accommodate rect r. Ties broken by smaller current area.
 * @see label/node.c:PickBranch
 */
export function pickBranch(r: Rect, n: Node): number {
  const best: PickBest = { idx: 0, area: 0, incr: 0n, set: false };
  for (let i = 0; i < NODECARD; i++) {
    if (n.branch[i].child !== null) {
      const rr = n.branch[i].rect;
      const area = rectArea(rr);
      updatePickBest(best, i, area, u64sub(rectArea(combineRect(r, rr)), area));
    }
  }
  return best.idx;
}

/**
 * Add a branch to a node. Splits the node if necessary.
 * Returns 0 if no split; old node updated.
 * Returns 1 if split; newNodeOut.value set to the new node.
 *
 * Cycle note: addBranch → splitNode (split-q.ts) → loadNodes → addBranch.
 * Resolved via late-binding shim below; both modules fully initialised
 * before any function executes at runtime.
 * @see label/node.c:AddBranch
 */
export function addBranch(
  rtp: RTreeBase,
  b: Branch,
  n: Node,
  newNodeOut: { value: Node | null },
): number {
  if (n.count < NODECARD) {
    for (let i = 0; i < NODECARD; i++) {
      if (n.branch[i].child === null) {
        n.branch[i] = {
          rect: { boundary: [b.rect.boundary[0], b.rect.boundary[1], b.rect.boundary[2], b.rect.boundary[3]] },
          child: b.child,
        };
        n.count++;
        break;
      }
    }
    return 0;
  } else {
    splitNode(rtp, n, b, newNodeOut);
    return 1;
  }
}

/**
 * Disconnect a dependent node (clears branch slot, decrements count).
 * @see label/node.c:DisconBranch
 */
export function disconnectBranch(n: Node, i: number): void {
  initBranch(n.branch[i]);
  n.count--;
}

// ---------------------------------------------------------------------------
// Late-binding shim for splitNode — breaks the ESM circular-import at module
// evaluation time while preserving C call semantics at runtime.
// split-q.ts calls registerSplitNode() at module load time.
// ---------------------------------------------------------------------------

let _splitNodeImpl: (
  rtp: RTreeBase,
  n: Node,
  b: Branch,
  newNodeOut: { value: Node | null },
) => void = () => {
  throw new Error('splitNode not yet registered — import split-q.ts first');
};

/** Register the splitNode implementation. Called by split-q.ts at load time. */
export function registerSplitNode(
  impl: (rtp: RTreeBase, n: Node, b: Branch, newNodeOut: { value: Node | null }) => void,
): void {
  _splitNodeImpl = impl;
}

function splitNode(
  rtp: RTreeBase, n: Node, b: Branch, newNodeOut: { value: Node | null },
): void {
  _splitNodeImpl(rtp, n, b, newNodeOut);
}
