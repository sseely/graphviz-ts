// SPDX-License-Identifier: EPL-2.0

/**
 * Shared helpers for edge spline routing: node-box construction,
 * penwidth reading, spline record installation, and straight-edge routing.
 *
 * Extracted to allow edge-route-chain.ts to import these without
 * creating a circular dependency through the top-level edge-route.ts.
 *
 * @see lib/dotgen/dotsplines.c
 * @see lib/common/splines.c:clip_and_install
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge as GraphEdge } from '../../model/edge.js';
import { nodeAttr } from '../../common/poly-init.js';
import type { Point, Bezier, Spline } from '../../model/geom.js';
import { routeSpline } from '../../pathplan/route.js';
import type { Edge as BarrierEdge } from '../../pathplan/types.js';
import { linearBezier } from './edge-route-poly.js';
import { DEFAULT_NODEPENWIDTH } from './edge-route-clip.js';
import type { NodeBox } from './edge-route-geom.js';
import { routeWithRank, routeSimple } from './edge-route-routing.js';
import type { RankEdgeInfo, EdgeSplineResult, PortRoute } from './edge-route-routing.js';

/**
 * Default `dir` for an edge given the graph's directedness. C uses
 * `agisdirected(g) ? "forward" : "none"` — an undirected graph draws no
 * arrowheads. Without this, undirected edges wrongly get a head arrow and an
 * arrow-clipped (short) spline.
 *
 * @see lib/common/arrows.c:arrow_flags (late_string E_dir default)
 */
export function defaultEdgeDir(g: Graph): string {
  return g.kind === 'directed' || g.kind === 'strict-directed' ? 'forward' : 'none';
}

// ---------------------------------------------------------------------------
// nodeBoxOf
// ---------------------------------------------------------------------------

/** Ellipse shape names (use ellipse clip). @see lib/common/shapes.c:poly_inside */
const ELLIPSE_SHAPES = new Set([
  'ellipse', 'oval', 'circle', 'egg', 'doublecircle', 'Mcircle', 'point',
]);

function recordClipBox(n: Node): { lw: number; rw: number; ht: number } | undefined {
  const f = n.info.shape_info as { b?: { ll: Point; ur: Point } } | undefined;
  if (!f?.b) return undefined;
  const halfW = (f.b.ur.x - f.b.ll.x) / 2;
  return { lw: halfW, rw: halfW, ht: f.b.ur.y - f.b.ll.y };
}

/** Node pen width (default 1.0), threaded into the clip boundary. */
function nodePenwidthOf(n: Node, g: Graph): number {
  const v = nodeAttr(n, g, 'penwidth');
  const pw = v !== undefined ? parseFloat(v) : NaN;
  return Number.isFinite(pw) && pw >= 0 ? pw : DEFAULT_NODEPENWIDTH;
}

/** Returns a NodeBox with defaulted lw/rw/ht for a node. */
export function nodeBoxOf(n: Node, g: Graph): NodeBox {
  const shapeName = nodeAttr(n, g, 'shape') ?? 'ellipse';
  const penwidth = nodePenwidthOf(n, g);
  if (shapeName === 'record' || shapeName === 'Mrecord') {
    const rb = recordClipBox(n);
    if (rb) return { center: n.info.coord, ...rb, isEllipse: false, penwidth };
  }
  return {
    center: n.info.coord,
    lw: n.info.lw > 0 ? n.info.lw : 27,
    rw: n.info.rw > 0 ? n.info.rw : 27,
    ht: n.info.ht > 0 ? n.info.ht : 36,
    isEllipse: ELLIPSE_SHAPES.has(shapeName),
    penwidth,
  };
}

// ---------------------------------------------------------------------------
// Penwidth helpers
// ---------------------------------------------------------------------------

/** Effective stroke width for arrowhead polygon sizing. */
export function edgeRenderPenwidth(e: GraphEdge): number {
  const style = e.attrs.get('style') ?? '';
  if (style === 'bold') return 2.0;
  const pw = parseFloat(e.attrs.get('penwidth') ?? '');
  return isNaN(pw) ? 1.0 : pw;
}

/** Penwidth for arrow-length (elen) computation (attribute only). */
export function edgePenwidthAttr(e: GraphEdge): number {
  const pw = parseFloat(e.attrs.get('penwidth') ?? '');
  return isNaN(pw) ? 1.0 : pw;
}

// ---------------------------------------------------------------------------
// Spline record builders
// @see lib/common/splines.c:clip_and_install, new_spline
// ---------------------------------------------------------------------------

/** Build a Bezier record for a single cubic segment. */
export function makeBezierRecord(bezierPts: Point[], arrowTip: Point): Bezier {
  return {
    list: bezierPts, size: bezierPts.length,
    sflag: 0, eflag: 1,
    sp: bezierPts[0] ?? { x: 0, y: 0 }, ep: arrowTip,
  };
}

/** Build a zero-bb Spline wrapping a single Bezier record. */
export function makeSplineRecord(bz: Bezier): Spline {
  return { list: [bz], size: 1, bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } } };
}

/** Create and install a Spline on the edge. @see lib/common/splines.c:clip_and_install */
export function installEdgeSpline(e: GraphEdge, bezierPts: Point[], arrowTip: Point): void {
  e.info.spl = makeSplineRecord(makeBezierRecord(bezierPts, arrowTip));
}

// ---------------------------------------------------------------------------
// routeBezier / straightEdgeSplineWithRank
// ---------------------------------------------------------------------------

function isUsableSpline(raw: Point[]): boolean {
  if (raw.length < 4) return false;
  const p0 = raw[0] as Point;
  const p1 = raw[1] as Point;
  return p0.x !== p1.x || p0.y !== p1.y;
}

/** Route via pathplan, falling back to linear if the result is degenerate. */
export function routeBezier(from: Point, to: Point): Point[] {
  const noBarriers: BarrierEdge[] = [];
  const zero: Point = { x: 0, y: 0 };
  const raw = routeSpline(noBarriers, [from, to], [zero, zero]);
  if (!isUsableSpline(raw)) return linearBezier(from, to);
  return [raw[0] as Point, raw[1] as Point, raw[2] as Point, raw[3] as Point];
}

/** Compute Bezier for a straight edge, with optional rank-corridor geometry. */
export function straightEdgeSplineWithRank(
  tailBox: NodeBox,
  headBox: NodeBox,
  rankInfo: RankEdgeInfo | undefined,
  penwidth = 1.0,
  port?: PortRoute,
): EdgeSplineResult {
  return rankInfo !== undefined
    ? routeWithRank(tailBox, headBox, rankInfo, penwidth, port)
    : routeSimple(tailBox, headBox, routeBezier);
}
