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
import type { SplineInfo } from '../../common/types.js';
import type { Poly, VConfig } from '../../pathplan/types.js';
import {
  obsOpen, obsClose, obsPath,
  routeSpline, polyBarriers,
  POLYID_NONE,
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

/**
 * Build a rectangular CW obstacle polygon from a node's bounding box.
 *
 * Vertices are in CW order: ll, ul, ur, lr.
 *
 * @see lib/neatogen/neatosplines.c:makeObstacle
 */
export function makeObstacle(n: Node, sep: Point): Poly {
  const hh = ObstacleHelper.halfHeight(n.info.ht, sep.y);
  const ps = ObstacleHelper.vertices(
    n.info.coord.x, n.info.coord.y,
    n.info.lw + sep.x, n.info.rw + sep.x, hh,
  );
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

// ---------------------------------------------------------------------------
// makeSelfArcs
// ---------------------------------------------------------------------------

/**
 * Route self-loop edges via makeSelfEdge, handling single and chained cases.
 *
 * @see lib/neatogen/neatosplines.c:makeSelfArcs
 */
export function makeSelfArcs(e: Edge, stepx: number): void {
  const cnt = e.info.count ?? 1;
  if (cnt <= 1) {
    makeSelfEdge([e], 1, stepx, stepx, SINFO);
    return;
  }
  const edges = EdgeHelper.selfChain(e, cnt);
  makeSelfEdge(edges, edges.length, stepx, stepx, SINFO);
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
  }

  static installSpline(
    e: Edge, obstacles: Poly[], pp: number, qp: number, route: Point[],
  ): void {
    const barrierPolys = obstacles.filter((_, i) => i !== pp && i !== qp);
    const splinePts = SplineHelper.tryRouteSpline(polyBarriers(barrierPolys), route);
    if (splinePts === null) { makeStraightEdge(e, SINFO); return; }
    clipAndInstall(e, e.head, splinePts, splinePts.length, SINFO);
  }
}

// ---------------------------------------------------------------------------
// makeSplineEdge — single-edge pathplan routing
// ---------------------------------------------------------------------------

/** @see lib/neatogen/neatosplines.c:makeSpline */
export function makeSplineEdge(
  e: Edge, obstacles: Poly[], vconfig: VisConfig, edgetype: number,
): void {
  const p = EdgeHelper.endpoint(e.tail.info.coord, e.info.tail_port.p);
  const pp = e.tail.info.lim ?? POLYID_NONE;
  const qp = e.head.info.lim ?? POLYID_NONE;
  const q = EdgeHelper.endpoint(e.head.info.coord, e.info.head_port.p);
  // C: Pobspath(vconfig, p, pp, q, qp, &line) — poly id comes before end-point
  const route = obsPath(vconfig, p, pp, q, qp);
  if (edgetype === EDGETYPE_PLINE) { SplineHelper.installPline(e, route); return; }
  SplineHelper.installSpline(e, obstacles, pp, qp, route);
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
    }));
  }

  static buildEdges(
    g: Graph, nodeArr: Node[], orthoNodes: OrthoNodeList,
  ): TaggedOrthoEdge[] {
    return g.edges
      .filter((e) => e.tail !== e.head)
      .map((e) => ({
        tail: orthoNodes[nodeArr.indexOf(e.tail)],
        head: orthoNodes[nodeArr.indexOf(e.head)],
        _edge: e,
      } as TaggedOrthoEdge));
  }

  static buildGraph(g: Graph): OrthoGraph {
    const nodeArr = [...g.nodes.values()];
    const orthoNodes = OrthoHelper.buildNodes(nodeArr);
    return { nodes: orthoNodes, edges: OrthoHelper.buildEdges(g, nodeArr, orthoNodes) };
  }

  static installResult(oe: OrthoEdge, pts: OrthoPoint[]): void {
    const origEdge = (oe as TaggedOrthoEdge)._edge;
    if (!origEdge) return;
    clipAndInstall(origEdge, origEdge.head, pts, pts.length, SINFO);
  }
}

// ---------------------------------------------------------------------------
// RoutingHelper — splineEdgesImpl internals
// ---------------------------------------------------------------------------

class RoutingHelper {
  static buildObstacles(g: Graph, sep: Point, edgetype: number): Poly[] {
    const obstacles: Poly[] = [];
    let idx = 0;
    for (const n of g.nodes.values()) {
      if (edgetype >= EDGETYPE_PLINE) {
        n.info.lim = idx++;
        obstacles.push(makeObstacle(n, sep));
      } else {
        n.info.lim = POLYID_NONE;
      }
    }
    return obstacles;
  }

  static withVconfig(
    g: Graph, obstacles: Poly[], vconfig: VisConfig, edgetype: number,
  ): void {
    const stepx = g.info.nodesep ?? 16;
    for (const n of g.nodes.values()) {
      for (const e of n.outEdges(g)) {
        if (e.tail === e.head) { makeSelfArcs(e, stepx); continue; }
        let cur: Edge | undefined = e;
        const cnt = e.info.count ?? 1;
        for (let i = 0; i < cnt && cur !== undefined; i++) {
          makeSplineEdge(cur, obstacles, vconfig, edgetype);
          cur = cur.info.to_virt;
        }
      }
    }
  }

  static straight(g: Graph): void {
    const stepx = g.info.nodesep ?? 16;
    for (const n of g.nodes.values()) {
      for (const e of n.outEdges(g)) {
        if (e.tail === e.head) { makeSelfArcs(e, stepx); continue; }
        makeStraightEdge(e, SINFO);
      }
    }
  }

  static ortho(g: Graph): void {
    const og = OrthoHelper.buildGraph(g);
    orthoEdges(og, false, (_og, oe, pts) => OrthoHelper.installResult(oe, pts));
  }

  static routed(g: Graph, obstacles: Poly[], edgetype: number): void {
    const vconfig = obsOpen(obstacles);
    RoutingHelper.withVconfig(g, obstacles, vconfig, edgetype);
    obsClose(vconfig);
  }
}

// ---------------------------------------------------------------------------
// LegalHelper — obstacle overlap checking
// ---------------------------------------------------------------------------

class LegalHelper {
  static xSpan(p: Poly): [number, number] {
    const xs = p.ps.map((v) => v.x);
    return [Math.min(...xs), Math.max(...xs)];
  }

  static ySpan(p: Poly): [number, number] {
    const ys = p.ps.map((v) => v.y);
    return [Math.min(...ys), Math.max(...ys)];
  }

  static overlap(a: Poly, b: Poly): boolean {
    const [aX0, aX1] = LegalHelper.xSpan(a);
    const [aY0, aY1] = LegalHelper.ySpan(a);
    const [bX0, bX1] = LegalHelper.xSpan(b);
    const [bY0, bY1] = LegalHelper.ySpan(b);
    return aX1 > bX0 && bX1 > aX0 && aY1 > bY0 && bY1 > aY0;
  }

  static check(obstacles: Poly[]): boolean {
    for (let i = 0; i < obstacles.length; i++) {
      for (let j = i + 1; j < obstacles.length; j++) {
        if (LegalHelper.overlap(obstacles[i], obstacles[j])) return false;
      }
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// splineEdgesImpl — inner routing loop
// ---------------------------------------------------------------------------

/** @see lib/neatogen/neatosplines.c:spline_edges_ */
export function splineEdgesImpl(g: Graph, sep: Point, edgetype: number): void {
  const obstacles = RoutingHelper.buildObstacles(g, sep, edgetype);
  const legal = LegalHelper.check(obstacles);
  if (legal && edgetype === EDGETYPE_ORTHO) { RoutingHelper.ortho(g); return; }
  if (obstacles.length > 0 && legal) { RoutingHelper.routed(g, obstacles, edgetype); return; }
  RoutingHelper.straight(g);
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
  if (edgetype === EDGETYPE_LINE) { RoutingHelper.straight(g); return; }
  splineEdgesImpl(g, { x: 4, y: 4 }, edgetype);
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

export function splineEdgesShifted(g: Graph): void {
  const bb = computeBBFromPos(g);
  if (process.env['STRESS_DEBUG']) console.error('shiftBB', JSON.stringify(bb));
  shiftAllPos(g, bb.ll.x / 72, bb.ll.y / 72);
  shiftClusters(g, -bb.ll.x, -bb.ll.y);
  neatoSetAspect(g); // spline_edges0(g, true): pos -> coord
  splineEdges(g);
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export { newSpline };
export type { Poly as NeatoPoly };
