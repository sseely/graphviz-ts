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
  key: '_arrowPts' | '_tailArrowPts',
) {
  const n = addNode(g);
  const e = {
    tail: n,
    head: n,
    info: { spl: { list: [makeStubBezier()] }, [key]: pts },
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
  return (e.info as Record<string, unknown>)[key] as Array<{ x: number; y: number }>;
}

// TB: identity transform, no winding change.
function assertArrowTbUnchanged(): void {
  const g = makeTestGraph(RANKDIR_TB);
  const e = makeArrowEdge(g, cloneArrowPts(), '_arrowPts');
  gvPostprocess(g);
  const pts = getArrowPts(e, '_arrowPts');
  expect(pts[0]!.x).toBeCloseTo(1, 5);
  expect(pts[2]!.x).toBeCloseTo(-1, 5);
}

// LR: 90° rotation (det=+1), no winding change.
// ccw90({1,0})={0,1}; Offset={-50,0}; mapped=(50,1). First y=1 > last y=-1.
function assertArrowLrUnchanged(): void {
  const g = makeTestGraph(RANKDIR_LR);
  const e = makeArrowEdge(g, cloneArrowPts(), '_arrowPts');
  gvPostprocess(g);
  const pts = getArrowPts(e, '_arrowPts');
  expect(pts[0]!.y).toBeCloseTo(1, 5);
  expect(pts[2]!.y).toBeCloseTo(-1, 5);
}

// BT: 180° reflection (det=-1), base points swapped.
// ccw180({1,0})={1,0}; Offset={0,-50}; mapped=(1,50). After swap: first x=-1.
function assertArrowBtSwapped(): void {
  const g = makeTestGraph(RANKDIR_BT);
  const e = makeArrowEdge(g, cloneArrowPts(), '_arrowPts');
  gvPostprocess(g);
  const pts = getArrowPts(e, '_arrowPts');
  expect(pts[0]!.x).toBeCloseTo(-1, 5);
  expect(pts[2]!.x).toBeCloseTo(1, 5);
}

// RL: 270° reflection (det=-1), base points swapped.
// ccw270({1,0})={0,1}; Offset={0,0}; mapped=(0,1). After swap: first y=-1.
function assertArrowRlSwapped(): void {
  const g = makeTestGraph(RANKDIR_RL);
  const e = makeArrowEdge(g, cloneArrowPts(), '_arrowPts');
  gvPostprocess(g);
  const pts = getArrowPts(e, '_arrowPts');
  expect(pts[0]!.y).toBeCloseTo(-1, 5);
  expect(pts[2]!.y).toBeCloseTo(1, 5);
}

// BT: _tailArrowPts receives the same swap as _arrowPts.
function assertTailArrowBtSwapped(): void {
  const g = makeTestGraph(RANKDIR_BT);
  const e = makeArrowEdge(g, cloneArrowPts(), '_tailArrowPts');
  gvPostprocess(g);
  const pts = getArrowPts(e, '_tailArrowPts');
  expect(pts[0]!.x).toBeCloseTo(-1, 5);
  expect(pts[2]!.x).toBeCloseTo(1, 5);
}

describe('gvPostprocess: arrowhead winding order correction', () => {
  it('TB: winding order unchanged (proper rotation)', assertArrowTbUnchanged);
  it('LR: winding order unchanged (proper rotation, det=+1)', assertArrowLrUnchanged);
  it('BT: base points swapped (reflection, det=-1)', assertArrowBtSwapped);
  it('RL: base points swapped (reflection, det=-1)', assertArrowRlSwapped);
  it('_tailArrowPts also corrected for BT', assertTailArrowBtSwapped);
});
