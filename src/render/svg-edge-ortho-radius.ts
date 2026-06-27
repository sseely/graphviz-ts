// SPDX-License-Identifier: EPL-2.0
//
// Rounded orthogonal edge corners — faithful port of the corner half of
// lib/common/emit.c's splines=ortho + radius/style=rounded path (emit.c
// 2130-2249). Given an edge's spline control points (graphviz-internal y-up),
// finds each orthogonal corner and computes its truncation points (inset by
// `radius` along each incident segment) and arc-wedge parameters.
//
// The emit half (segment + arc polylines) is added in T3. Coordinates are the
// internal y-up frame the spline is stored in; the SVG renderer negates y.

import type { Point } from '../model/geom.js';
import { ellipticWedge } from '../common/ellipse-wedge.js';

/** Per-corner geometry, mirroring emit.c:corner_info_t. */
export interface CornerInfo {
  /** Index of the corner point in the spline list. */
  idx: number;
  /** Truncation point toward the previous segment (curr − dir1·radius). */
  truncPrev: Point;
  /** Truncation point toward the next segment (curr + dir2·radius). */
  truncNext: Point;
  /** Center of the arc wedge. */
  wedgeCenter: Point;
  /** Arc start/end angles. */
  angle1: number;
  angle2: number;
}

/** @see lib/common/emit.c:find_prev_distinct (TOLERANCE 0.01) */
function findPrevDistinct(pts: Point[], i: number): number {
  const TOL = 0.01;
  for (let j = i - 1; j >= 0; j--) {
    if (Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) > TOL) return j;
  }
  return -1;
}

/** @see lib/common/emit.c:find_next_distinct (TOLERANCE 0.01) */
function findNextDistinct(pts: Point[], i: number, n: number): number {
  const TOL = 0.01;
  for (let j = i + 1; j < n; j++) {
    if (Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) > TOL) return j;
  }
  return -1;
}

/** Wedge center + arc angles for an orthogonal corner (8 orientation cases).
 *  @see lib/common/emit.c:calculate_wedge_parameters */
function calculateWedgeParameters(
  ci: CornerInfo, curr: Point, dx1: number, dy1: number, dx2: number, dy2: number,
  radius: number, seg1Horiz: boolean, seg2Vert: boolean,
): void {
  if (seg1Horiz && seg2Vert) {
    if (dx1 > 0 && dy2 < 0) {            // right then down
      ci.wedgeCenter = { x: curr.x - radius, y: curr.y - radius };
      ci.angle1 = 0; ci.angle2 = Math.PI / 2;
    } else if (dx1 > 0 && dy2 > 0) {     // right then up
      ci.wedgeCenter = { x: curr.x - radius, y: curr.y + radius };
      ci.angle1 = -Math.PI / 2; ci.angle2 = 0;
    } else if (dx1 < 0 && dy2 < 0) {     // left then down
      ci.wedgeCenter = { x: curr.x + radius, y: curr.y - radius };
      ci.angle1 = Math.PI / 2; ci.angle2 = Math.PI;
    } else {                             // left then up
      ci.wedgeCenter = { x: curr.x + radius, y: curr.y + radius };
      ci.angle1 = Math.PI; ci.angle2 = (3 * Math.PI) / 2;
    }
  } else {
    if (dy1 < 0 && dx2 > 0) {            // down then right
      ci.wedgeCenter = { x: curr.x + radius, y: curr.y + radius };
      ci.angle1 = Math.PI; ci.angle2 = (3 * Math.PI) / 2;
    } else if (dy1 < 0 && dx2 < 0) {     // down then left
      ci.wedgeCenter = { x: curr.x - radius, y: curr.y + radius };
      ci.angle1 = (3 * Math.PI) / 2; ci.angle2 = 2 * Math.PI;
    } else if (dy1 > 0 && dx2 > 0) {     // up then right
      ci.wedgeCenter = { x: curr.x + radius, y: curr.y - radius };
      ci.angle1 = Math.PI / 2; ci.angle2 = Math.PI;
    } else {                             // up then left
      ci.wedgeCenter = { x: curr.x - radius, y: curr.y - radius };
      ci.angle1 = 0; ci.angle2 = Math.PI / 2;
    }
  }
}

/** Process a detected orthogonal corner, appending it unless it duplicates one
 *  already found (DUP_TOL 0.01). @see lib/common/emit.c:process_corner */
function processCorner(
  corners: CornerInfo[], pts: Point[], i: number, curr: Point,
  dx1: number, dy1: number, dx2: number, dy2: number, radius: number,
  seg1Horiz: boolean, seg2Vert: boolean,
): void {
  const DUP_TOL = 0.01;
  for (const ci of corners) {
    const existing = pts[ci.idx];
    if (Math.hypot(curr.x - existing.x, curr.y - existing.y) < DUP_TOL) return;
  }

  const ci: CornerInfo = {
    idx: i, truncPrev: { x: 0, y: 0 }, truncNext: { x: 0, y: 0 },
    wedgeCenter: { x: 0, y: 0 }, angle1: 0, angle2: 0,
  };

  // Normalize direction vectors.
  const len1 = Math.hypot(dx1, dy1);
  const len2 = Math.hypot(dx2, dy2);
  const ndx1 = dx1 / len1, ndy1 = dy1 / len1;
  const ndx2 = dx2 / len2, ndy2 = dy2 / len2;

  // Truncation points (move radius distance away from the corner).
  ci.truncPrev = { x: curr.x - ndx1 * radius, y: curr.y - ndy1 * radius };
  ci.truncNext = { x: curr.x + ndx2 * radius, y: curr.y + ndy2 * radius };

  calculateWedgeParameters(ci, curr, dx1, dy1, dx2, dy2, radius, seg1Horiz, seg2Vert);
  corners.push(ci);
}

/**
 * Find every orthogonal corner in the spline point list and compute its
 * truncation + wedge parameters. A corner is a horizontal→vertical or
 * vertical→horizontal bend (TOL 0.1). @see lib/common/emit.c:find_ortho_corners
 */
export function findOrthoCorners(pts: Point[], radius: number): CornerInfo[] {
  const TOL = 0.1;
  const n = pts.length;
  const corners: CornerInfo[] = [];

  for (let i = 0; i < n; i++) {
    const prevIdx = findPrevDistinct(pts, i);
    const nextIdx = findNextDistinct(pts, i, n);
    if (prevIdx === -1 || nextIdx === -1) continue;

    const prev = pts[prevIdx], curr = pts[i], next = pts[nextIdx];
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;

    const seg1Horiz = Math.abs(dy1) < TOL && Math.abs(dx1) > TOL;
    const seg1Vert = Math.abs(dx1) < TOL && Math.abs(dy1) > TOL;
    const seg2Horiz = Math.abs(dy2) < TOL && Math.abs(dx2) > TOL;
    const seg2Vert = Math.abs(dx2) < TOL && Math.abs(dy2) > TOL;

    const isCorner = (seg1Horiz && seg2Vert) || (seg1Vert && seg2Horiz);
    if (isCorner) {
      processCorner(corners, pts, i, curr, dx1, dy1, dx2, dy2, radius, seg1Horiz, seg2Vert);
    }
  }

  // Sort by corner index (emit.c sorts the list before segment rendering).
  corners.sort((a, b) => a.idx - b.idx);
  return corners;
}

/** True when `p` is within CORNER_TOL of any corner point. */
function atAnyCorner(p: Point, pts: Point[], corners: CornerInfo[], tol: number): boolean {
  for (const c of corners) {
    const cp = pts[c.idx];
    if (Math.hypot(p.x - cp.x, p.y - cp.y) < tol) return true;
  }
  return false;
}

/** Straight polyline segments between truncated corners.
 *  @see lib/common/emit.c:2593-2654 (segment loop) */
function segmentPolylines(pts: Point[], corners: CornerInfo[]): Point[][] {
  const CORNER_TOL = 0.01;
  const n = pts.length;
  const out: Point[][] = [];

  let segStartIdx = 0;
  let segStartPt = pts[0];

  for (let c = 0; c <= corners.length; c++) {
    let segEndIdx: number;
    let segEndPt: Point;
    if (c < corners.length) {
      segEndIdx = corners[c].idx;
      segEndPt = corners[c].truncPrev;
    } else {
      segEndIdx = n - 1;
      segEndPt = pts[n - 1];
    }

    const seg: Point[] = [segStartPt];
    for (let pt = segStartIdx + 1; pt < segEndIdx; pt++) {
      if (!atAnyCorner(pts[pt], pts, corners, CORNER_TOL)) seg.push(pts[pt]);
    }
    seg.push(segEndPt);
    out.push(seg);

    if (c < corners.length) {
      // Skip all duplicates of this corner, then resume at its trunc_next.
      let nextIdx = corners[c].idx + 1;
      while (nextIdx < n && atAnyCorner(pts[nextIdx], pts, corners, CORNER_TOL)) nextIdx++;
      segStartIdx = nextIdx;
      segStartPt = corners[c].truncNext;
    }
  }
  return out;
}

/** Arc polyline per corner: the wedge slice [3 .. pn-4].
 *  @see lib/common/emit.c:draw_ortho_corner_markers / render_corner_arc */
function cornerArcPolylines(corners: CornerInfo[], radius: number): Point[][] {
  const out: Point[][] = [];
  for (const ci of corners) {
    const wedge = ellipticWedge(ci.wedgeCenter, radius, radius, ci.angle1, ci.angle2);
    if (wedge.length > 4) {
      const arcStart = 3;            // skip center, first arc point, AND duplicate
      const arcEnd = wedge.length - 4; // skip duplicate endpoint, last arc point, AND center
      const count = arcEnd >= arcStart ? arcEnd - arcStart + 1 : 0;
      if (count >= 2) out.push(wedge.slice(arcStart, arcEnd + 1));
    }
  }
  return out;
}

/**
 * The full list of `<polyline>` point-arrays native emits for an ortho edge with
 * rounded corners: straight segments between truncated corners first, then one
 * arc polyline per corner — matching emit.c's order (segment loop, then
 * draw_ortho_corner_markers). Returns `[]` when no orthogonal corner is found,
 * so the caller falls back to the bezier `<path>`.
 * @see lib/common/emit.c:2583-2662
 */
export function orthoRoundedPolylines(pts: Point[], radius: number): Point[][] {
  const corners = findOrthoCorners(pts, radius);
  if (corners.length === 0) return [];
  return [...segmentPolylines(pts, corners), ...cornerArcPolylines(corners, radius)];
}
