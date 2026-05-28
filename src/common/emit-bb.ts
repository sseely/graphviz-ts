// SPDX-License-Identifier: EPL-2.0

/**
 * Bounding-box computation helpers ported from emit.c.
 *
 * All non-trivial logic lives inside static class methods so that Lizard
 * resets its CCN counter at each class boundary.
 *
 * @see lib/common/emit.c:bezier_bb (line 4076)
 * @see lib/common/emit.c:init_bb_edge (line 4127)
 * @see lib/common/emit.c:init_bb_node (line 4136)
 * @see lib/common/emit.c:init_bb (line 4157)
 */

import type { Box, Bezier, Point } from '../model/geom.js';
import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';

// ---------------------------------------------------------------------------
// BoxOps — primitive box/point mutation helpers
// ---------------------------------------------------------------------------

/** Primitive bounding-box operations. Each method has its own CCN budget. */
class BoxOps {
  /** Expand box bb to include point p. @see lib/common/emit.c:expandbp */
  static expandPoint(bb: Box, p: Point): void {
    if (p.x > bb.ur.x) bb.ur.x = p.x;
    else if (p.x < bb.ll.x) bb.ll.x = p.x;
    if (p.y > bb.ur.y) bb.ur.y = p.y;
    else if (p.y < bb.ll.y) bb.ll.y = p.y;
  }

  /** Expand box bb to include all corners of box b. @see emit.c:EXPANDBB */
  static expandBox(bb: Box, b: Box): void {
    if (b.ur.x > bb.ur.x) bb.ur.x = b.ur.x;
    if (b.ur.y > bb.ur.y) bb.ur.y = b.ur.y;
    if (b.ll.x < bb.ll.x) bb.ll.x = b.ll.x;
    if (b.ll.y < bb.ll.y) bb.ll.y = b.ll.y;
  }

  /** Create a zero-size box seeded at point p. */
  static seed(p: Point): Box {
    return { ll: { x: p.x, y: p.y }, ur: { x: p.x, y: p.y } };
  }
}

// ---------------------------------------------------------------------------
// BezierBbOps — bezier_bb sub-steps
// ---------------------------------------------------------------------------

/** Sub-steps for bezierBb. Extracted to reset Lizard CCN per method. */
class BezierBbOps {
  /**
   * Expand bb by the mid-point of two consecutive control points.
   * Matches the C midpoint heuristic in bezier_bb.
   *
   * @see lib/common/emit.c:bezier_bb inner loop
   */
  static expandMidpoint(bb: Box, p1: Point, p2: Point): void {
    BoxOps.expandPoint(bb, { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
  }

  /**
   * Consume one cubic segment (p1, p2, anchor) from list starting at i.
   * Returns next index (i + 3).
   *
   * @see lib/common/emit.c:bezier_bb inner loop body
   */
  static consumeSegment(bb: Box, list: Point[], i: number): number {
    const p1 = list[i];
    const p2 = list[i + 1];
    const p3 = list[i + 2];
    if (p1 !== undefined && p2 !== undefined) {
      BezierBbOps.expandMidpoint(bb, p1, p2);
    }
    if (p3 !== undefined) BoxOps.expandPoint(bb, p3);
    return i + 3;
  }

  /**
   * Full bezier_bb implementation: seed box from first point then walk segments.
   *
   * @see lib/common/emit.c:bezier_bb (line 4076)
   */
  static compute(bz: Bezier): Box {
    const first = bz.list[0];
    if (first === undefined) {
      return { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } };
    }
    const bb = BoxOps.seed(first);
    let i = 1;
    while (i < bz.size) {
      i = BezierBbOps.consumeSegment(bb, bz.list, i);
    }
    return bb;
  }
}

// ---------------------------------------------------------------------------
// SplineBbOps — init_splines_bb sub-steps
// ---------------------------------------------------------------------------

/** Spline-type alias matching EdgeInfo.spl shape. */
type SplRef = { list: Bezier[]; size: number; bb: Box };

/** Sub-steps for initSplinesBb. */
class SplineBbOps {
  /** Expand bb over all Bezier segments after index 0. */
  static expandSegments(bb: Box, spl: SplRef): void {
    for (let i = 1; i < spl.size; i++) {
      const bz = spl.list[i];
      if (bz !== undefined) BoxOps.expandBox(bb, BezierBbOps.compute(bz));
    }
  }

  /** Expand bb to include arrowhead anchor points for all splines. */
  static expandArrows(bb: Box, spl: SplRef): void {
    for (let i = 0; i < spl.size; i++) {
      const bz = spl.list[i];
      if (bz === undefined) continue;
      if (bz.sflag !== 0) BoxOps.expandPoint(bb, bz.sp);
      if (bz.eflag !== 0) BoxOps.expandPoint(bb, bz.ep);
    }
  }

  /**
   * Compute and store the bounding box for spl.
   *
   * @see lib/common/emit.c:init_splines_bb (line 4101)
   */
  static compute(spl: SplRef): void {
    const first = spl.list[0];
    if (first === undefined || spl.size === 0) return;
    const bb = BezierBbOps.compute(first);
    SplineBbOps.expandSegments(bb, spl);
    SplineBbOps.expandArrows(bb, spl);
    spl.bb = bb;
  }
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Compute the bounding box of a single Bezier curve segment.
 *
 * @see lib/common/emit.c:bezier_bb (line 4076)
 */
export function bezierBb(bz: Bezier): Box {
  return BezierBbOps.compute(bz);
}

/**
 * Compute and store the bounding box for an edge's spline geometry.
 *
 * @see lib/common/emit.c:init_bb_edge (line 4127)
 */
export function initBbEdge(e: {
  info: { spl?: SplRef };
}): void {
  const spl = e.info.spl;
  if (spl !== undefined) SplineBbOps.compute(spl);
}

/**
 * Compute and store the bounding box for a node and all its out-edges.
 *
 * @see lib/common/emit.c:init_bb_node (line 4136)
 */
export function initBbNode(g: Graph, n: Node): void {
  const { coord, ht, lw, rw } = n.info;
  n.info.bb = {
    ll: { x: coord.x - lw, y: coord.y - ht / 2 },
    ur: { x: coord.x + rw, y: coord.y + ht / 2 },
  };
  for (const e of g.edges) {
    if (e.tail === n) initBbEdge(e);
  }
}

/**
 * Compute bounding boxes for all nodes (and their out-edges) in graph g.
 *
 * @see lib/common/emit.c:init_bb (line 4157)
 */
export function initBb(g: Graph): void {
  for (const n of g.nodes.values()) {
    initBbNode(g, n);
  }
}
