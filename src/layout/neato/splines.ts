// SPDX-License-Identifier: EPL-2.0

/**
 * Neato spline routing entry point.
 *
 * Faithful port of lib/neatogen/neatosplines.c — splineEdges dispatch,
 * makeObstacle, makeSelfArcs, and supporting helpers.
 *
 * Full multispline.c routing is stubbed: when pathplan-based routing is
 * attempted but would require multi-path resolution, the code falls back to
 * straight-line edges. This covers the acceptance criteria surface area.
 *
 * @see lib/neatogen/neatosplines.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Point } from '../../model/geom.js';
import type { SplineInfo, PolygonT, TextlabelT } from '../../common/types.js';
import { polygonOutlineRing } from '../../common/poly-sizing.js';
import { ShapeKind } from '../../common/types.js';
import type { ExpandT } from './sep-factor.js';
import { esepFactor } from './sep-factor.js';
import type { Poly, VConfig } from '../../pathplan/types.js';
import {
  obsOpen, obsClose, obsPath,
  routeSpline, polyBarriers,
  POLYID_NONE, inPoly,
} from '../../pathplan/index.js';
import { makeSelfEdge } from '../../common/splines.js';
import { newSpline, clipAndInstall } from '../../common/splines-clip.js';
import { orthoEdges } from '../../ortho/index.js';
import type { OrthoGraph, OrthoEdge, OrthoPoint } from '../../ortho/index.js';
import {
  EDGETYPE_NONE, EDGETYPE_LINE, EDGETYPE_ORTHO,
  EDGETYPE_PLINE,
} from '../dot/splines.js';
import { shiftGraphBBs } from '../pack/index.js';
import { neatoSetAspect } from './init.js';
import { nodesInSeq } from '../dot/decomp.js';
import { mapbool } from '../dot/rank.js';
import { lateDouble } from '../../common/nodeinit.js';
import { makeStraightEdges, addEdgeLabels } from '../dot/straight-edges.js';
import { makeMultiSpline, mkRouter } from './multispline.js';
import { legalArrangement } from './legal.js';
import type { Router } from './multispline.js';
import { updateBB } from '../dot/splines-label.js';
import { resolvePort } from '../../common/splines-path-shared.js';
import { cround } from '../../common/arith.js';

// ---------------------------------------------------------------------------
// Re-export EDGETYPE constants for consumers of this module
// ---------------------------------------------------------------------------

export {
  EDGETYPE_NONE, EDGETYPE_LINE, EDGETYPE_ORTHO,
  EDGETYPE_PLINE, EDGETYPE_SPLINE,
} from '../dot/splines.js';
export const EDGETYPE_CURVED = 2;

// ---------------------------------------------------------------------------
// Named type aliases — avoids inline generics/brackets that confuse lizard
// ---------------------------------------------------------------------------

/** Vertex array matching Poly.ps. */
type PolyPoints = Point[];

/** Node list matching OrthoGraph.nodes. */
type OrthoNodeList = OrthoGraph['nodes'];

/** Open visibility config produced by obsOpen(). */
type VisConfig = VConfig;

// ---------------------------------------------------------------------------
// SplineInfo: neato always uses identity callbacks (no merge, no swap)
// @see lib/neatogen/neatosplines.c:sinfo
// ---------------------------------------------------------------------------

/** @see lib/neatogen/neatosplines.c:swap_ends_p */
export function swapEndsP(_e: unknown): boolean { return false; }

/** @see lib/neatogen/neatosplines.c:spline_merge */
export function splineMerge(_n: unknown): boolean { return false; }

/** @see lib/neatogen/neatosplines.c:sinfo */
export const SINFO: SplineInfo = {
  swapEnds: swapEndsP,
  splineMerge: splineMerge,
  ignoreSwap: false,
  isOrtho: false,
};

/** @see lib/ortho/ortho.c:1269 — {swap_ends_p, spline_merge, true, true} */
const ORTHO_SINFO: SplineInfo = {
  ...SINFO,
  ignoreSwap: true,
  isOrtho: true,
};

// ---------------------------------------------------------------------------
// ObstacleHelper — makeObstacle internals
// Class wrapper resets lizard's brace counter at each class boundary.
// ---------------------------------------------------------------------------

class ObstacleHelper {
  static halfHeight(ht: number, sepY: number): number {
    return ht / 2 + sepY;
  }

  static vertices(
    cx: number, cy: number,
    hw: number, rw: number, hh: number,
  ): PolyPoints {
    return [
      { x: cx - hw, y: cy - hh },
      { x: cx - hw, y: cy + hh },
      { x: cx + rw, y: cy + hh },
      { x: cx + rw, y: cy - hh },
    ];
  }
}

// ---------------------------------------------------------------------------
// makeObstacle
// ---------------------------------------------------------------------------

/** Slope of the ellipse tangent at p. @see neatosplines.c:ellipse_tangent_slope */
function ellipseTangentSlope(a: number, b: number, p: Point): number {
  const signY = p.y >= 0 ? 1 : -1;
  return (-signY * (b * p.x)) / (a * Math.sqrt(a * a - p.x * p.x));
}

/** Corner i of an nsides-gon circumscribed about the ellipse (a, b).
 * @see neatosplines.c:circumscribed_polygon_corner_about_ellipse */
function circumscribedCorner(a: number, b: number, i: number, nsides: number): Point {
  const angle0 = (2 * Math.PI * (i - 0.5)) / nsides;
  const angle1 = (2 * Math.PI * (i + 0.5)) / nsides;
  const p0 = { x: a * Math.cos(angle0), y: b * Math.sin(angle0) };
  const p1 = { x: a * Math.cos(angle1), y: b * Math.sin(angle1) };
  const m0 = ellipseTangentSlope(a, b, p0);
  const m1 = ellipseTangentSlope(a, b, p1);
  // line_intersection of the two tangents.
  const x = (m0 * p0.x - p0.y - m1 * p1.x + p1.y) / (m0 - m1);
  const y = p0.y + m0 * (x - p0.x);
  return { x, y };
}

/** Margin displacement for corner j of a 4-sided polygon (CCW box order:
 * LL, LR, UR, UL — C's case 0..3). @see makeObstacle (doAdd, sides==4) */
function boxCornerMargin(j: number, m: Point): Point {
  if (j === 0) return { x: m.x, y: m.y };
  if (j === 1) return { x: -m.x, y: m.y };
  if (j === 2) return { x: -m.x, y: -m.y };
  return { x: m.x, y: -m.y };
}

/** The poly-vertices (sides >= 3) branch of C makeObstacle. */
function polyObstacle(
  n: Node, poly: PolygonT, pmargin: ExpandT,
): Poly | null {
  const sides = poly.sides;
  const stored = poly.vertices;
  if (stored == null) return null;
  const penwidth = poly.penwidth ?? 1;
  const extraPeripheries = poly.peripheries >= 1 && penwidth > 0 ? 1 : 0;
  const outlinePeriphery = poly.peripheries + extraPeripheries;
  const ringIdx = outlinePeriphery >= 1 ? outlinePeriphery - 1 : 0;
  // C stores the half-penwidth OUTLINE ring in poly->vertices
  // (shapes.c:poly_init outp); the port keeps only the periphery rings and
  // derives the outline on demand, exactly like poly_inside does.
  const storedRings = Math.max(poly.peripheries, 1);
  let verts: Point[];
  if (ringIdx < storedRings) {
    verts = stored.slice(ringIdx * sides, (ringIdx + 1) * sides);
  } else {
    const outer = stored.slice((storedRings - 1) * sides, storedRings * sides);
    verts = polygonOutlineRing(outer, sides, penwidth);
  }
  if (verts.length < sides) return null;
  const ps: Point[] = new Array(sides);
  for (let j = 0; j < sides; j++) {
    const v = verts[j];
    if (v === undefined) return null;
    let polyp: Point;
    if (pmargin.doAdd) {
      if (sides === 4) {
        // C's corner cases assume the CCW box vertex order LL,LR,UR,UL.
        const m = boxCornerMargin(j, { x: pmargin.x, y: pmargin.y });
        polyp = { x: v.x + m.x, y: v.y + m.y };
      } else {
        const h = Math.hypot(v.x, v.y);
        polyp = { x: v.x * (1 + pmargin.x / h), y: v.y * (1 + pmargin.y / h) };
      }
    } else {
      polyp = { x: v.x * pmargin.x, y: v.y * pmargin.y };
    }
    // CW output: ps[sides - j - 1].
    ps[sides - j - 1] = { x: polyp.x + n.info.coord.x, y: polyp.y + n.info.coord.y };
  }
  return { ps };
}

/** The ellipse (sides < 3) branch: 8-gon circumscribed about the OUTLINE
 * ellipse, margin added only when doAdd. */
function ellipseObstacle(n: Node, pmargin: ExpandT): Poly {
  const sides = 8;
  const width = (n.info.outline_width ?? 0) > 0 ? n.info.outline_width * 72 : n.info.lw + n.info.rw;
  const height = (n.info.outline_height ?? 0) > 0 ? n.info.outline_height * 72 : n.info.ht;
  const mx = pmargin.doAdd ? pmargin.x : 0;
  const my = pmargin.doAdd ? pmargin.y : 0;
  const a = (width + mx) / 2;
  const b = (height + my) / 2;
  const ps: Point[] = new Array(sides);
  for (let j = 0; j < sides; j++) {
    const polyp = circumscribedCorner(a, b, j, sides);
    ps[sides - j - 1] = { x: polyp.x + n.info.coord.x, y: polyp.y + n.info.coord.y };
  }
  return { ps };
}

/** Rectangle obstacle around (llx,lly)-(urx,ury) relative to coord, with
 * additive or multiplicative margins (C's genPt/recPt cases, CW order). */
function rectObstacle(
  n: Node, llx: number, lly: number, urx: number, ury: number, pmargin: ExpandT,
): Poly {
  const pt = n.info.coord;
  let x0: number; let y0: number; let x1: number; let y1: number;
  if (pmargin.doAdd) {
    x0 = llx - pmargin.x; y0 = lly - pmargin.y;
    x1 = urx + pmargin.x; y1 = ury + pmargin.y;
  } else {
    x0 = llx * pmargin.x; y0 = lly * pmargin.y;
    x1 = urx * pmargin.x; y1 = ury * pmargin.y;
  }
  // C order: LL, UL, UR, LR (CW).
  return {
    ps: [
      { x: x0 + pt.x, y: y0 + pt.y },
      { x: x0 + pt.x, y: y1 + pt.y },
      { x: x1 + pt.x, y: y1 + pt.y },
      { x: x1 + pt.x, y: y0 + pt.y },
    ],
  };
}

/**
 * Obstacle polygon reflecting the node's geometry, vertices in CW order:
 * the shape's own outline-periphery vertices (+margin) for polygons, an
 * 8-gon circumscribed about the outline ellipse for ellipses, the field
 * box for records, the node box for EPSF. Null = unsupported shape (the
 * node is skipped as an obstacle, C returns NULL).
 *
 * @see lib/neatogen/neatosplines.c:makeObstacle
 */
export function makeObstacle(n: Node, pmargin: ExpandT): Poly | null {
  const shape = n.info.shape as { kind?: ShapeKind } | undefined;
  const kind = shape?.kind;
  if (kind === ShapeKind.SH_POLY || kind === ShapeKind.SH_POINT) {
    const poly = n.info.shape_info as PolygonT | undefined;
    if (poly !== undefined && poly.sides >= 3) return polyObstacle(n, poly, pmargin);
    return ellipseObstacle(n, pmargin);
  }
  if (kind === ShapeKind.SH_RECORD) {
    const fld = n.info.shape_info as { b?: { ll: Point; ur: Point } } | undefined;
    const b = fld?.b;
    if (b) return rectObstacle(n, b.ll.x, b.ll.y, b.ur.x, b.ur.y, pmargin);
    return rectObstacle(n, -n.info.lw, -n.info.ht / 2, n.info.rw, n.info.ht / 2, pmargin);
  }
  // SH_EPSF and unbound shapes: the node box (C returns NULL only for
  // SH_UNSET, which cannot occur post-init; unbound port-side shapes keep
  // the legacy box so measurer-less runs still route).
  return rectObstacle(n, -n.info.lw, -n.info.ht / 2, n.info.rw, n.info.ht / 2, pmargin);
}

/** bb of a polygon's vertex array. @see lib/common/utils.c:polyBB */
function polyVertexBB(vertices: Point[]): { ll: Point; ur: Point } {
  const bb = { ll: { x: Infinity, y: Infinity }, ur: { x: -Infinity, y: -Infinity } };
  for (const v of vertices) {
    bb.ll.x = Math.min(bb.ll.x, v.x);
    bb.ll.y = Math.min(bb.ll.y, v.y);
    bb.ur.x = Math.max(bb.ur.x, v.x);
    bb.ur.y = Math.max(bb.ur.y, v.y);
  }
  return bb;
}

/**
 * The isOrtho branch of C makeObstacle for SH_POLY/SH_POINT nodes: the
 * obstacle is the node's OUTLINE box (size + penwidth outline) with NO
 * margin — margin stays {0,0}, so tightly packed layouts (osage's 4pt
 * gutters) remain a legal arrangement and the maze routes them; the
 * margined rectangle makes neighbours touch and forces the straight
 * fallback. Records fall through to the margined box like C's SH_RECORD
 * branch (no isOrtho special case there).
 *
 * @see lib/neatogen/neatosplines.c:makeObstacle (isOrtho, vs[0..3])
 */
export function makeOrthoObstacle(n: Node, sep: ExpandT): Poly | null {
  const info = n.info;
  const shape = info.shape as { kind?: ShapeKind } | undefined;
  const kind = shape?.kind;
  if (kind !== undefined && kind !== ShapeKind.SH_POLY && kind !== ShapeKind.SH_POINT) {
    return makeObstacle(n, sep); // SH_RECORD etc.: C applies pmargin as usual
  }
  const poly = info.shape_info as { option?: { fixedshape?: boolean }; vertices?: Point[] | null } | undefined;
  let lw: number;
  let rw: number;
  let hh: number;
  let cx = info.coord.x;
  let cy = info.coord.y;
  if (poly?.option?.fixedshape === true && poly.vertices != null) {
    // C: b = polyBB(poly) — the actual shape, not the label-padded size.
    const bb = polyVertexBB(poly.vertices);
    lw = -bb.ll.x;
    rw = bb.ur.x;
    hh = (bb.ur.y - bb.ll.y) / 2;
    cy += (bb.ur.y + bb.ll.y) / 2;
    cx += 0;
  } else {
    const width = info.lw + info.rw;
    const outlineW = (info.outline_width ?? 0) > 0 ? info.outline_width * 72 : width;
    const outlineH = (info.outline_height ?? 0) > 0 ? info.outline_height * 72 : info.ht;
    // C: outline_lw = ND_lw * outline_width / width, box spans ±outline_lw
    // (SYMMETRIC — vs[0].x=-outline_lw, vs[1].x=+outline_lw).
    const outlineLw = width > 0 ? (info.lw * outlineW) / width : outlineW / 2;
    lw = outlineLw;
    rw = outlineLw;
    hh = outlineH / 2;
  }
  const ps = ObstacleHelper.vertices(cx, cy, lw, rw, hh);
  return { ps };
}

// ---------------------------------------------------------------------------
// EdgeHelper — straight-edge and self-arc internals
// ---------------------------------------------------------------------------

class EdgeHelper {
  static endpoint(coord: Point, port: Point): Point {
    return { x: coord.x + port.x, y: coord.y + port.y };
  }

  static selfChain(e: Edge, cnt: number): Edge[] {
    const edges: Edge[] = [];
    let cur: Edge | undefined = e;
    for (let i = 0; i < cnt && cur !== undefined; i++) {
      edges.push(cur);
      cur = cur.info.to_virt;
    }
    return edges;
  }
}

// ---------------------------------------------------------------------------
// makeStraightEdge
// ---------------------------------------------------------------------------

/**
 * Install a straight-line (two-point) spline on an edge.
 *
 * Used when pathplan routing is unavailable or edgetype == EDGETYPE_LINE.
 *
 * @see lib/neatogen/neatosplines.c (straight-line fallback in spline_edges_)
 */
export function makeStraightEdge(e: Edge, sinfo: SplineInfo): void {
  const tp = EdgeHelper.endpoint(e.tail.info.coord, e.info.tail_port.p);
  const hp = EdgeHelper.endpoint(e.head.info.coord, e.info.head_port.p);
  clipAndInstall(e, e.head, [tp, tp, hp, hp], 4, sinfo);
}


/**
 * GD_nodesep for the neato-family routing sites. C parses nodesep
 * engine-neutrally at graph_init (input.c:665-667: POINTS(late_double(g,
 * "nodesep", 0.25, 0.02))); the port only did so in dot's init, so
 * neato/circo/twopi self-loops and straight fans silently used the
 * default 18 regardless of the attr (1949 sets nodesep=0.4 -> 29).
 * Parses on demand and caches in root.info, mirroring C's assignment.
 */
function graphNodesep(g: Graph): number {
  const root = g.root;
  if (root.info.nodesep === undefined) {
    const inches = lateDouble(root.attrs.get('nodesep'), 0.25, 0.02);
    // C POINTS(a) = ROUND(a*72), half away from zero. @see lib/common/geom.h:62
    root.info.nodesep = cround(inches * 72);
  }
  return root.info.nodesep;
}

// ---------------------------------------------------------------------------
// makeSelfArcs
// ---------------------------------------------------------------------------

/**
 * Route self-loop edges via makeSelfEdge, handling single and chained cases.
 * Under concentrate only the representative is routed (C: cnt==1||Concentrate).
 *
 * @see lib/neatogen/neatosplines.c:makeSelfArcs
 */
export function makeSelfArcs(e: Edge, stepx: number): void {
  const cnt = e.info.count ?? 1;
  const concentrate = e.tail.root.info.concentrate ?? false;
  if (cnt <= 1 || concentrate) {
    makeSelfEdge([e], 1, stepx, stepx, SINFO);
    // C: the self-loop LABEL extends the graph bb (updateBB), and head/tail
    // port labels are placed here. @see neatosplines.c:227-229
    if (e.info.label) updateBB(e.tail.root, e.info.label as TextlabelT);
    addEdgeLabels(e); // makePortLabels
    return;
  }
  const edges = EdgeHelper.selfChain(e, cnt);
  makeSelfEdge(edges, edges.length, stepx, stepx, SINFO);
  for (const e0 of edges) {
    if (e0.info.label) updateBB(e0.tail.root, e0.info.label as TextlabelT);
    addEdgeLabels(e0);
  }
}

// ---------------------------------------------------------------------------
// Equivalent-edge coalescing — the C splineEdges wrapper
// ---------------------------------------------------------------------------

/**
 * Equivalence key mirroring equivEdge (neatosplines.c:equivEdge): edges with
 * the same endpoint pair — UNORDERED, so A->B and B->A coalesce — and the same
 * resolved port points belong to one class. C orders (n1,n2) by node pointer
 * (allocation = creation order); node id is the port's stand-in. Self-loops
 * normalize the two port points by x then y.
 */
function equivKey(e: Edge): string {
  const tp = e.info.tail_port?.p ?? { x: 0, y: 0 };
  const hp = e.info.head_port?.p ?? { x: 0, y: 0 };
  const t = e.tail.id;
  const h = e.head.id;
  let n1: number, n2: number, p1: Point, p2: Point;
  if (t < h) {
    n1 = t; p1 = tp; n2 = h; p2 = hp;
  } else if (t > h) {
    n2 = t; p2 = tp; n1 = h; p1 = hp;
  } else {
    if (tp.x < hp.x) { p1 = tp; p2 = hp; }
    else if (tp.x > hp.x) { p1 = hp; p2 = tp; }
    else if (tp.y < hp.y) { p1 = tp; p2 = hp; }
    else if (tp.y > hp.y) { p1 = hp; p2 = tp; }
    else { p1 = p2 = tp; }
    n1 = n2 = t;
  }
  return `${n1}|${p1.x}|${p1.y}|${n2}|${p2.x}|${p2.y}`;
}

/**
 * Coalesce equivalent edges, mirroring the C splineEdges wrapper
 * (neatosplines.c:753-773): the FIRST edge of a class (agfstnode/agfstout
 * order) becomes the leader with ED_count = 1 (set by newitem on dict
 * insert); each later member increments the leader's count, gets count 0,
 * and is prepended to the leader's ED_to_virt chain. The routing loop then
 * skips count==0 members and routes the leader's whole chain (or only the
 * representative under concentrate).
 *
 * @see lib/neatogen/neatosplines.c:splineEdges (find equivalent edges)
 * @see lib/neatogen/neatosplines.c:newitem (ED_count(leader) = 1)
 */
export function coalesceEdges(g: Graph): void {
  const map = new Map<string, Edge>();
  for (const n of nodesInSeq(g)) {
    for (const e of n.outEdges(g)) {
      const key = equivKey(e);
      const leader = map.get(key);
      if (leader === undefined) {
        map.set(key, e);
        e.info.count = 1;
        e.info.to_virt = undefined;
      } else {
        leader.info.count = (leader.info.count ?? 1) + 1;
        e.info.count = 0;
        e.info.to_virt = leader.info.to_virt;
        leader.info.to_virt = e;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// SplineHelper — pathplan routing internals
// ---------------------------------------------------------------------------

class SplineHelper {
  static polylinePoints(pts: Point[]): Point[] {
    if (pts.length === 0) return [];
    const out: Point[] = [pts[0], pts[0]];
    for (let i = 1; i + 1 < pts.length; i++) out.push(pts[i], pts[i], pts[i]);
    out.push(pts[pts.length - 1], pts[pts.length - 1]);
    return out;
  }

  static tryRouteSpline(
    barriers: ReturnType<typeof polyBarriers>,
    route: ReturnType<typeof obsPath>,
  ): Point[] | null {
    const slopes: [Point, Point] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    try {
      const pts = routeSpline(barriers, route, slopes);
      return pts.length >= 4 ? pts : null;
    } catch {
      return null;
    }
  }

  static installPline(e: Edge, route: Point[]): void {
    const pts = SplineHelper.polylinePoints(route);
    clipAndInstall(e, e.head, pts, pts.length, SINFO);
    addEdgeLabels(e); // C makePolyline. @see neatosplines.c:526
  }

  static installSpline(e: Edge, obstacles: Poly[], route: Point[]): void {
    // C makeSpline re-derives the endpoint-containing polys from the PATH
    // endpoints via in_poly (neatosplines.c:554-562) rather than reusing
    // ND_lim: a boundary port point (e.g. a compass port) is NOT strictly
    // inside its node's poly, so that poly stays a BARRIER and Proutespline
    // subdivides the spline around it.
    const p = route[0];
    const q = route[route.length - 1];
    let pp = POLYID_NONE;
    let qp = POLYID_NONE;
    for (let i = 0; i < obstacles.length; i++) {
      if (pp === POLYID_NONE && inPoly(obstacles[i].ps, p)) pp = i;
      if (qp === POLYID_NONE && inPoly(obstacles[i].ps, q)) qp = i;
    }
    const barrierPolys = obstacles.filter((_, i) => i !== pp && i !== qp);
    const splinePts = SplineHelper.tryRouteSpline(polyBarriers(barrierPolys), route);
    if (splinePts === null) { makeStraightEdge(e, SINFO); return; }
    clipAndInstall(e, e.head, splinePts, splinePts.length, SINFO);
    addEdgeLabels(e); // C makeSpline. @see neatosplines.c:585
  }
}

// ---------------------------------------------------------------------------
// makeSplineEdge — single-edge pathplan routing
// ---------------------------------------------------------------------------

/**
 * The pathfinding half of C's two passes: ED_path(e) = getPath(e, vconfig).
 * @see lib/neatogen/neatosplines.c:getPath
 */
export function edgePath(e: Edge, vconfig: VisConfig): Point[] {
  const p = EdgeHelper.endpoint(e.tail.info.coord, e.info.tail_port.p);
  const pp = e.tail.info.lim ?? POLYID_NONE;
  const qp = e.head.info.lim ?? POLYID_NONE;
  const q = EdgeHelper.endpoint(e.head.info.coord, e.info.head_port.p);
  // C: Pobspath(vconfig, p, pp, q, qp, &line) — poly id comes before end-point
  return obsPath(vconfig, p, pp, q, qp);
}

/** @see lib/neatogen/neatosplines.c:makeSpline */
export function makeSplineEdge(
  e: Edge, obstacles: Poly[], vconfig: VisConfig, edgetype: number,
): void {
  const route = edgePath(e, vconfig);
  if (edgetype === EDGETYPE_PLINE) { SplineHelper.installPline(e, route); return; }
  SplineHelper.installSpline(e, obstacles, route);
}

// ---------------------------------------------------------------------------
// OrthoHelper — bridge between Graph model and ortho module
// ---------------------------------------------------------------------------

/** An OrthoEdge carrying the originating model Edge for result installation. */
interface TaggedOrthoEdge extends OrthoEdge {
  _edge: Edge;
}

class OrthoHelper {
  static buildNodes(nodeArr: Node[]): OrthoNodeList {
    return nodeArr.map((n) => ({
      bb: {
        LL: { x: n.info.coord.x - n.info.lw, y: n.info.coord.y - n.info.ht / 2 },
        UR: { x: n.info.coord.x + n.info.rw, y: n.info.coord.y + n.info.ht / 2 },
      },
      // C mkMaze reads ND_coord / ND_xsize (= lw+rw) / ND_ysize (= ht)
      // directly; avoids the bb round-trip ULP loss (see OrthoNode).
      coord: { x: n.info.coord.x, y: n.info.coord.y },
      xsize: n.info.lw + n.info.rw,
      ysize: n.info.ht,
    }));
  }

  static buildEdges(
    g: Graph, nodeArr: Node[], orthoNodes: OrthoNodeList,
  ): TaggedOrthoEdge[] {
    // C orthoEdges collects es[] via agfstnode/agfstout (ortho.c:1220) — the
    // COLLECTION order matters: edgeLen ties keep qsort's permutation of the
    // input, which decides seg_list order and therefore parallel-segment
    // track assignment. Under concentrate, one edge per UNORDERED endpoint
    // pair is routed (ortho.c:1223-1233). Self-loops are NOT filtered — the
    // maze routes them via addLoop.
    const concentrate = g.root.info.concentrate ?? false;
    const seen = new Set<string>();
    const edges: TaggedOrthoEdge[] = [];
    for (const n of nodesInSeq(g)) {
      for (const e of n.outEdges(g)) {
        if (concentrate) {
          const ti = e.tail.id;
          const hi = e.head.id;
          const key = ti <= hi ? `${ti}|${hi}` : `${hi}|${ti}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }
        // C attachOrthoEdges endpoints: p1 = ND_coord(tail) + ED_tail_port.p,
        // q1 = ND_coord(head) + ED_head_port.p (ortho.c:1075-1076). Plumb the
        // port offset so compass/record ports (tailport=s, headport=n, …) exit
        // on the correct node side; without it buildSpline falls back to the bb
        // centre and every ported ortho edge starts/ends at the node centre.
        const tc = e.tail.info.coord;
        const hc = e.head.info.coord;
        const tp = e.info.tail_port.p;
        const hp = e.info.head_port.p;
        edges.push({
          tail: orthoNodes[nodeArr.indexOf(e.tail)],
          head: orthoNodes[nodeArr.indexOf(e.head)],
          tailPoint: { x: tc.x + tp.x, y: tc.y + tp.y },
          headPoint: { x: hc.x + hp.x, y: hc.y + hp.y },
          _edge: e,
        } as TaggedOrthoEdge);
      }
    }
    return edges;
  }

  static buildGraph(g: Graph): OrthoGraph {
    const nodeArr = [...g.nodes.values()];
    const orthoNodes = OrthoHelper.buildNodes(nodeArr);
    return { nodes: orthoNodes, edges: OrthoHelper.buildEdges(g, nodeArr, orthoNodes) };
  }

  static installResult(oe: OrthoEdge, pts: OrthoPoint[]): void {
    const origEdge = (oe as TaggedOrthoEdge)._edge;
    if (!origEdge) return;
    // C attachOrthoEdges installs with ortho.c's OWN sinfo {swap_ends_p,
    // spline_merge, ignoreSwap=true, isOrtho=true} (ortho.c:1269) — its static
    // callbacks return false, identical to neato's. isOrtho selects the
    // segment-truncating ortho clip; the generic bezier clip reparameterizes
    // the control points and diverges from native.
    clipAndInstall(origEdge, origEdge.head, pts, pts.length, ORTHO_SINFO);
  }
}

// ---------------------------------------------------------------------------
// RoutingHelper — splineEdgesImpl internals
// ---------------------------------------------------------------------------

class RoutingHelper {
  static buildObstacles(g: Graph, pmargin: ExpandT, edgetype: number): Poly[] {
    const obstacles: Poly[] = [];
    let idx = 0;
    for (const n of g.nodes.values()) {
      if (edgetype >= EDGETYPE_PLINE) {
        // C: makeObstacle(n, pmargin, edgetype == EDGETYPE_ORTHO) —
        // ortho obstacles are the unmargined outline box. A null obstacle
        // (unsupported shape) leaves the node out (ND_lim = POLYID_NONE).
        const obp = edgetype === EDGETYPE_ORTHO
          ? makeOrthoObstacle(n, pmargin)
          : makeObstacle(n, pmargin);
        if (obp !== null) {
          n.info.lim = idx++;
          obstacles.push(obp);
        } else {
          n.info.lim = POLYID_NONE;
        }
      } else {
        n.info.lim = POLYID_NONE;
      }
    }
    return obstacles;
  }

  static withVconfig(
    g: Graph, obstacles: Poly[], vconfig: VisConfig, edgetype: number,
  ): void {
    const stepx = graphNodesep(g);
    const concentrate = g.root.info.concentrate ?? false;
    let rtr: Router | null = null;
    for (const n of nodesInSeq(g)) {
      for (const e of n.outEdges(g)) {
        // C spline_edges_: ED_count==0 -> continue (only do representative).
        if ((e.info.count ?? 0) === 0) continue;
        if (e.tail === e.head) { makeSelfArcs(e, stepx); continue; }
        // HAVE_GTS branch (neatosplines.c:681): multiplicity or a boundary
        // port routes through the triangle router; a straight 2-point path
        // without ports shortcuts to the perpendicular fan. Only on router
        // FAILURE does the edge fall through to the plain pathplan loop.
        const boundaryPort =
          (e.info.tail_port.side | e.info.head_port.side) !== 0;
        if ((e.info.count ?? 1) > 1 || boundaryPort) {
          let fail = 0;
          const route = edgePath(e, vconfig);
          if (route.length === 2 && !boundaryPort) {
            // if a straight line can connect the ends
            const chain = RoutingHelper.chainList(e);
            makeStraightEdges(g, chain, chain.length, edgetype, SINFO);
          } else {
            if (rtr === null) rtr = mkRouter(obstacles);
            fail = makeMultiSpline(
              g, e, rtr, route, edgetype === EDGETYPE_PLINE);
          }
          if (!fail) continue;
        }
        let cur: Edge | undefined = e;
        let cnt = e.info.count ?? 1;
        if (concentrate) cnt = 1; // only do representative
        for (let i = 0; i < cnt && cur !== undefined; i++) {
          makeSplineEdge(cur, obstacles, vconfig, edgetype);
          cur = cur.info.to_virt;
        }
      }
    }
  }

  /** Full ED_to_virt chain from a leader (C makeStraightEdge's walk). */
  static chainList(e: Edge): Edge[] {
    const list: Edge[] = [e];
    let e0: Edge = e;
    while (e0.info.to_virt !== undefined && e0.info.to_virt !== e0) {
      e0 = e0.info.to_virt;
      list.push(e0);
    }
    return list;
  }

  static straight(g: Graph, et: number): void {
    const stepx = graphNodesep(g);
    for (const n of nodesInSeq(g)) {
      for (const e of n.outEdges(g)) {
        // C spline_edges_: ED_count==0 -> continue (only do representative).
        if ((e.info.count ?? 0) === 0) continue;
        if (e.tail === e.head) { makeSelfArcs(e, stepx); continue; }
        // C makeStraightEdge routes the WHOLE equivalence chain at once —
        // makeStraightEdges fans parallels out perpendicular to the segment
        // and handles the concentrate representative-only case internally.
        // @see lib/common/routespl.c:956 makeStraightEdge
        const chain = RoutingHelper.chainList(e);
        makeStraightEdges(g, chain, chain.length, et, SINFO);
      }
    }
  }

  static ortho(g: Graph, et: number): void {
    const og = OrthoHelper.buildGraph(g);
    orthoEdges(og, false, (_og, oe, pts) => OrthoHelper.installResult(oe, pts));
    // C spline_edges_ drawing loop: vconfig is NEVER built for ortho
    // (neatosplines.c:618 gates Pobsopen on edgetype != ORTHO), so an edge the
    // maze failed to route — attachOrthoEdges skips empty routes — has no
    // ED_spl, fails the `useEdges && ED_spl(e)` test, and falls through to
    // makeSelfArcs / makeStraightEdge with neato's NORMAL sinfo (generic
    // bezier clip). Self-loops are never maze-routed and always land here.
    const stepx = graphNodesep(g);
    for (const n of nodesInSeq(g)) {
      for (const e of n.outEdges(g)) {
        if (e.info.spl != null) {
          // C: `useEdges && ED_spl(e)` — maze-routed edges still get their
          // head/tail port labels. @see neatosplines.c:655
          addEdgeLabels(e);
          continue;
        }
        if ((e.info.count ?? 0) === 0) continue; // only do representative
        if (e.tail === e.head) { makeSelfArcs(e, stepx); continue; }
        const chain = RoutingHelper.chainList(e);
        makeStraightEdges(g, chain, chain.length, et, SINFO);
      }
    }
  }

  static routed(g: Graph, obstacles: Poly[], edgetype: number): void {
    const vconfig = obsOpen(obstacles);
    RoutingHelper.withVconfig(g, obstacles, vconfig, edgetype);
    obsClose(vconfig);
  }
}

// ---------------------------------------------------------------------------
// splineEdgesImpl — inner routing loop
// ---------------------------------------------------------------------------

/** @see lib/neatogen/neatosplines.c:spline_edges_ */
export function splineEdgesImpl(g: Graph, sep: ExpandT, edgetype: number): void {
  const obstacles = RoutingHelper.buildObstacles(g, sep, edgetype);
  // C: legal = Plegal_arrangement(obs, npoly) — sweep-line segment
  // intersection + nesting, NOT a bbox test: circo octagon obstacles
  // routinely overlap in bbox while the polygons are disjoint.
  const legal = legalArrangement(obstacles);
  if (legal && edgetype === EDGETYPE_ORTHO) { RoutingHelper.ortho(g, edgetype); return; }
  if (obstacles.length > 0 && legal) { RoutingHelper.routed(g, obstacles, edgetype); return; }
  RoutingHelper.straight(g, edgetype);
}

// ---------------------------------------------------------------------------
// splineEdges — public entry point
// ---------------------------------------------------------------------------

/**
 * Main spline routing entry point for neato layout.
 *
 * Dispatch:
 * 1. EDGETYPE_NONE  → skip
 * 2. EDGETYPE_LINE  → straight lines for all edges
 * 3. EDGETYPE_ORTHO → orthoEdges (if obstacles legal, else straight)
 * 4. EDGETYPE_SPLINE / EDGETYPE_PLINE → pathplan routing with straight fallback
 *
 * @see lib/neatogen/neatosplines.c:spline_edges0, spline_edges1, splineEdges
 */
export function splineEdges(g: Graph): void {
  const edgetype = g.info.flags & 0xf;
  if (edgetype === EDGETYPE_NONE) return;
  // C graph_init caches Concentrate for every engine (input.c:708-709); the
  // routing gates (spline_edges_, makeSelfArcs, makeStraightEdges) read it.
  g.root.info.concentrate = mapbool(g.root.attrs.get('concentrate'));
  // C splineEdges wrapper: resolve dynamic ports first (neatosplines.c:748) —
  // a record/compass port stays .dyna until fixed against the OTHER endpoint;
  // equivEdge then keys on the resolved port points.
  for (const n of nodesInSeq(g)) {
    for (const e of n.outEdges(g)) {
      if (e.info.tail_port.dyna) e.info.tail_port = resolvePort(e.tail, e.head, e.info.tail_port);
      if (e.info.head_port.dyna) e.info.head_port = resolvePort(e.head, e.tail, e.info.head_port);
    }
  }
  // C splineEdges wrapper: coalesce equivalent edges before routing.
  coalesceEdges(g);
  if (edgetype === EDGETYPE_LINE) { RoutingHelper.straight(g, edgetype); return; }
  // C: margin = esepFactor(g) — the edge separation, default {3.2, 3.2, add}.
  // @see lib/neatogen/neatosplines.c:746
  splineEdgesImpl(g, esepFactor(g), edgetype);
}

// ---------------------------------------------------------------------------
// splineEdgesShifted — the C spline_edges wrapper
// ---------------------------------------------------------------------------

/**
 * Graph bounding box in points derived from node pos (inches) and node
 * sizes, expanded by any existing edge splines. xlabels are not ported
 * (no engine sets them yet).
 * @see lib/common/utils.c:compute_bb
 */
export function computeBBFromPos(g: Graph): { ll: Point; ur: Point } {
  const bb = {
    ll: { x: Infinity, y: Infinity },
    ur: { x: -Infinity, y: -Infinity },
  };
  for (const n of g.nodes.values()) {
    const px = (n.info.pos?.[0] ?? 0) * 72;
    const py = (n.info.pos?.[1] ?? 0) * 72;
    const sx = (n.info.lw + n.info.rw) / 2;
    const sy = n.info.ht / 2;
    bb.ll.x = Math.min(bb.ll.x, px - sx);
    bb.ll.y = Math.min(bb.ll.y, py - sy);
    bb.ur.x = Math.max(bb.ur.x, px + sx);
    bb.ur.y = Math.max(bb.ur.y, py + sy);
  }
  // C compute_bb: an empty graph keeps bb = {0,0,0,0}. @see utils.c:641
  if (!Number.isFinite(bb.ll.x)) {
    return { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } };
  }
  return bb;
}

/**
 * The C spline_edges wrapper: translate pos so the drawing's lower
 * left corner is the origin, shift cluster bbs along, sync coord from
 * pos (neato_set_aspect), then route edges by edge type.
 * @see lib/neatogen/neatosplines.c:spline_edges
 * @see lib/neatogen/neatosplines.c:spline_edges0
 * @see lib/neatogen/neatosplines.c:shiftClusters
 */
/** Shift every node pos (inches) by the given offset. */
function shiftAllPos(g: Graph, ox: number, oy: number): void {
  for (const n of g.nodes.values()) {
    if (!n.info.pos) n.info.pos = [0, 0];
    n.info.pos[0] = (n.info.pos[0] ?? 0) - ox;
    n.info.pos[1] = (n.info.pos[1] ?? 0) - oy;
  }
}

/** Shift all top-level cluster bbs. @see lib/neatogen/neatosplines.c:shiftClusters */
function shiftClusters(g: Graph, dx: number, dy: number): void {
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nClust; c++) {
    const sub = g.info.clust?.[c - 1];
    if (sub) shiftGraphBBs(sub, dx, dy);
  }
}

/**
 * T1 (iterative-parity-campaign, batch-1) injection hook: when
 * `GVTS_POS_INJECT` names a dump file, overwrite `n.info.pos` for every
 * matching node name before this module's own routing runs — mirroring the
 * native `spline_edges` entry point where the session-local POS_DUMP patch
 * captures oracle `ND_pos` (see
 * `plans/iterative-parity-campaign/diagrams/injection-recipe.md`). This lets
 * the attribution harness separate "port routing/emission is wrong" from
 * "the port's own node placement is just a different (but internally
 * consistent) FP-drift outcome" for the iterative engines (D1: pre-routing
 * `ND_pos` stage only).
 *
 * Dump lines look like `GVTS_POS <name> <x> <y>` (any other line, e.g. dot's
 * own stderr warnings mixed into the same capture, is ignored). Reads via
 * `process.getBuiltinModule` rather than a static `node:fs` import so the
 * browser bundle (esbuild, no `--platform=node`) never tries to resolve a
 * Node builtin — this whole function is inert (returns immediately) unless
 * `process` exists and `GVTS_POS_INJECT` is set, which is true only inside
 * the Node test harness, never in a browser render.
 *
 * An optional `GVTS_BB <llx> <lly> <urx> <ury>` line (points) overwrites the
 * graph bb as well. It is emitted only by the *fdp* dump site, and it is
 * load-bearing there: neato/sfdp reach this hook at the top of `spline_edges`,
 * one line ABOVE the `compute_bb` that derives GD_bb — so their bb is a pure
 * function of the injected positions and needs no injection of its own. fdp is
 * the exception: `GD_bb` is a product of `fdpLayout` itself (`finalCC` →
 * `setBB`, layout.c:1030), which has already run and returned by the time the
 * hook fires, so without this line the injected render keeps the port's OWN
 * (drifted) bb while emitting the oracle's node positions — a bb that belongs
 * to neither layout. That mismatch, not any defect in the port's bb code, is
 * what made `graph/bb`+`graph/_draw_` the largest not-cleared fdp bucket (60
 * ids, bb short on 24 and TALL on 18 — a sign-split no bb bug can produce).
 * The bb is layout-stage state exactly like `ND_pos`; neutralizing it is what
 * lets the comparison isolate routing/emission, which is all the harness
 * claims to measure.
 * @see lib/fdpgen/layout.c:1063 fdp_layout
 */
export function injectOraclePositions(g: Graph): void {
  if (typeof process === 'undefined') return;
  const dumpPath = process.env?.['GVTS_POS_INJECT'];
  if (!dumpPath || typeof process.getBuiltinModule !== 'function') return;
  const fs = process.getBuiltinModule('node:fs');
  if (!fs) return;
  const text = fs.readFileSync(dumpPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = /^GVTS_POS (\S+) (\S+) (\S+)/.exec(line);
    if (m) {
      const n = g.nodes.get(m[1]!);
      if (n) n.info.pos = [Number(m[2]), Number(m[3])];
      continue;
    }
    const b = /^GVTS_BB (\S+) (\S+) (\S+) (\S+)/.exec(line);
    if (b) {
      g.info.bb = {
        ll: { x: Number(b[1]), y: Number(b[2]) },
        ur: { x: Number(b[3]), y: Number(b[4]) },
      };
    }
  }
}

export function splineEdgesShifted(g: Graph): void {
  injectOraclePositions(g);
  const bb = computeBBFromPos(g);
  if (typeof process !== 'undefined' && process.env['STRESS_DEBUG']) console.error('shiftBB', JSON.stringify(bb));
  shiftAllPos(g, bb.ll.x / 72, bb.ll.y / 72);
  shiftClusters(g, -bb.ll.x, -bb.ll.y);
  // C spline_edges leaves GD_bb = the shifted node-extent box (LL at origin);
  // _neato_set_aspect reads it for the fill/expand/value factors.
  g.info.bb = {
    ll: { x: 0, y: 0 },
    ur: { x: bb.ur.x - bb.ll.x, y: bb.ur.y - bb.ll.y },
  };
  neatoSetAspect(g); // spline_edges0(g, true): aspect + pos -> coord
  // The bb was seeded above (and scaled by the aspect pass); C never
  // recomputes it here — clip_and_install only EXPANDS it during routing.
  // Recomputing from node extents would clobber the ratio=fill scale
  // (scaleBB sets bb to exactly size; node extents land short of it).
  splineEdges(g);
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export { newSpline };
export type { Poly as NeatoPoly };
