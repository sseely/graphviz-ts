// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for node.ts and split-q.ts — R-tree node operations and quadratic
 * splitter. split-q.ts must be imported first so registerSplitNode fires.
 */

import { describe, it, expect } from 'vitest';
// Import split-q.ts first: its module-load side-effect calls registerSplitNode.
import { splitNode } from './split-q.js';
import {
  NODECARD,
  type Branch,
  type Node,
  type RTreeBase,
  initNode,
  initBranch,
  rTreeNewNode,
  nodeCover,
  pickBranch,
  addBranch,
  disconnectBranch,
  makeSplitQ,
} from './node.js';
import { type Rect } from './rectangle.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { boundary: [x0, y0, x1, y1] };
}

function makeRtp(): RTreeBase {
  return { root: null, split: makeSplitQ() };
}

function makeBranchWith(rect: Rect): Branch {
  return { rect, child: rTreeNewNode() };
}

/**
 * Fill a node with NODECARD distinct rects and return the shared rtp.
 * Rects are [i, i, i+2, i+2] for i=0..63, giving varied areas and positions.
 */
function makeFullNode(): { rtp: RTreeBase; n: Node } {
  const rtp = makeRtp();
  const n = rTreeNewNode();
  n.level = 0;
  for (let i = 0; i < NODECARD; i++) {
    addBranch(rtp, makeBranchWith(makeRect(i, i, i + 2, i + 2)), n, { value: null });
  }
  return { rtp, n };
}

/** Run the overflow split and return { n, nn }. */
function doSplit(overflowRect: Rect): { n: Node; nn: Node } {
  const { rtp, n } = makeFullNode();
  const out = { value: null as Node | null };
  addBranch(rtp, makeBranchWith(overflowRect), n, out);
  return { n, nn: out.value! };
}

// ---------------------------------------------------------------------------
// initBranch
// ---------------------------------------------------------------------------

describe('initBranch', () => {
  it('zeroes the rect and sets child to null', () => {
    const b: Branch = makeBranchWith(makeRect(1, 2, 3, 4));
    initBranch(b);
    expect(b.child).toBeNull();
    expect(b.rect.boundary).toEqual([0, 0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// initNode
// ---------------------------------------------------------------------------

describe('initNode', () => {
  it('sets count=0, level=-1, all branches empty', () => {
    const n = rTreeNewNode();
    n.count = 5; n.level = 3; n.branch[0].child = rTreeNewNode();
    initNode(n);
    expect(n.count).toBe(0);
    expect(n.level).toBe(-1);
    for (let i = 0; i < NODECARD; i++) {
      expect(n.branch[i].child).toBeNull();
      expect(n.branch[i].rect.boundary).toEqual([0, 0, 0, 0]);
    }
  });
});

// ---------------------------------------------------------------------------
// rTreeNewNode
// ---------------------------------------------------------------------------

describe('rTreeNewNode', () => {
  it('returns a node with NODECARD branch slots', () => {
    expect(rTreeNewNode().branch).toHaveLength(NODECARD);
  });
  it('initialises count=0 and level=-1', () => {
    const n = rTreeNewNode();
    expect(n.count).toBe(0);
    expect(n.level).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// nodeCover
// ---------------------------------------------------------------------------

function testNodeCoverEmpty(): void {
  const n = rTreeNewNode();
  // flag stays true → returns initRect-zeroed value
  expect(nodeCover(n).boundary).toEqual([0, 0, 0, 0]);
}

function testNodeCoverSingle(): void {
  const n = rTreeNewNode();
  n.branch[0] = makeBranchWith(makeRect(1, 2, 5, 6));
  n.count = 1;
  expect(nodeCover(n).boundary).toEqual([1, 2, 5, 6]);
}

function testNodeCoverMulti(): void {
  // combineRect uses fmin for BOTH low and high sides (C verbatim quirk):
  //   combine([0,0,3,3],[1,1,5,5]) = [min(0,1),min(0,1),min(3,5),min(3,5)] = [0,0,3,3]
  //   combine([0,0,3,3],[2,2,4,6]) = [min(0,2),min(0,2),min(3,4),min(3,6)] = [0,0,3,3]
  const n = rTreeNewNode();
  n.branch[0] = makeBranchWith(makeRect(0, 0, 3, 3));
  n.branch[1] = makeBranchWith(makeRect(1, 1, 5, 5));
  n.branch[2] = makeBranchWith(makeRect(2, 2, 4, 6));
  n.count = 3;
  expect(nodeCover(n).boundary).toEqual([0, 0, 3, 3]);
}

describe('nodeCover', () => {
  it('returns zeroed rect when no branches occupied', testNodeCoverEmpty);
  it('returns single branch rect when count=1', testNodeCoverSingle);
  it('covers all occupied branches (fmin quirk)', testNodeCoverMulti);
});

// ---------------------------------------------------------------------------
// pickBranch
// ---------------------------------------------------------------------------

// branch0:[0,0,10,10] area=100; branch1:[0,0,2,2] area=4; candidate:[1,1,3,3]
// combine(cand,[0,0,10,10]) = [min(1,0),min(1,0),min(3,10),min(3,10)] = [0,0,3,3] area=9
// increase0 = 9-100 = -91 (uint64: huge)
// combine(cand,[0,0,2,2]) = [min(1,0),min(1,0),min(3,2),min(3,2)] = [0,0,2,2] area=4
// increase1 = 4-4 = 0
// increase1(0) < increase0(huge uint64) → growth1 >= growth0 is false
// → group=1, branch1 chosen
function testPickLeastIncrease(): void {
  const n = rTreeNewNode();
  n.branch[0] = makeBranchWith(makeRect(0, 0, 10, 10));
  n.branch[1] = makeBranchWith(makeRect(0, 0, 2, 2));
  n.count = 2;
  // candidate [1,1,3,3] is inside branch1 [0,0,2,2]? No, 3>2, so it extends branch1.
  // increase1=0 (branch1 already contains cand under fmin: combine=[0,0,2,2])
  // branch1 wins (increase=0 in math, branch0 has huge uint64 increase)
  expect(pickBranch(makeRect(1, 1, 3, 3), n)).toBe(1);
}

// Tie-break: both increases equal under fmin semantics.
// candidate [5,5,6,6] is to the right/above both branch rects.
// branch0:[0,0,3,3] area=9; branch1:[0,0,2,2] area=4
// combine([5,5,6,6],[0,0,3,3]) = [0,0,3,3] area=9. increase=9-9=0
// combine([5,5,6,6],[0,0,2,2]) = [0,0,2,2] area=4. increase=4-4=0
// equal increases → tie broken by smaller current area → branch1 (area=4 < 9)
function testPickTieBroken(): void {
  const n = rTreeNewNode();
  n.branch[0] = makeBranchWith(makeRect(0, 0, 3, 3));
  n.branch[1] = makeBranchWith(makeRect(0, 0, 2, 2));
  n.count = 2;
  expect(pickBranch(makeRect(5, 5, 6, 6), n)).toBe(1);
}

function testPickSingleOccupied(): void {
  const n = rTreeNewNode();
  n.branch[0] = makeBranchWith(makeRect(0, 0, 1, 1));
  n.count = 1;
  expect(pickBranch(makeRect(5, 5, 6, 6), n)).toBe(0);
}

describe('pickBranch', () => {
  it('picks branch needing least area increase', testPickLeastIncrease);
  it('breaks ties by smaller current area', testPickTieBroken);
  it('returns index 0 when only branch 0 occupied', testPickSingleOccupied);
});

// ---------------------------------------------------------------------------
// disconnectBranch
// ---------------------------------------------------------------------------

describe('disconnectBranch', () => {
  it('clears the slot and decrements count', () => {
    const n = rTreeNewNode();
    n.branch[2] = makeBranchWith(makeRect(1, 1, 2, 2));
    n.count = 3;
    disconnectBranch(n, 2);
    expect(n.branch[2].child).toBeNull();
    expect(n.branch[2].rect.boundary).toEqual([0, 0, 0, 0]);
    expect(n.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// addBranch — no split path
// ---------------------------------------------------------------------------

describe('addBranch (no split)', () => {
  it('returns 0 and inserts into first empty slot', () => {
    const rtp = makeRtp();
    const n = rTreeNewNode();
    const out = { value: null as Node | null };
    const result = addBranch(rtp, makeBranchWith(makeRect(1, 2, 3, 4)), n, out);
    expect(result).toBe(0);
    expect(out.value).toBeNull();
    expect(n.count).toBe(1);
    expect(n.branch[0].rect.boundary).toEqual([1, 2, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// addBranch + splitNode — NODECARD+1 trigger (invariant-only tests)
//
// Fixture: node with NODECARD distinct rects [i,i,i+2,i+2] i=0..63.
// Overflow rect: [0,0,2,2].
//
// We test structural invariants only — exact partition membership depends on
// unsigned-arithmetic seed selection (C uint64_t wrapping) which is complex
// to hand-trace but must satisfy these invariants for any valid input.
// ---------------------------------------------------------------------------

function testSplitFixtureNodeFull(): void {
  expect(makeFullNode().n.count).toBe(64);
}

function testSplitReturnsOne(): void {
  const { rtp, n } = makeFullNode();
  const out = { value: null as Node | null };
  expect(addBranch(rtp, makeBranchWith(makeRect(0, 0, 2, 2)), n, out)).toBe(1);
  expect(out.value).not.toBeNull();
}

function testSplitTotalCount(): void {
  const { n, nn } = doSplit(makeRect(0, 0, 2, 2));
  expect(n.count + nn.count).toBe(NODECARD + 1);
}

function testSplitBothNonEmpty(): void {
  const { n, nn } = doSplit(makeRect(0, 0, 2, 2));
  expect(n.count).toBeGreaterThan(0);
  expect(nn.count).toBeGreaterThan(0);
}

function testSplitAllChildrenNonNull(): void {
  // Every occupied slot in both result nodes must have a non-null child.
  const { n, nn } = doSplit(makeRect(0, 0, 2, 2));
  let total = 0;
  for (let i = 0; i < NODECARD; i++) {
    if (n.branch[i].child !== null) total++;
    if (nn.branch[i].child !== null) total++;
  }
  expect(total).toBe(NODECARD + 1);
}

function testSplitLevelPreserved(): void {
  const { n, nn } = doSplit(makeRect(0, 0, 2, 2));
  expect(n.level).toBe(0);
  expect(nn.level).toBe(0);
}

describe('addBranch + splitNode (NODECARD+1 trigger)', () => {
  it('fixture node is full before split', testSplitFixtureNodeFull);
  it('returns 1 when overflow triggers split', testSplitReturnsOne);
  it('total count across both nodes equals NODECARD+1', testSplitTotalCount);
  it('both result nodes are non-empty', testSplitBothNonEmpty);
  it('all occupied slots have non-null child', testSplitAllChildrenNonNull);
  it('node level preserved across split', testSplitLevelPreserved);
});

// ---------------------------------------------------------------------------
// pickBranch exact partition test
//
// Hand-trace under fmin+uint64 semantics:
// Node has 2 branches: [0,0,3,3] and [0,0,2,2].
// Candidate [5,5,6,6] (outside both).
// As traced above → pickBranch returns 1 (smaller area wins tie).
// ---------------------------------------------------------------------------

describe('pickBranch exact partition (hand-traced)', () => {
  it('chooses the branch with smallest area increase, tie by area', () => {
    const n = rTreeNewNode();
    n.branch[0] = makeBranchWith(makeRect(0, 0, 3, 3));  // area=9
    n.branch[1] = makeBranchWith(makeRect(0, 0, 2, 2));  // area=4
    n.count = 2;
    // candidate [5,5,6,6]: combine with both → same area; tie broken by smaller area
    expect(pickBranch(makeRect(5, 5, 6, 6), n)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// splitNode called directly
// ---------------------------------------------------------------------------

function testSplitDirectCallable(): void {
  expect(typeof splitNode).toBe('function');
}

function testSplitDirectCountSum(): void {
  const rtp = makeRtp();
  const n = rTreeNewNode();
  n.level = 1;
  for (let i = 0; i < NODECARD; i++) {
    n.branch[i] = { rect: makeRect(i, i, i + 1, i + 1), child: rTreeNewNode() };
    n.count++;
  }
  const out = { value: null as Node | null };
  splitNode(rtp, n, { rect: makeRect(0, 0, 1, 1), child: rTreeNewNode() }, out);
  expect(out.value).not.toBeNull();
  expect(n.count + (out.value as Node).count).toBe(NODECARD + 1);
}

describe('splitNode (direct call)', () => {
  it('is exported and callable', testSplitDirectCallable);
  it('produces two nodes whose counts sum to NODECARD+1', testSplitDirectCountSum);
});
