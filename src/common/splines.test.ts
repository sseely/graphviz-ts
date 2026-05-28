// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { approxEqPt, evalBezier, updateBbBz } from './splines-geom.js';
import { newSpline, clipAndInstall } from './splines-clip.js';
import { routeSplines } from './splines-routespl.js';
import { MILLIPOINT } from './splines-constants.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { Edge } from '../model/edge.js';
import { makeNodeInfo } from '../model/nodeInfo.js';
import { makePort, makeEdgeInfo } from '../model/edgeInfo.js';
import type { Path } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: number): Node {
  const g = new Graph('g', 'directed');
  const n = new Node(id, `n${id}`, g);
  n.info = makeNodeInfo();
  n.info.coord = { x: 0, y: 0 };
  n.info.rw = 36;
  n.info.ht = 36;
  n.info.lw = 36;
  return n;
}

function makeEdge(tail: Node, head: Node): Edge {
  const tp = makePort();
  const hp = makePort();
  const e = new Edge(tail, head, 'e');
  e.info = makeEdgeInfo(tp, hp);
  return e;
}

// ---------------------------------------------------------------------------
// AC1: approxEqPt — same-point tolerance
// ---------------------------------------------------------------------------

describe('approxEqPt', () => {
  it('AC1a: returns true when distance is below tolerance', () => {
    const p = { x: 0, y: 0 };
    const q = { x: 0.0005, y: 0 };
    expect(approxEqPt(p, q, MILLIPOINT)).toBe(true);
  });

  it('AC1b: returns false when distance is above tolerance', () => {
    const p = { x: 0, y: 0 };
    const q = { x: 1, y: 0 };
    expect(approxEqPt(p, q, MILLIPOINT)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC2: evalBezier — midpoint of a horizontal cubic
// ---------------------------------------------------------------------------

describe('evalBezier', () => {
  it('AC2: midpoint of a straight horizontal cubic is the centre', () => {
    // A straight line from (0,0) to (12,0) expressed as a degenerate cubic
    const sp = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 8, y: 0 },
      { x: 12, y: 0 },
    ];
    const mid = evalBezier(sp, 0.5, null, null);
    expect(mid.x).toBeCloseTo(6, 5);
    expect(mid.y).toBeCloseTo(0, 5);
  });
});

// ---------------------------------------------------------------------------
// AC3: updateBbBz — expands bounding box correctly
// ---------------------------------------------------------------------------

describe('updateBbBz', () => {
  it('AC3: expands an empty bb to contain given control points', () => {
    const bb = { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } };
    const cp = [
      { x: -5, y: -5 },
      { x: 10, y: 3 },
      { x: 7, y: 20 },
      { x: 2, y: 1 },
    ];
    updateBbBz(bb, cp);
    expect(bb.ll.x).toBe(-5);
    expect(bb.ll.y).toBe(-5);
    expect(bb.ur.x).toBe(10);
    expect(bb.ur.y).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// AC4: newSpline — attaches a Bezier record to an edge's spl list
// ---------------------------------------------------------------------------

describe('newSpline', () => {
  it('AC4: creates spl on demand and returns a Bezier of the requested size', () => {
    const tail = makeNode(1);
    const head = makeNode(2);
    const e = makeEdge(tail, head);
    expect(e.info.spl == null).toBe(true);
    const bz = newSpline(e, 4);
    expect(e.info.spl).not.toBeNull();
    expect(e.info.spl!.list.length).toBe(1);
    expect(bz.list.length).toBe(4);
    expect(bz.size).toBe(4);
  });

  it('AC4b: second call appends to existing spl list', () => {
    const tail = makeNode(1);
    const head = makeNode(2);
    const e = makeEdge(tail, head);
    newSpline(e, 4);
    newSpline(e, 7);
    expect(e.info.spl!.size).toBe(2);
    expect(e.info.spl!.list.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC5: clipAndInstall — installs a straight-line spline (no clipping)
// ---------------------------------------------------------------------------

describe('clipAndInstall', () => {
  it('AC5: installs a 4-point bezier for a simple straight-line path', () => {
    const tail = makeNode(1);
    const head = makeNode(2);
    head.info.coord = { x: 100, y: 0 };
    const e = makeEdge(tail, head);
    const ps = [
      { x: 0, y: 0 }, { x: 33, y: 0 },
      { x: 67, y: 0 }, { x: 100, y: 0 },
    ];
    const info = { swapEnds: null, splineMerge: null, ignoreSwap: true, isOrtho: false };
    clipAndInstall(e, head, ps, 4, info);
    expect(e.info.spl).not.toBeNull();
    expect(e.info.spl!.list[0].size).toBe(4);
    expect(e.info.spl!.list[0].list[0]).toEqual({ x: 0, y: 0 });
    expect(e.info.spl!.list[0].list[3]).toEqual({ x: 100, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// AC6: routeSplines — returns null for a degenerate (inverted) box
// ---------------------------------------------------------------------------

describe('routeSplines', () => {
  it('AC6: returns null when the single box is degenerate (ll > ur)', () => {
    // A degenerate box (ll.x > ur.x) signals hard failure in checkPath
    const pp: Path = {
      start: makePort(),
      end: makePort(),
      boxes: [{ ll: { x: 10, y: 0 }, ur: { x: 5, y: 10 } }],
      nbox: 1,
      data: null,
    };
    const result = routeSplines(pp);
    expect(result).toBeNull();
  });
});
