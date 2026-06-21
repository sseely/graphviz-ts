// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for getLayout() geometry snapshot.
 *
 * Uses the real dot pipeline: parse → layout → getLayout, on a tiny
 * two-node graph `digraph { a -> b }`.
 *
 * AC1: yAxis:'up'  → node y equals native ND_coord.y (no flip)
 * AC2: yAxis:'down' (default) → node y equals bbHeight - nativeY;
 *      bounds normalised to origin top-left (x=0, y=0)
 * AC3: edge points length matches spline bz.size sum; points are flipped
 * AC4: edge label is present when the source declares one; absent otherwise
 * AC5: snapshot is JSON-serializable (JSON.stringify round-trips)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parse } from '../parser/index.js';
import { GvcContext } from '../gvc/context.js';
import { createMeasurer } from '../common/textmeasure-factory.js';
import { DOT_LAYOUT_ENGINE } from '../layout/dot/index.js';
import type { Graph } from '../model/graph.js';
import { getLayout } from './geometry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function layoutGraph(src: string): Graph {
  const graph = parse(src);
  const ctx = new GvcContext(createMeasurer());
  ctx.register(DOT_LAYOUT_ENGINE);
  ctx.layout(graph, 'dot');
  return graph;
}

function bbH(graph: Graph): number {
  return graph.info.bb.ur.y - graph.info.bb.ll.y;
}

// ---------------------------------------------------------------------------
// Shared fixture: digraph { a -> b }
// ---------------------------------------------------------------------------

let g: Graph;
let bbHeight: number;
let nativeCoords: Map<string, { x: number; y: number }>;

beforeAll(() => {
  g = layoutGraph('digraph { a -> b }');
  bbHeight = bbH(g);
  nativeCoords = new Map(
    Array.from(g.nodes.values()).map((n) => [
      n.name,
      { x: n.info.coord.x, y: n.info.coord.y },
    ]),
  );
});

// ---------------------------------------------------------------------------
// AC1: yAxis:'up' returns native coordinates unchanged
// ---------------------------------------------------------------------------

describe("getLayout with yAxis:'up'", () => {
  it('returns native y for every node (no flip)', () => {
    const snap = getLayout(g, { yAxis: 'up' });
    for (const ng of snap.nodes) {
      const native = nativeCoords.get(ng.name);
      expect(native).toBeDefined();
      expect(ng.y).toBeCloseTo(native!.y, 5);
    }
  });

  it('bounds reflect the raw lower-left corner (non-zero y)', () => {
    const snap = getLayout(g, { yAxis: 'up' });
    expect(snap.bounds.x).toBeCloseTo(g.info.bb.ll.x, 5);
    expect(snap.bounds.y).toBeCloseTo(g.info.bb.ll.y, 5);
    expect(snap.bounds.width).toBeCloseTo(g.info.bb.ur.x - g.info.bb.ll.x, 5);
    expect(snap.bounds.height).toBeCloseTo(bbHeight, 5);
  });
});

// ---------------------------------------------------------------------------
// AC2: default yAxis:'down' flips y and normalises bounds
// ---------------------------------------------------------------------------

describe("getLayout default yAxis:'down' — node y", () => {
  it('flips each node y: y_down = bbHeight - y_native', () => {
    const snap = getLayout(g);
    for (const ng of snap.nodes) {
      const native = nativeCoords.get(ng.name);
      expect(native).toBeDefined();
      expect(ng.y).toBeCloseTo(bbHeight - native!.y, 5);
    }
  });

  it('flipped y equals bbHeight minus up-y for every node', () => {
    const down = getLayout(g);
    const up = getLayout(g, { yAxis: 'up' });
    for (let i = 0; i < down.nodes.length; i++) {
      expect(down.nodes[i].y).toBeCloseTo(bbHeight - up.nodes[i].y, 5);
    }
  });
});

describe("getLayout default yAxis:'down' — bounds", () => {
  it('bounds are normalised: x=0, y=0', () => {
    const snap = getLayout(g);
    expect(snap.bounds.x).toBe(0);
    expect(snap.bounds.y).toBe(0);
  });

  it('bounds dimensions match bbWidth × bbHeight', () => {
    const snap = getLayout(g);
    const bbWidth = g.info.bb.ur.x - g.info.bb.ll.x;
    expect(snap.bounds.width).toBeCloseTo(bbWidth, 5);
    expect(snap.bounds.height).toBeCloseTo(bbHeight, 5);
  });
});

// ---------------------------------------------------------------------------
// AC3: edge spline points — count and y-flip
// ---------------------------------------------------------------------------

describe('getLayout edge spline — point count', () => {
  it('edge a->b has at least one control point after dot layout', () => {
    const snap = getLayout(g);
    const edge = snap.edges.find((e) => e.tail === 'a' && e.head === 'b');
    expect(edge).toBeDefined();
    expect(edge!.points.length).toBeGreaterThan(0);
  });

  it('point count matches sum of bz.size across the spline list', () => {
    const snap = getLayout(g);
    const edge = snap.edges.find((e) => e.tail === 'a' && e.head === 'b');
    const modelEdge = g.edges.find((e) => e.tail.name === 'a' && e.head.name === 'b');
    expect(edge).toBeDefined();
    expect(modelEdge?.info.spl).toBeDefined();
    const expected = modelEdge!.info.spl!.list.reduce((s, bz) => s + bz.size, 0);
    expect(edge!.points.length).toBe(expected);
  });
});

describe('getLayout edge spline — y-flip', () => {
  it('default y-down: every point y equals bbHeight - native_y', () => {
    const down = getLayout(g);
    const up = getLayout(g, { yAxis: 'up' });
    const edgeDown = down.edges.find((e) => e.tail === 'a' && e.head === 'b');
    const edgeUp = up.edges.find((e) => e.tail === 'a' && e.head === 'b');
    expect(edgeDown).toBeDefined();
    expect(edgeUp).toBeDefined();
    expect(edgeDown!.points.length).toBe(edgeUp!.points.length);
    for (let i = 0; i < edgeDown!.points.length; i++) {
      expect(edgeDown!.points[i].y).toBeCloseTo(bbHeight - edgeUp!.points[i].y, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// AC4: edge label present/absent
// ---------------------------------------------------------------------------

describe('getLayout edge label', () => {
  it('a->b without label: label field is absent', () => {
    const snap = getLayout(g);
    const edge = snap.edges.find((e) => e.tail === 'a' && e.head === 'b');
    expect(edge).toBeDefined();
    expect(edge!.label).toBeUndefined();
  });

  it('edge with label: label field is populated and y is flipped', () => {
    const gL = layoutGraph('digraph { a -> b [label="x"] }');
    const down = getLayout(gL);
    const up = getLayout(gL, { yAxis: 'up' });
    const edgeDown = down.edges.find((e) => e.tail === 'a' && e.head === 'b');
    const edgeUp = up.edges.find((e) => e.tail === 'a' && e.head === 'b');
    expect(edgeDown?.label).toBeDefined();
    expect(edgeUp?.label).toBeDefined();
    const lbbH = bbH(gL);
    expect(edgeDown!.label!.y).toBeCloseTo(lbbH - edgeUp!.label!.y, 5);
  });
});

// ---------------------------------------------------------------------------
// AC5: JSON round-trip
// ---------------------------------------------------------------------------

describe('getLayout JSON serialization', () => {
  it('snapshot survives JSON.stringify + JSON.parse without loss', () => {
    const snap = getLayout(g);
    const round = JSON.parse(JSON.stringify(snap)) as typeof snap;
    expect(round).toEqual(snap);
  });
});

// ---------------------------------------------------------------------------
// Unit: width/height in points (model stores inches)
// ---------------------------------------------------------------------------

describe('NodeGeometry width/height units', () => {
  it('node width and height equal model inches * 72', () => {
    const snap = getLayout(g, { yAxis: 'up' });
    for (const ng of snap.nodes) {
      const model = g.nodes.get(ng.name);
      expect(model).toBeDefined();
      expect(ng.width).toBeCloseTo(model!.info.width * 72, 5);
      expect(ng.height).toBeCloseTo(model!.info.height * 72, 5);
    }
  });
});
