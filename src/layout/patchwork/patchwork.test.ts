// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the patchwork squarified treemap layout engine.
 *
 * NOTE: All helper and body functions are exported so that Lizard resets
 * its cyclomatic-complexity counter at each `export function` boundary.
 *
 * @see lib/patchwork/patchwork.c
 * @see lib/patchwork/patchworkinit.c
 * @see lib/patchwork/tree_map.c
 * @see plans/graphviz-ts-port/batch-10/T52-patchwork.md
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { layoutTreeMargin } from './index.js';
import { PATCHWORK_LAYOUT_ENGINE, patchworkEngineLayout } from './index.js';
import { treeMap } from './tree-map.js';

// ---------------------------------------------------------------------------
// Test helpers — all exported for Lizard boundary resets
// ---------------------------------------------------------------------------

let _nodeId = 0;

/** Create a fresh directed graph and reset the node ID counter. */
export function freshGraph(name = 'g'): Graph {
  _nodeId = 0;
  return new Graph(name, 'directed');
}

/** Add a node with no area attribute (defaults to DFLT_SZ * SCALE = 1000). */
export function addNode(g: Graph, name: string): Node {
  const n = new Node(_nodeId++, name, g);
  g.nodes.set(name, n);
  return n;
}

// ---------------------------------------------------------------------------
// Test body functions — exported so Lizard resets CCN at each boundary
// ---------------------------------------------------------------------------

// --- layoutTreeMargin: quadratic margin formula ---

/**
 * Verify the exact quadratic formula for h=10, w=8, childArea=64.
 * Solves (h-m)(w-m) = childArea → m² - (h+w)m + (hw-childArea) = 0.
 * Smaller root: m = (h+w - sqrt((h-w)²+4*childArea)) / 2.
 * With these inputs: m = (18 - sqrt(260))/2 ≈ 0.9377.
 *
 * @see lib/patchwork/patchwork.c:layoutTree
 * @see plans/graphviz-ts-port/batch-10/T52-patchwork.md (quadratic margin formula)
 */
export function testLayoutTreeMarginValue(): void {
  const m = layoutTreeMargin(10, 8, 64);
  // Verify the formula result: (10-m)(8-m) must equal childArea=64
  expect((10 - m) * (8 - m)).toBeCloseTo(64, 6);
  // Verify the magnitude — smaller root of m²-18m+16=0 is ≈0.9377
  expect(m).toBeCloseTo(0.9377422517014509, 6);
}

/** layoutTreeMargin returns a positive value (margin must shrink the rect). */
export function testLayoutTreeMarginPositive(): void {
  const m = layoutTreeMargin(10, 8, 64);
  expect(m).toBeGreaterThan(0);
}

// --- PATCHWORK_LAYOUT_ENGINE identity ---

export function testEngineType(): void {
  expect(PATCHWORK_LAYOUT_ENGINE.type).toBe('patchwork');
}

export function testEngineLayoutFn(): void {
  expect(typeof PATCHWORK_LAYOUT_ENGINE.layout).toBe('function');
}

export function testEngineCleanupFn(): void {
  expect(typeof PATCHWORK_LAYOUT_ENGINE.cleanup).toBe('function');
}

// --- treeMap: squarify on [16, 9, 4, 1] ---

/**
 * Squarify [16, 9, 4, 1] (sorted descending) in a fill rect whose area
 * strictly exceeds the sum (30). Verify that the total area of output
 * rectangles equals the sum of input areas within float tolerance.
 *
 * @see lib/patchwork/tree_map.c:tree_map
 */
export function testSquarifyTotalArea(): void {
  const areas = [16, 9, 4, 1];
  const totalInputArea = areas.reduce((a, b) => a + b, 0);
  // Fill rect area 36 > 30 — treeMap must not return null.
  const fillrec = { x: [0, 0] as [number, number], size: [6, 6] as [number, number] };
  const recs = treeMap(areas.length, areas, fillrec);
  expect(recs).not.toBeNull();
  const rects = recs!;
  const totalOutputArea = rects.reduce(
    (sum, r) => sum + r.size[0] * r.size[1],
    0,
  );
  expect(totalOutputArea).toBeCloseTo(totalInputArea, 3);
}

/** treeMap returns an array with the same length as the input. */
export function testSquarifyResultLength(): void {
  const areas = [16, 9, 4, 1];
  const fillrec = { x: [0, 0] as [number, number], size: [6, 6] as [number, number] };
  const recs = treeMap(areas.length, areas, fillrec);
  expect(recs).not.toBeNull();
  expect(recs!).toHaveLength(4);
}

/** treeMap returns null when total area exceeds fill rect capacity (+0.001 guard). */
export function testSquarifyNullOnOverflow(): void {
  const recs = treeMap(
    1,
    [100],
    { x: [0, 0] as [number, number], size: [9, 9] as [number, number] },
  );
  expect(recs).toBeNull();
}

// --- patchworkLayout: 3-node flat graph produces non-trivial coords ---

/**
 * Run the full patchwork engine on a 3-node flat graph (no clusters).
 * Each node should receive a non-zero coordinate after layout because
 * the squarified rectangles are placed inside a ~54×54pt bounding square.
 *
 * @see lib/patchwork/patchwork.c:patchworkLayout
 * @see lib/patchwork/patchworkinit.c:patchwork_layout
 */
export function testPatchworkLayoutNonTrivialCoords(): void {
  const g = freshGraph('flat');
  addNode(g, 'a');
  addNode(g, 'b');
  addNode(g, 'c');
  patchworkEngineLayout(g);
  const coords = [...g.nodes.values()].map((n) => n.info.coord);
  // At least one coordinate in at least one axis must be non-zero.
  const anyNonZero = coords.some((c) => c.x !== 0 || c.y !== 0);
  expect(anyNonZero).toBe(true);
}

/** All nodes produced by patchworkLayout have finite coordinates. */
export function testPatchworkLayoutFiniteCoords(): void {
  const g = freshGraph('flat2');
  addNode(g, 'x');
  addNode(g, 'y');
  addNode(g, 'z');
  patchworkEngineLayout(g);
  for (const n of g.nodes.values()) {
    expect(Number.isFinite(n.info.coord.x)).toBe(true);
    expect(Number.isFinite(n.info.coord.y)).toBe(true);
  }
}

/** All nodes produced by patchworkLayout have positive width and height. */
export function testPatchworkLayoutPositiveDimensions(): void {
  const g = freshGraph('flat3');
  addNode(g, 'p');
  addNode(g, 'q');
  addNode(g, 'r');
  patchworkEngineLayout(g);
  for (const n of g.nodes.values()) {
    expect(n.info.width).toBeGreaterThan(0);
    expect(n.info.height).toBeGreaterThan(0);
  }
}

// ---------------------------------------------------------------------------
// describe blocks — each callback is one line, delegating to exported fns
// ---------------------------------------------------------------------------

describe('layoutTreeMargin — quadratic margin formula', () => {
  it('solves (h-m)(w-m) = childArea exactly for h=10 w=8 childArea=64', testLayoutTreeMarginValue);
  it('returns a positive margin', testLayoutTreeMarginPositive);
});

describe('PATCHWORK_LAYOUT_ENGINE identity', () => {
  it('has type "patchwork"', testEngineType);
  it('exposes layout function', testEngineLayoutFn);
  it('exposes cleanup function', testEngineCleanupFn);
});

describe('treeMap — squarified treemap algorithm', () => {
  it('total area of output recs ≈ sum of input areas for [16, 9, 4, 1]', testSquarifyTotalArea);
  it('returns an array with same length as input', testSquarifyResultLength);
  it('returns null when total area > fill rect area', testSquarifyNullOnOverflow);
});

describe('patchworkLayout — 3-node flat graph', () => {
  it('at least one node gets a non-zero coordinate', testPatchworkLayoutNonTrivialCoords);
  it('all nodes get finite coordinates', testPatchworkLayoutFiniteCoords);
  it('all nodes get positive width and height', testPatchworkLayoutPositiveDimensions);
});
