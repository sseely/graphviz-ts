// SPDX-License-Identifier: EPL-2.0
//
// Anchor (<a xlink:href>) resolution + emission guard — the SVG-relevant half
// of lib/common/emit.c's hot-spot machinery. SVG output contains no <area>/map
// elements, so the imagemap half (map_label / map_point / url_map_p) is out of
// scope; only the gvrender_begin_anchor / gvrender_end_anchor `<a>` wraps are
// ported here. A resolver populates job.obj url/tooltip/target/id fields (which
// already exist on ObjState, mirroring obj_state_t); the emit sites read them
// and wrap the object's own graphics.
//
// @see lib/common/emit.c:emit_begin_edge (edge url/tooltip/target resolution)
// @see lib/common/emit.c:initMapData (node/graph/cluster resolution)

import type { Edge } from '../model/edge.js';
import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Point, Box, Spline, Bezier } from '../model/geom.js';
import type { TextlabelT, PolygonT } from '../common/types.js';
import type { GraphObj } from '../common/subst.js';
import { substObjAnchor, interpretCRNL } from '../common/subst.js';
import { parseStyleFlags } from '../common/style-resolve.js';
import { nodeAttr } from '../common/poly-init.js';
import type { RendererPlugin } from './context.js';
import { MapShape, type ObjState, type RenderJob } from './job.js';

/** Non-empty attr value, or undefined. C: `(s = agget(o, k)) && s[0]`. */
function attr(attrs: Map<string, string>, key: string): string | undefined {
  const v = attrs.get(key);
  return v !== undefined && v !== '' ? v : undefined;
}

/** strdup_and_subst_obj: \G \N \E \H \T \L substitution for anchor data. */
function subst(s: string, obj: GraphObj): string {
  return substObjAnchor(s, obj);
}

/**
 * preprocessTooltip + strdup_and_subst_obj: interpret \n\l\r escapes, then
 * object substitution — matching the node tooltip path (poly-gencode.ts).
 * @see lib/common/emit.c:preprocessTooltip
 */
function tip(s: string, obj: GraphObj): string {
  return substObjAnchor(interpretCRNL(s), obj);
}

/** Label text of a textlabel, or null. @see device.ts:labelTextOf */
function textOf(lp: unknown): string | null {
  return (lp as TextlabelT | undefined)?.text ?? null;
}

/** Resolved component value: first non-empty key (transformed), plus whether
 *  any key was present (C's `explicit_*` flag). */
interface Picked { v: string | undefined; explicit: boolean; }

/** First present attr among keys, run through `xform`. C: the agget chains. */
function pickFirst(
  attrs: Map<string, string>,
  keys: string[],
  xform: (s: string) => string,
): Picked {
  for (const k of keys) {
    const s = attr(attrs, k);
    if (s !== undefined) return { v: xform(s), explicit: true };
  }
  return { v: undefined, explicit: false };
}

/** pickFirst with \…-substitution (urls, targets, ids). */
function pickEdge(e: Edge, keys: string[]): Picked {
  return pickFirst(e.attrs, keys, (s) => subst(s, e));
}

/** pickFirst with tooltip preprocessing (interpretCRNL + subst). */
function pickEdgeTip(e: Edge, keys: string[]): Picked {
  return pickFirst(e.attrs, keys, (s) => tip(s, e));
}

/** Apply C's `else if (dflt) … ` fallback: picked value, else dflt, else keep
 *  the field's current value. Keeps the explicit flag from the pick. */
function withFallback(
  p: Picked,
  dflt: string | null | undefined,
  current: string | null,
): { v: string | null; explicit: boolean } {
  return { v: p.v ?? dflt ?? current, explicit: p.explicit };
}

/** Edge labels (2745-2755): label, then tail/head/xlabel default to it. */
function resolveEdgeLabels(e: Edge, obj: ObjState): void {
  obj.label = textOf(e.info.label);
  obj.xlabel = textOf(e.info.xlabel) ?? obj.label;
  obj.tailLabel = textOf(e.info.tail_label) ?? obj.label;
  obj.headLabel = textOf(e.info.head_label) ?? obj.label;
}

/** Edge urls (2762-2784): components fall back to dflt (href/URL). */
function resolveEdgeUrls(e: Edge, obj: ObjState): void {
  const dflt = pickEdge(e, ['href', 'URL']).v;
  obj.url = withFallback(pickEdge(e, ['edgehref', 'edgeURL']), dflt, obj.url).v;
  obj.labelUrl = withFallback(pickEdge(e, ['labelhref', 'labelURL']), dflt, obj.labelUrl).v;
  const tail = withFallback(pickEdge(e, ['tailhref', 'tailURL']), dflt, obj.tailUrl);
  obj.tailUrl = tail.v;
  obj.explicitTailUrl = tail.explicit;
  const head = withFallback(pickEdge(e, ['headhref', 'headURL']), dflt, obj.headUrl);
  obj.headUrl = head.v;
  obj.explicitHeadUrl = head.explicit;
}

/** Edge targets (2787-2808): components fall back to dflt (target). */
function resolveEdgeTargets(e: Edge, obj: ObjState): void {
  const dflt = pickEdge(e, ['target']).v;
  const edge = withFallback(pickEdge(e, ['edgetarget']), dflt, obj.target);
  obj.target = edge.v;
  obj.explicitEdgeTarget = edge.explicit;
  obj.labelTarget = withFallback(pickEdge(e, ['labeltarget']), dflt, obj.labelTarget).v;
  const tail = withFallback(pickEdge(e, ['tailtarget']), dflt, obj.tailTarget);
  obj.tailTarget = tail.v;
  obj.explicitTailTarget = tail.explicit;
  const head = withFallback(pickEdge(e, ['headtarget']), dflt, obj.headTarget);
  obj.headTarget = head.v;
  obj.explicitHeadTarget = head.explicit;
}

/** Edge tooltips (2811-2845): explicit else default to the matching label. */
function resolveEdgeTooltips(e: Edge, obj: ObjState): void {
  const t = withFallback(pickEdgeTip(e, ['tooltip', 'edgetooltip']), obj.label, obj.tooltip);
  obj.tooltip = t.v;
  obj.explicitTooltip = t.explicit;
  const lt = withFallback(pickEdgeTip(e, ['labeltooltip']), obj.label, obj.labelTooltip);
  obj.labelTooltip = lt.v;
  obj.explicitLabelTooltip = lt.explicit;
  const tt = withFallback(pickEdgeTip(e, ['tailtooltip']), obj.tailLabel, obj.tailTooltip);
  obj.tailTooltip = tt.v;
  obj.explicitTailTooltip = tt.explicit;
  const ht = withFallback(pickEdgeTip(e, ['headtooltip']), obj.headLabel, obj.headTooltip);
  obj.headTooltip = ht.v;
  obj.explicitHeadTooltip = ht.explicit;
}

/**
 * Resolve an edge's anchor fields into job.obj, mirroring emit_begin_edge.
 * The whole-edge anchor (svg endEdge) and the per-label sub-anchors
 * (renderEdgeLabels) read these. map_* fields are not populated (SVG has no
 * maps).
 * @see lib/common/emit.c:emit_begin_edge (2706-2845)
 */
export function resolveEdgeAnchor(e: Edge, id: string, obj: ObjState): void {
  resolveEdgeLabels(e, obj);
  resolveEdgeUrls(e, obj);
  resolveEdgeTargets(e, obj);
  resolveEdgeTooltips(e, obj);
  obj.id = subst(id, e);
}

/**
 * Resolve a graph or cluster's anchor fields into job.obj: url from href/URL,
 * tooltip from tooltip else default to the object's label, target, id.
 * @see lib/common/emit.c:initMapData (163-200)
 */
export function resolveObjAnchor(
  g: Graph,
  label: string | null,
  id: string,
  obj: ObjState,
): void {
  obj.label = label;
  // C resolves cluster/graph anchor attrs with agget (graph-attr dict walk):
  // a root-level `graph [tooltip=" "]` reaches every cluster (corpus 1880's
  // tooltip-only cluster anchors). Mirror device-cluster.ts:clusterAttr.
  const ga = (key: string): string | undefined => {
    for (let s: Graph | null = g; s !== null; s = s.parent) {
      const v = attr(s.attrs, key);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  const url = ga('href') ?? ga('URL');
  if (url !== undefined) obj.url = subst(url, g);
  const tt = ga('tooltip');
  if (tt !== undefined) { obj.tooltip = tip(tt, g); obj.explicitTooltip = true; }
  else if (label !== null) obj.tooltip = label;
  const tgt = ga('target');
  if (tgt !== undefined) obj.target = subst(tgt, g);
  obj.id = subst(id, g);
}

/**
 * Open an anchor with explicit fields, coalescing nullable url/tooltip/target
 * to ''. The id is passed through (callers build label-specific ids).
 * @see lib/common/emit.c → gvrender_begin_anchor
 */
export function openAnchorWith(
  renderer: RendererPlugin,
  job: RenderJob,
  url: string | null,
  tooltip: string | null,
  target: string | null,
  id: string,
): void {
  renderer.beginAnchor?.(url ?? '', tooltip ?? '', target ?? '', id, job);
}

/**
 * Open the whole-object anchor when there is a url or an explicit tooltip,
 * mirroring `if (obj->url || obj->explicit_tooltip)`. Returns true when the
 * caller must close it with renderer.endAnchor after the object's own graphics.
 * @see lib/common/emit.c:2877 (edge), 3653 (graph), 3803 (cluster)
 */
export function beginAnchorIf(renderer: RendererPlugin, job: RenderJob): boolean {
  const obj = job.obj;
  if (obj === null || (obj.url === null && !obj.explicitTooltip)) return false;
  openAnchorWith(renderer, job, obj.url, obj.tooltip, obj.target, obj.id ?? '');
  return true;
}

// ===========================================================================
// Imagemap hot-spot geometry — the `url_map_p` computation half of emit.c's
// hot-spot machinery (the imagemap counterpart of the `<a>` resolution above).
// Populates obj.urlMapShape / obj.urlMapPts in the imagemap device frame
// (Y_GOES_DOWN, scaled by the map dpi). These functions are called ONLY by the
// imagemap renderers (src/render/map.ts); the SVG path never invokes them, so
// SVG anchor output is unaffected.
// @see lib/common/emit.c:emit_begin_node (node url_map_p)
// @see lib/common/emit.c:emit_page / emit_clusters (graph & cluster rects)
// @see lib/common/emit.c:map_label / emit_map_rect / map_output_bspline
// ===========================================================================

/** DFLT_SAMPLE: default polygon sample count. @see lib/common/const.h:105 */
const DFLT_SAMPLE = 20;
/** HW: maximum distance from line, in points. @see lib/common/emit.c:739 */
const MAP_HW = 2.0;
/** SMALL: 0/0 guard in ptToLine2. @see lib/common/geom.c:176 */
const MAP_SMALL = 0.0000000001;

/**
 * Coordinate-transform context for the imagemap device. `bb` is the unpadded
 * graph bounding box (GD_bb), `pad` the graph padding, `scale` the device
 * scale (`zoom * dpi / 72`). The imagemap device is GVRENDER_Y_GOES_DOWN with
 * no GVRENDER_DOES_TRANSFORM, so emit.c runs every map point through
 * gvrender_ptf.
 */
export interface MapCtx { bb: Box; pad: Point; scale: number; marginOff: Point; mapPolygon: boolean; }

/**
 * gvrender_ptf for the imagemap device (single page, no rotation): the clip box
 * is the padded drawing, so translation.x = -(bb.ll.x - pad.x) and
 * translation.y = -(bb.ur.y + pad.y); devscale.y is negated for Y_GOES_DOWN.
 * setup_page also folds `canvasBox.LL / zoom` (the graph `margin=`) into the
 * translation, which after the `* scale` becomes `margin * dpi/72` in device
 * units (`marginOff`) — matching svgBeginPage's `+ margin / z` term.
 * @see lib/gvc/gvrender.c:gvrender_ptf ; lib/common/emit.c:setup_page (1566-1581)
 */
export function mapTransform(p: Point, ctx: MapCtx): Point {
  return {
    x: (p.x + ctx.pad.x - ctx.bb.ll.x) * ctx.scale + ctx.marginOff.x,
    y: (ctx.bb.ur.y + ctx.pad.y - p.y) * ctx.scale + ctx.marginOff.y,
  };
}

/** isFilled: node style contains "filled". @see lib/common/emit.c:705 */
function nodeIsFilled(n: Node): boolean {
  return parseStyleFlags(nodeAttr(n, n.root, 'style')).filled;
}

/** Non-empty node attr (with root-default inheritance). */
function nodeAttrSet(n: Node, key: string): boolean {
  const v = nodeAttr(n, n.root, key);
  return v !== undefined && v !== '';
}

/** A node has a hot spot when it carries href/URL/tooltip — the gate
 * emit_begin_node applies before computing url_map_p (`obj->url ||
 * obj->explicit_tooltip`). Skipping unanchored nodes avoids O(N) map work.
 * @see lib/common/emit.c:emit_begin_node (1666) */
function nodeHasHotspot(n: Node): boolean {
  return nodeAttrSet(n, 'href') || nodeAttrSet(n, 'URL') || nodeAttrSet(n, 'tooltip');
}

/** isRect: right-angle rectangle (not skewed/distorted). @see emit.c:isRect */
function isRectPoly(p: PolygonT): boolean {
  return p.sides === 4 && Math.abs(p.orientation % 90) < 0.5
    && p.distortion === 0 && p.skew === 0;
}

/** samplepoints attr, clamped to [4,60] else DFLT_SAMPLE. @see emit.c:1699-1704 */
function samplePoints(n: Node): number {
  const s = n.attrs.get('samplepoints');
  if (s === undefined) return DFLT_SAMPLE;
  const v = parseInt(s, 10);
  return Number.isNaN(v) || v < 4 || v > 60 ? DFLT_SAMPLE : v;
}

/** pEllipse: `np` points around an ellipse of half-axes (a,b). @see emit.c:726 */
function pEllipse(a: number, b: number, np: number): Point[] {
  const del = (2 * Math.PI) / np;
  const ps: Point[] = [];
  let theta = 0;
  for (let i = 0; i < np; i++) {
    ps.push({ x: a * Math.cos(theta), y: b * Math.sin(theta) });
    theta += del;
  }
  return ps;
}

interface NodeMap { shape: MapShape; pts: Point[]; }

/** Ellipse/circle branch of emit_begin_node. @see emit.c:1718-1739 */
function ellipseNodeMap(poly: PolygonT, coord: Point, ur: Point, nump: number): NodeMap {
  if (poly.regular) {
    // circle: center + UR bb corner. @see emit.c:1718-1727
    return { shape: MapShape.Circle, pts: [coord, { x: coord.x + ur.x, y: coord.y + ur.y }] };
  }
  // ellipse treated as polygon. @see emit.c:1729-1737
  const pts = pEllipse(ur.x, ur.y, nump).map((p) => ({ x: p.x + coord.x, y: p.y + coord.y }));
  return { shape: MapShape.Polygon, pts };
}

/** General-polygon branch (n-gon / sampled distorted ellipse). @see emit.c:1740-1762 */
function generalNodeMap(
  poly: PolygonT, coord: Point, vertices: Point[], peripheries: number, nump: number,
): NodeMap {
  const offset = (peripheries - 1) * poly.sides;
  const pts: Point[] = [];
  if (poly.sides >= nump) {
    const delta = Math.trunc(poly.sides / nump);
    for (let i = 0, j = 0; j < nump; i += delta, j++) {
      const v = vertices[i + offset]!;
      pts.push({ x: coord.x + v.x, y: coord.y + v.y });
    }
  } else {
    for (let i = 0; i < poly.sides; i++) {
      const v = vertices[i + offset]!;
      pts.push({ x: coord.x + v.x, y: coord.y + v.y });
    }
  }
  return { shape: MapShape.Polygon, pts };
}

/** Polygon-shape node map (peripheries!=0-or-filled). @see emit.c:1691-1763 */
function nodePolyMap(n: Node, poly: PolygonT, coord: Point, filled: boolean): NodeMap {
  const peripheries = poly.peripheries < 2 ? 1 : poly.peripheries;
  const vertices = poly.vertices!;
  const nump = samplePoints(n);
  const info = n.info;
  if (poly.peripheries === 0 && !filled) {
    // no periphery + unfilled → text/image bbox rectangle. @see emit.c:1706-1711
    return { shape: MapShape.Rectangle, pts: [
      { x: coord.x - info.lw, y: coord.y - info.ht / 2 },
      { x: coord.x + info.lw, y: coord.y + info.ht / 2 },
    ] };
  }
  if (poly.sides < 3 && poly.skew === 0 && poly.distortion === 0) {
    return ellipseNodeMap(poly, coord, vertices[2 * peripheries - 1]!, nump);
  }
  return generalNodeMap(poly, coord, vertices, peripheries, nump);
}

/**
 * Populate obj.urlMapShape / obj.urlMapPts for a node, mirroring the shape
 * dispatch in emit_begin_node: a regular-rectangle / non-polygon node maps to
 * its bounding-box rectangle (lw/rw, ht/2); every other polygon maps to a
 * circle, sampled ellipse, or n-gon.
 * @see lib/common/emit.c:emit_begin_node (1665-1778)
 */
export function computeNodeUrlMap(n: Node, obj: ObjState, ctx: MapCtx): void {
  if (!nodeHasHotspot(n)) return;
  const info = n.info;
  const coord = info.coord;
  const poly = info.shape_info as PolygonT | undefined;
  const filled = nodeIsFilled(n);
  const isRect = poly !== undefined && isRectPoly(poly) && (poly.peripheries !== 0 || filled);
  let m: NodeMap;
  // The polygon branch requires the device's GVRENDER_DOES_MAP_POLYGON; the
  // no-polygon (`_np`) devices fall through to the bounding-box rectangle.
  // @see lib/common/emit.c:1691 (flags & GVRENDER_DOES_MAP_POLYGON)
  if (poly !== undefined && poly.vertices != null && !isRect && ctx.mapPolygon) {
    m = nodePolyMap(n, poly, coord, filled);
  } else {
    // rectangle from node bbox: coord - lw .. coord + rw. @see emit.c:1765-1772
    m = { shape: MapShape.Rectangle, pts: [
      { x: coord.x - info.lw, y: coord.y - info.ht / 2 },
      { x: coord.x + info.rw, y: coord.y + info.ht / 2 },
    ] };
  }
  obj.urlMapShape = m.shape;
  obj.urlMapPts = m.pts.map((p) => mapTransform(p, ctx));
}

/**
 * Graph-level (root) hot spot: the padded drawing rectangle (pageBox), matching
 * emit_page's map computation for GVRENDER_DOES_MAP_RECTANGLE devices.
 * @see lib/common/emit.c:emit_page (3623-3642)
 */
export function computeGraphUrlMap(obj: ObjState, ctx: MapCtx): void {
  const ll = { x: ctx.bb.ll.x - ctx.pad.x, y: ctx.bb.ll.y - ctx.pad.y };
  const ur = { x: ctx.bb.ur.x + ctx.pad.x, y: ctx.bb.ur.y + ctx.pad.y };
  obj.urlMapShape = MapShape.Rectangle;
  obj.urlMapPts = [mapTransform(ll, ctx), mapTransform(ur, ctx)];
}

/** Cluster hot spot: GD_bb(sg) rectangle. @see emit.c:emit_clusters (emit_map_rect) */
export function computeClusterUrlMap(bb: Box, obj: ObjState, ctx: MapCtx): void {
  obj.urlMapShape = MapShape.Rectangle;
  obj.urlMapPts = [mapTransform(bb.ll, ctx), mapTransform(bb.ur, ctx)];
}

/**
 * Label hot spot: the P2RECT box around a placed label (pos ± dimen/2).
 * @see lib/common/emit.c:map_label (666-689)
 */
export function computeLabelRectMap(lab: TextlabelT, obj: ObjState, ctx: MapCtx): void {
  const dx = lab.dimen.x / 2;
  const dy = lab.dimen.y / 2;
  obj.urlMapShape = MapShape.Rectangle;
  obj.urlMapPts = [
    mapTransform({ x: lab.pos.x - dx, y: lab.pos.y - dy }, ctx),
    mapTransform({ x: lab.pos.x + dx, y: lab.pos.y + dy }, ctx),
  ];
}

// --- Edge spline hot spots (map_output_bspline) --------------------------

/** ptToLine2: squared distance from p to segment (a,b). @see lib/common/geom.c */
function ptToLine2(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let a2 = (p.y - a.y) * dx - (p.x - a.x) * dy;
  a2 *= a2;
  if (a2 < MAP_SMALL) return 0;
  return a2 / (dx * dx + dy * dy);
}

/** check_control_points: both handles within HW of the chord. @see emit.c */
function checkControlPoints(cp: Point[]): boolean {
  return ptToLine2(cp[0]!, cp[3]!, cp[1]!) < MAP_HW * MAP_HW
    && ptToLine2(cp[0]!, cp[3]!, cp[2]!) < MAP_HW * MAP_HW;
}

/** de Casteljau split of a cubic at t=0.5, returning left & right control sets.
 * @see lib/common/utils.c:Bezier */
function bezierHalf(v: Point[]): { left: Point[]; right: Point[] } {
  const t = 0.5;
  const vt: Point[][] = [v.slice(0, 4)];
  for (let i = 1; i <= 3; i++) {
    vt[i] = [];
    for (let j = 0; j <= 3 - i; j++) {
      const a = vt[i - 1]![j]!;
      const b = vt[i - 1]![j + 1]!;
      vt[i]![j] = { x: (1 - t) * a.x + t * b.x, y: (1 - t) * a.y + t * b.y };
    }
  }
  return {
    left: [vt[0]![0]!, vt[1]![0]!, vt[2]![0]!, vt[3]![0]!],
    right: [vt[3]![0]!, vt[2]![1]!, vt[1]![2]!, vt[0]![3]!],
  };
}

/** approx_bezier: flatten a cubic to a polyline. @see lib/common/emit.c */
function approxBezier(cp: Point[], out: Point[]): void {
  if (checkControlPoints(cp)) {
    if (out.length === 0) out.push(cp[0]!);
    out.push(cp[3]!);
  } else {
    const { left, right } = bezierHalf(cp);
    approxBezier(left, out);
    approxBezier(right, out);
  }
}

/** mkSegPts: the two offset points perpendicular to the polyline at `cur`.
 * @see lib/common/emit.c:mkSegPts */
function mkSegPts(prv: Point | null, cur: Point, nxt: Point | null, w2: number): { p1: Point; p2: Point } {
  let pp: Point;
  let np: Point;
  if (prv) {
    pp = prv;
    np = nxt ?? { x: 2 * (cur.x - pp.x), y: 2 * (cur.y - pp.y) };
  } else {
    np = nxt!;
    pp = { x: 2 * (cur.x - np.x), y: 2 * (cur.y - np.y) };
  }
  const theta = Math.atan2(np.y - cur.y, np.x - cur.x);
  const phi = Math.atan2(pp.y - cur.y, pp.x - cur.x);
  let ang = theta - phi;
  if (ang > 0) ang -= 2 * Math.PI;
  const bis = phi + ang / 2;
  const del = { x: w2 * Math.cos(bis), y: w2 * Math.sin(bis) };
  return { p1: { x: cur.x + del.x, y: cur.y + del.y }, p2: { x: cur.x - del.x, y: cur.y - del.y } };
}

/** Build thick-outline polygons around one bezier's flattened polyline.
 * @see lib/common/emit.c:map_output_bspline / map_bspline_poly */
function mapOutputBspline(bp: Bezier, w2: number, polys: Point[][]): void {
  const nc = Math.trunc((bp.size - 1) / 3);
  const segs: Point[] = [];
  for (let j = 0; j < nc; j++) {
    approxBezier([bp.list[3 * j]!, bp.list[3 * j + 1]!, bp.list[3 * j + 2]!, bp.list[3 * j + 3]!], segs);
  }
  const pt1: Point[] = [];
  const pt2: Point[] = [];
  let cnt = 0;
  for (let i = 0; i < segs.length; i++) {
    const prev = i === 0 ? null : segs[i - 1]!;
    const next = i + 1 < segs.length ? segs[i + 1]! : null;
    const seg = mkSegPts(prev, segs[i]!, next, w2);
    pt1[cnt] = seg.p1;
    pt2[cnt] = seg.p2;
    cnt++;
    if (i + 1 === segs.length || cnt === 50) {
      const poly: Point[] = [];
      for (let k = 0; k < cnt; k++) poly.push(pt1[k]!);
      for (let k = 0; k < cnt; k++) poly.push(pt2[cnt - 1 - k]!);
      polys.push(poly);
      pt1[0] = pt1[cnt - 1]!;
      pt2[0] = pt2[cnt - 1]!;
      cnt = 1;
    }
  }
}

/**
 * Whole-edge spline hot spots: one (or more) MAP_POLYGON outlines around the
 * edge's Bézier pieces, in device coordinates.
 * @see lib/common/emit.c:emit_begin_edge (2851-2872) / emit_end_edge (2969-2985)
 */
export function computeEdgeSplineMaps(spl: Spline, w2: number, ctx: MapCtx): Point[][] {
  const polys: Point[][] = [];
  for (const bz of spl.list) mapOutputBspline(bz, w2, polys);
  return polys.map((poly) => poly.map((p) => mapTransform(p, ctx)));
}
