// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for gvPostprocess coordinate transforms.
 *
 * Hand-computed expected values per lib/common/postproc.c:
 *   map_point(p) = ccwrotatepf(p, Rankdir*90) - Offset
 *   translate_bb: LR/BT swap corners; TB/RL map LL/UR directly
 *
 * All coord tests use bb = { ll:{0,0}, ur:{100,50} } so Offsets are
 * predictable, and a single test node at coord {10,20}.
 */

import { describe, it, expect } from 'vitest';
import { gvPostprocess } from './postproc.js';
import { ccwrotatepf } from '../model/geom.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { RANKDIR_TB, RANKDIR_LR, RANKDIR_BT, RANKDIR_RL } from '../layout/dot/init.js';
import {
  addXLabel, edgeTailpoint, edgeHeadpoint, updateBBForLabel,
  type XLabelCtx, type ELike,
} from './xlabels-place.js';
import type { XLabelT, ObjectT } from '../label/xlabels.js';
import { NODE_XLABEL, EDGE_XLABEL, TAIL_LABEL, HEAD_LABEL } from '../layout/dot/rank.js';

// ---------------------------------------------------------------------------
// Test-graph factory helpers
// ---------------------------------------------------------------------------

function makeTestGraph(rankdir: number): Graph {
  const g = new Graph('test', 'directed');
  g.info.rankdir = (rankdir << 2) | rankdir;
  g.info.bb = { ll: { x: 0, y: 0 }, ur: { x: 100, y: 50 } };
  return g;
}

function addNode(g: Graph): Node {
  const n = new Node(g.nodes.size, 'n', g);
  n.info.coord = { x: 10, y: 20 };
  n.info.width = 1;
  n.info.height = 0.5;
  n.info.lw = 36;
  n.info.rw = 36;
  n.info.ht = 36;
  g.nodes.set(n.name, n);
  return n;
}

function runAndGetCoord(rankdir: number): { x: number; y: number } {
  const g = makeTestGraph(rankdir);
  const n = addNode(g);
  gvPostprocess(g);
  return n.info.coord ?? { x: 0, y: 0 };
}

function runAndGetBbLL(rankdir: number): { x: number; y: number } {
  const g = makeTestGraph(rankdir);
  addNode(g);
  gvPostprocess(g);
  return g.info.bb.ll;
}

// ---------------------------------------------------------------------------
// Named assertion bodies (extracted to satisfy complexity checker)
// ---------------------------------------------------------------------------

function assertTbCoordUnchanged(): void {
  // TB: rotation=0, Offset=ll={0,0} → identity
  const c = runAndGetCoord(RANKDIR_TB);
  expect(c.x).toBeCloseTo(10, 6);
  expect(c.y).toBeCloseTo(20, 6);
}

function assertTbBbNormalisedWithOffset(): void {
  // bb=ll:{2,3},ur:{102,53}; Offset=ll={2,3}
  // After shift: new ll={0,0}, new ur={100,50}
  const g = makeTestGraph(RANKDIR_TB);
  g.info.bb = { ll: { x: 2, y: 3 }, ur: { x: 102, y: 53 } };
  addNode(g);
  gvPostprocess(g);
  expect(g.info.bb.ll.x).toBeCloseTo(0, 6);
  expect(g.info.bb.ll.y).toBeCloseTo(0, 6);
  expect(g.info.bb.ur.x).toBeCloseTo(100, 6);
  expect(g.info.bb.ur.y).toBeCloseTo(50, 6);
}

// ---------------------------------------------------------------------------
// ccwrotatepf smoke tests
// @see lib/common/geom.c:ccwrotatepf
// ---------------------------------------------------------------------------

describe('ccwrotatepf', () => {
  it('0°: identity', () => {
    expect(ccwrotatepf({ x: 3, y: 4 }, 0)).toEqual({ x: 3, y: 4 });
  });

  it('90°: {x,y} -> {-y,x}', () => {
    expect(ccwrotatepf({ x: 3, y: 4 }, 90)).toEqual({ x: -4, y: 3 });
  });

  it('180°: {x,y} -> {x,-y}', () => {
    expect(ccwrotatepf({ x: 3, y: 4 }, 180)).toEqual({ x: 3, y: -4 });
  });

  it('270°: {x,y} -> {y,x}', () => {
    expect(ccwrotatepf({ x: 3, y: 4 }, 270)).toEqual({ x: 4, y: 3 });
  });
});

// ---------------------------------------------------------------------------
// map_point (via gvPostprocess) — node coord per rankdir
// BB = ll:{0,0}, ur:{100,50}; node at {10,20}
// ---------------------------------------------------------------------------

describe('gvPostprocess: node coord per rankdir', () => {
  it('TB: coord unchanged (rotation=0, Offset=ll={0,0})', assertTbCoordUnchanged);

  it('LR: ccw90 minus Offset={-50,0} → {30,10}', () => {
    // ccwrotatepf({10,20},90)={-20,10}; Offset={-ur.y,ll.x}={-50,0}
    // result = {-20-(-50), 10-0} = {30,10}
    const c = runAndGetCoord(RANKDIR_LR);
    expect(c.x).toBeCloseTo(30, 6);
    expect(c.y).toBeCloseTo(10, 6);
  });

  it('BT: ccw180 minus Offset={0,-50} → {10,30}', () => {
    // ccwrotatepf({10,20},180)={10,-20}; Offset={ll.x,-ur.y}={0,-50}
    // result = {10-0, -20-(-50)} = {10,30}
    const c = runAndGetCoord(RANKDIR_BT);
    expect(c.x).toBeCloseTo(10, 6);
    expect(c.y).toBeCloseTo(30, 6);
  });

  it('RL: ccw270 minus Offset={0,0} → {20,10}', () => {
    // ccwrotatepf({10,20},270)={20,10}; Offset={ll.y,ll.x}={0,0}
    // result = {20,10}
    const c = runAndGetCoord(RANKDIR_RL);
    expect(c.x).toBeCloseTo(20, 6);
    expect(c.y).toBeCloseTo(10, 6);
  });
});

// ---------------------------------------------------------------------------
// translate_bb — bb.ll normalised to {0,0} after postprocess
// @see lib/common/postproc.c:translate_bb
// ---------------------------------------------------------------------------

describe('gvPostprocess: bb.ll normalised to {0,0} for all rankdirs', () => {
  it('TB: bb.ll = {0,0} after postprocess', () => {
    const ll = runAndGetBbLL(RANKDIR_TB);
    expect(ll.x).toBeCloseTo(0, 6);
    expect(ll.y).toBeCloseTo(0, 6);
  });

  it('LR: bb.ll = {0,0} after postprocess', () => {
    const ll = runAndGetBbLL(RANKDIR_LR);
    expect(ll.x).toBeCloseTo(0, 6);
    expect(ll.y).toBeCloseTo(0, 6);
  });

  it('BT: bb.ll = {0,0} after postprocess', () => {
    const ll = runAndGetBbLL(RANKDIR_BT);
    expect(ll.x).toBeCloseTo(0, 6);
    expect(ll.y).toBeCloseTo(0, 6);
  });

  it('RL: bb.ll = {0,0} after postprocess', () => {
    const ll = runAndGetBbLL(RANKDIR_RL);
    expect(ll.x).toBeCloseTo(0, 6);
    expect(ll.y).toBeCloseTo(0, 6);
  });

  it('TB with non-zero ll: bb normalised after shift', assertTbBbNormalisedWithOffset);
});

// ---------------------------------------------------------------------------
// mapArrowPts winding-order correction
// BT (180° reflection, det=-1) and RL (270° reflection, det=-1) reverse
// polygon winding; LR (90° rotation, det=+1) and TB (identity, det=+1) do not.
//
// Input polygon: [rightBase={1,0}, tip={0,0}, leftBase={-1,0}]
// after a reflection the order should be reversed to match C's render-time
// convention: [leftBase, tip, rightBase].
// ---------------------------------------------------------------------------

/** Minimal bezier segment used as spline stub in arrow-winding tests. */
function makeStubBezier() {
  return {
    list: [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }, { x: 0, y: 30 }],
    sflag: 0,
    eflag: 0,
    sp: { x: 0, y: 0 },
    ep: { x: 0, y: 30 },
  };
}

function makeArrowEdge(
  g: Graph,
  pts: Array<{ x: number; y: number }>,
  key: 'headArrowOps' | 'tailArrowOps',
) {
  const n = addNode(g);
  const ops = [{ kind: 'polygon', points: pts, filled: true }];
  const e = {
    tail: n,
    head: n,
    info: { spl: { list: [makeStubBezier()] }, [key]: ops },
  };
  g.edges = [e as unknown as import('../model/edge.js').Edge];
  return e;
}

// Pre-rotation polygon with distinct base points so we can detect reversal.
// [rightBase={1,0}, tip={0,0}, leftBase={-1,0}]
const ARROW_INPUT_PTS = [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 }];

function cloneArrowPts(): Array<{ x: number; y: number }> {
  return ARROW_INPUT_PTS.map((p) => ({ ...p }));
}

function getArrowPts(e: ReturnType<typeof makeArrowEdge>, key: string) {
  const ops = (e.info as Record<string, unknown>)[key] as Array<{ points: Array<{ x: number; y: number }> }>;
  return ops[0]!.points;
}

// TB: identity transform, no winding change.
function assertArrowTbUnchanged(): void {
  const g = makeTestGraph(RANKDIR_TB);
  const e = makeArrowEdge(g, cloneArrowPts(), 'headArrowOps');
  gvPostprocess(g);
  const pts = getArrowPts(e, 'headArrowOps');
  expect(pts[0]!.x).toBeCloseTo(1, 5);
  expect(pts[2]!.x).toBeCloseTo(-1, 5);
}

// LR: 90° rotation (det=+1), no winding change.
// ccw90({1,0})={0,1}; Offset={-50,0}; mapped=(50,1). First y=1 > last y=-1.
function assertArrowLrUnchanged(): void {
  const g = makeTestGraph(RANKDIR_LR);
  const e = makeArrowEdge(g, cloneArrowPts(), 'headArrowOps');
  gvPostprocess(g);
  const pts = getArrowPts(e, 'headArrowOps');
  expect(pts[0]!.y).toBeCloseTo(1, 5);
  expect(pts[2]!.y).toBeCloseTo(-1, 5);
}

// BT: 180° reflection (det=-1), base points swapped.
// ccw180({1,0})={1,0}; Offset={0,-50}; mapped=(1,50). After swap: first x=-1.
function assertArrowBtSwapped(): void {
  const g = makeTestGraph(RANKDIR_BT);
  const e = makeArrowEdge(g, cloneArrowPts(), 'headArrowOps');
  gvPostprocess(g);
  const pts = getArrowPts(e, 'headArrowOps');
  expect(pts[0]!.x).toBeCloseTo(-1, 5);
  expect(pts[2]!.x).toBeCloseTo(1, 5);
}

// RL: 270° reflection (det=-1), base points swapped.
// ccw270({1,0})={0,1}; Offset={0,0}; mapped=(0,1). After swap: first y=-1.
function assertArrowRlSwapped(): void {
  const g = makeTestGraph(RANKDIR_RL);
  const e = makeArrowEdge(g, cloneArrowPts(), 'headArrowOps');
  gvPostprocess(g);
  const pts = getArrowPts(e, 'headArrowOps');
  expect(pts[0]!.y).toBeCloseTo(-1, 5);
  expect(pts[2]!.y).toBeCloseTo(1, 5);
}

// BT: tailArrowOps receives the same swap as headArrowOps.
function assertTailArrowBtSwapped(): void {
  const g = makeTestGraph(RANKDIR_BT);
  const e = makeArrowEdge(g, cloneArrowPts(), 'tailArrowOps');
  gvPostprocess(g);
  const pts = getArrowPts(e, 'tailArrowOps');
  expect(pts[0]!.x).toBeCloseTo(-1, 5);
  expect(pts[2]!.x).toBeCloseTo(1, 5);
}

describe('gvPostprocess: arrowhead winding order correction', () => {
  it('TB: winding order unchanged (proper rotation)', assertArrowTbUnchanged);
  it('LR: winding order unchanged (proper rotation, det=+1)', assertArrowLrUnchanged);
  it('BT: base points swapped (reflection, det=-1)', assertArrowBtSwapped);
  it('RL: base points swapped (reflection, det=-1)', assertArrowRlSwapped);
  it('tailArrowOps also corrected for BT', assertTailArrowBtSwapped);
});

// ---------------------------------------------------------------------------
// addXLabels guard cases — via gvPostprocess (no xlabels → early return)
// ---------------------------------------------------------------------------

describe('addXLabels guard: no external labels → gvPostprocess runs without error', () => {
  it('graph with no has_labels bits set: postprocess completes', () => {
    const g = makeTestGraph(RANKDIR_TB);
    addNode(g);
    // has_labels defaults to 0 — none of NODE_XLABEL, EDGE_XLABEL, etc.
    g.info.has_labels = 0;
    expect(() => gvPostprocess(g)).not.toThrow();
  });

  it('EDGE_LABEL only + edgeLabelsDone=true → early return, no label mutations', () => {
    const g = makeTestGraph(RANKDIR_TB);
    const n = addNode(g);
    g.info.has_labels = 1; // EDGE_LABEL = 1
    g.info.edgeLabelsDone = true;
    gvPostprocess(g);
    // Nothing should have thrown; coord should be transformed normally.
    expect(n.info.coord).toBeDefined();
  });

  it('NODE_XLABEL set but no nodes with xlabels → postprocess completes', () => {
    const g = makeTestGraph(RANKDIR_TB);
    addNode(g);
    g.info.has_labels = NODE_XLABEL | EDGE_XLABEL | TAIL_LABEL | HEAD_LABEL;
    // Nodes have no xlabel attached — nLbls will be 0, runPlacement returns early.
    expect(() => gvPostprocess(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// addXLabel — Flip size swap
// @see lib/common/postproc.c:addXLabel (Flip branch)
// ---------------------------------------------------------------------------

function makeCtx(flip: boolean): XLabelCtx {
  const obj: ObjectT = { pos: { x: 0, y: 0 }, sz: { x: 0, y: 0 }, lbl: null };
  const lbl: XLabelT = { sz: { x: 0, y: 0 }, pos: { x: 0, y: 0 }, lbl: null, set: 0 };
  return { objs: [obj], lbls: [lbl], flip, oi: 0, xi: 0,
    bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } } };
}

describe('addXLabel: Flip size swap', () => {
  it('flip=false: xlp.sz = {dimen.x, dimen.y}', () => {
    const ctx = makeCtx(false);
    const lp = { dimen: { x: 30, y: 10 }, pos: { x: 0, y: 0 }, set: false } as never;
    addXLabel(lp, ctx, false, { x: 0, y: 0 });
    expect(ctx.lbls[0]!.sz.x).toBeCloseTo(30, 6);
    expect(ctx.lbls[0]!.sz.y).toBeCloseTo(10, 6);
  });

  it('flip=true: xlp.sz = {dimen.y, dimen.x} (axes swapped)', () => {
    const ctx = makeCtx(true);
    const lp = { dimen: { x: 30, y: 10 }, pos: { x: 0, y: 0 }, set: false } as never;
    addXLabel(lp, ctx, false, { x: 0, y: 0 });
    expect(ctx.lbls[0]!.sz.x).toBeCloseTo(10, 6);
    expect(ctx.lbls[0]!.sz.y).toBeCloseTo(30, 6);
  });
});

// ---------------------------------------------------------------------------
// updateBBForLabel — Flip axis swap (delegates to splines-label.ts:updateBB)
// @see lib/common/utils.c:569-595 addLabelBB
// @see plans/structural-match-endgame/analysis/2613-canvas.md
//
// Regression for the 2613 canvas-extent bug: updateBBForLabel used to grow
// the graph bbox with lp.dimen.x/y unconditionally, never swapping axes
// under GD_flip (rankdir=LR/RL) like C's addLabelBB does. Mirrors the
// updateBB flip tests in splines-label.test.ts.
// ---------------------------------------------------------------------------

describe('updateBBForLabel: Flip axis swap (delegates to updateBB)', () => {
  // A wide, short label (dimen 40×10) placed at the origin. Under flip
  // (rankdir=LR/RL) C swaps axes: width=dimen.y (10), height=dimen.x (40).
  function bbAfter(flip: boolean): { ll: { x: number; y: number }; ur: { x: number; y: number } } {
    const g = new Graph('g', 'directed');
    g.info.bb = { ll: { x: -1, y: -1 }, ur: { x: 1, y: 1 } };
    g.info.flip = flip;
    const lp = { dimen: { x: 40, y: 10 }, pos: { x: 0, y: 0 }, set: true } as never;
    updateBBForLabel(g, lp);
    return g.info.bb;
  }

  it('flip=false: grows by dimen.x horizontally, dimen.y vertically', () => {
    const bb = bbAfter(false);
    expect(bb.ur.x).toBeCloseTo(20, 6); // dimen.x/2
    expect(bb.ur.y).toBeCloseTo(5, 6);  // dimen.y/2
  });

  it('flip=true: axes swapped — grows by dimen.y horizontally, dimen.x vertically', () => {
    const bb = bbAfter(true);
    expect(bb.ur.x).toBeCloseTo(5, 6);  // dimen.y/2
    expect(bb.ur.y).toBeCloseTo(20, 6); // dimen.x/2
  });
});

// ---------------------------------------------------------------------------
// edgeTailpoint / edgeHeadpoint — with and without sflag/eflag
// @see lib/common/postproc.c:edgeTailpoint / edgeHeadpoint
// ---------------------------------------------------------------------------

function makeEdge(
  pts: Array<{ x: number; y: number }>,
  sflag: number,
  eflag: number,
  sp: { x: number; y: number },
  ep: { x: number; y: number },
): ELike {
  return {
    info: {
      spl: { list: [{ list: pts, sflag, eflag, sp, ep }] },
      edge_type: 1,
    },
  };
}

describe('edgeTailpoint', () => {
  it('sflag=0: returns first control point', () => {
    const e = makeEdge(
      [{ x: 5, y: 6 }, { x: 10, y: 20 }, { x: 15, y: 25 }, { x: 20, y: 30 }],
      0, 0, { x: 1, y: 2 }, { x: 99, y: 99 },
    );
    const pt = edgeTailpoint(e);
    expect(pt.x).toBeCloseTo(5, 6);
    expect(pt.y).toBeCloseTo(6, 6);
  });

  it('sflag=1: returns sp (arrow endpoint)', () => {
    const e = makeEdge(
      [{ x: 5, y: 6 }, { x: 10, y: 20 }, { x: 15, y: 25 }, { x: 20, y: 30 }],
      1, 0, { x: 1, y: 2 }, { x: 99, y: 99 },
    );
    const pt = edgeTailpoint(e);
    expect(pt.x).toBeCloseTo(1, 6);
    expect(pt.y).toBeCloseTo(2, 6);
  });
});

describe('edgeHeadpoint', () => {
  it('eflag=0: returns last control point', () => {
    const e = makeEdge(
      [{ x: 5, y: 6 }, { x: 10, y: 20 }, { x: 15, y: 25 }, { x: 20, y: 30 }],
      0, 0, { x: 1, y: 2 }, { x: 99, y: 99 },
    );
    const pt = edgeHeadpoint(e);
    expect(pt.x).toBeCloseTo(20, 6);
    expect(pt.y).toBeCloseTo(30, 6);
  });

  it('eflag=1: returns ep (arrow endpoint)', () => {
    const e = makeEdge(
      [{ x: 5, y: 6 }, { x: 10, y: 20 }, { x: 15, y: 25 }, { x: 20, y: 30 }],
      0, 1, { x: 1, y: 2 }, { x: 77, y: 88 },
    );
    const pt = edgeHeadpoint(e);
    expect(pt.x).toBeCloseTo(77, 6);
    expect(pt.y).toBeCloseTo(88, 6);
  });
});

