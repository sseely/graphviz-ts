// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import { Node } from '../../model/node.js';
import { Graph } from '../../model/graph.js';
import { removeOverlap, buildRectangles, allocateVariables } from './overlap.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeGraph(): Graph {
  return new Graph('test', 'directed');
}

function makeNode(
  g: Graph,
  id: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Node {
  const n = new Node(id, `n${id}`, g);
  n.info.pos = [x, y];
  n.info.width = w;
  n.info.height = h;
  return n;
}

interface BBox { left: number; right: number; bottom: number; top: number }

function bbox(n: Node): BBox {
  const x = n.info.pos?.[0] ?? 0;
  const y = n.info.pos?.[1] ?? 0;
  return {
    left: x - n.info.width / 2,
    right: x + n.info.width / 2,
    bottom: y - n.info.height / 2,
    top: y + n.info.height / 2,
  };
}

function overlaps(a: BBox, b: BBox): boolean {
  return a.left < b.right && b.left < a.right
    && a.bottom < b.top && b.bottom < a.top;
}

function assertNoOverlaps(nodes: Node[]): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      expect(
        overlaps(bbox(nodes[i]!), bbox(nodes[j]!)),
        `nodes ${i} and ${j} still overlap`,
      ).toBe(false);
    }
  }
}

// ---------------------------------------------------------------------------
// Fixture factory — 4 deliberately overlapping nodes
//
//  [0]: pos=[0,0] w=2 h=2  → [-1,1]×[-1,1]
//  [1]: pos=[1,1] w=2 h=2  → [ 0,2]×[ 0,2]  overlaps [0]
//  [2]: pos=[0,3] w=2 h=2  → [-1,1]×[ 2,4]
//  [3]: pos=[3,0] w=2 h=2  → [ 2,4]×[-1,1]
// ---------------------------------------------------------------------------

function makeOverlappingNodes(g: Graph): Node[] {
  return [
    makeNode(g, 0, 0, 0, 2, 2),
    makeNode(g, 1, 1, 1, 2, 2),
    makeNode(g, 2, 0, 3, 2, 2),
    makeNode(g, 3, 3, 0, 2, 2),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('removeOverlap', () => {
  let g: Graph;
  let nodes: Node[];
  const sep = { x: 0, y: 0 };

  beforeEach(() => {
    g = makeGraph();
    nodes = makeOverlappingNodes(g);
  });

  it('resolves overlaps so no two bounding boxes intersect', () => {
    removeOverlap(nodes, sep);
    assertNoOverlaps(nodes);
  });

  it('X and Y Variable arrays are distinct objects', () => {
    const xVars = allocateVariables(nodes, 0);
    const yVars = allocateVariables(nodes, 1);
    for (let i = 0; i < nodes.length; i++) {
      expect(xVars[i]).not.toBe(yVars[i]);
    }
  });

  it('X and Y Rectangle arrays are distinct objects', () => {
    const xRects = buildRectangles(nodes, sep);
    const yRects = buildRectangles(nodes, sep);
    for (let i = 0; i < nodes.length; i++) {
      expect(xRects[i]).not.toBe(yRects[i]);
    }
  });

  it('teardown runs without throwing', () => {
    expect(() => removeOverlap(nodes, sep)).not.toThrow();
  });

  it('does nothing when fewer than 2 nodes', () => {
    const single = [makeNode(g, 0, 5, 5, 2, 2)];
    removeOverlap(single, sep);
    expect(single[0]!.info.pos).toEqual([5, 5]);
  });

  it('resolves overlaps with positive sep padding', () => {
    removeOverlap(nodes, { x: 2, y: 2 });
    assertNoOverlaps(nodes);
  });
});
