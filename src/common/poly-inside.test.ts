// SPDX-License-Identifier: EPL-2.0
/**
 * recordInside rankdir rotation (1332 T2, mechanism M3).
 *
 * C's record_inside converts the query point to the record's own (label)
 * frame before the field-bbox test: `ccwrotatepf(p, 90 * GD_rankdir)`.
 * Omitting the rotation makes every record clip decision under
 * rankdir=LR/BT/RL test the raw layout-frame point — 1332's record clips
 * landed 1.6-2.6pt off until the rotation was ported.
 *
 * @see lib/common/shapes.c:record_inside
 */

import { describe, it, expect } from 'vitest';
import { recordInside } from './poly-inside.js';
import type { InsideContext } from './splines-geom.js';
import { Graph } from '../model/graph.js';
import { Node } from '../model/node.js';
import { makeNodeInfo } from '../model/nodeInfo.js';

/** A record node in a graph with the given rankdir, field bbox 60×20. */
function recordNode(rankdir: number): Node {
  const g = new Graph('g', 'directed');
  g.info.rankdir = rankdir;
  const n = new Node(1, 'r', g);
  n.info = makeNodeInfo();
  // Record field tree bbox in the LABEL frame (wide, short).
  n.info.shape_info = { b: { ll: { x: -30, y: -10 }, ur: { x: 30, y: 10 } } };
  return n;
}

function ctxFor(n: Node): InsideContext {
  return { nodeCoord: n.info.coord ?? { x: 0, y: 0 }, rw: 0, bp: null, node: n };
}

describe('recordInside rotates the query point by rankdir (M3, 1332)', () => {
  it('rankdir=TB tests the raw point', () => {
    const n = recordNode(0);
    expect(recordInside(ctxFor(n), { x: 25, y: 0 })).toBe(true);
    expect(recordInside(ctxFor(n), { x: 0, y: 25 })).toBe(false);
  });

  it('rankdir=LR rotates: a layout-frame point deep in the node tests true', () => {
    const n = recordNode(1);
    // Layout frame under LR is the label frame rotated CW; the query point
    // (0, 25) maps via ccwrotatepf(p, 90) = (-25, 0) — inside the wide bbox.
    expect(recordInside(ctxFor(n), { x: 0, y: 25 })).toBe(true);
    // And (25, 0) maps to (0, 25) — OUTSIDE the short bbox. Without the
    // rotation both answers invert.
    expect(recordInside(ctxFor(n), { x: 25, y: 0 })).toBe(false);
  });
});
