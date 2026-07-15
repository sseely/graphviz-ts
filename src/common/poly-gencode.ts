// SPDX-License-Identifier: EPL-2.0

/**
 * Shape rendering (polygon/ellipse + label) for polygon nodes.
 *
 * @see lib/common/shapes.c:poly_gencode
 */

import type { Node } from '../model/node.js';
import type { Point } from '../model/geom.js';
import type { RenderJob } from '../gvc/job.js';
import type { RendererPlugin } from '../gvc/context.js';
import { gvrenderTextspan, withLabelEmitState } from '../gvc/textspan-emit.js';
import type { PolygonT, TextlabelT, GraphvizPolygonStyle, ShapeDesc } from './types.js';
import { ShapeKind } from './types.js';
import type { TextSpan } from './emit-types.js';
import { STAR } from './shapeData.js';
import type { PlacedHtml } from './htmltable-pos.js';
import type { ObjState } from '../gvc/job.js';
import { EMIT_CLUSTERS_LAST } from '../gvc/job.js';
import { FillType } from '../gvc/context.js';
import { emitHtmlLabel } from './htmltable-emit.js';
import { transformPoint } from '../gvc/device.js';
import { nodeAttr } from './poly-init.js';
import { substObjAnchor, interpretCRNL } from './subst.js';
import type { ResolvedFill, PolyStyleFlags } from './style-resolve.js';
import {
  parseStyleFlags,
  resolveNodeFillEx,
  resolvePenColor,
  resolvePenType,
  resolvePenWidth,
  styleTokens,
} from './style-resolve.js';
import { stripedBox, wedgedEllipse } from '../render/svg-multicolor.js';
import { resolveRenderColor, withColorScheme } from '../render/color-resolve.js';
import { svgNodeId } from '../render/svg-id.js';
import { drawRoundCorners, mcircleHack, underlineDraw } from './poly-shapes.js';

// ---------------------------------------------------------------------------
// Multicolor test
// ---------------------------------------------------------------------------

/**
 * True when the fillcolor string contains more than one color segment.
 * @see lib/common/shapes.c:2917 multicolor()
 */
function isMulticolor(fillcolor: string): boolean {
  return fillcolor.includes(':');
}

// ---------------------------------------------------------------------------
// Periphery ring renderers
// ---------------------------------------------------------------------------

/** Render one ellipse periphery ring for a node. */
export function renderEllipse(
  ring: Point[],
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
  filled: boolean,
): void {
  const rx = Math.abs((ring[1]!.x - ring[0]!.x) / 2);
  const ry = Math.abs((ring[1]!.y - ring[0]!.y) / 2);
  const center = transformPoint(coord, job);
  renderer.ellipse(center, rx, ry, filled, job);
}

/** Render one polygon periphery ring for a node. */
export function renderPolygon(
  ring: Point[], coord: Point, renderer: RendererPlugin, job: RenderJob, filled: boolean,
): void {
  const pts = ring.map((v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, job));
  renderer.polygon(pts, filled, job);
}

/** Bundled render context for periphery ring helpers. */
interface RingCtx {
  renderer: RendererPlugin;
  job: RenderJob;
  style: PolyStyleFlags;
  fillcolor: string;
  shape: number;
  diagonals: boolean;
  rounded: boolean;
  underline: boolean;
}

/**
 * Render one ellipse periphery ring, dispatching to wedgedEllipse when
 * style.wedged + j==0 + multicolor fillcolor.
 * @see lib/common/shapes.c:poly_gencode :3026-3033
 */
function renderEllipseRing(
  ring: Point[], coord: Point, filled: boolean, j: number, ctx: RingCtx,
): void {
  if (ctx.style.wedged && j === 0 && isMulticolor(ctx.fillcolor)) {
    const pf = ring.map(
      (v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, ctx.job),
    );
    wedgedEllipse(ctx.job, pf, ctx.fillcolor, ctx.renderer);
    renderEllipse(ring, coord, ctx.renderer, ctx.job, false); // boundary unfilled
  } else {
    renderEllipse(ring, coord, ctx.renderer, ctx.job, filled);
  }
  // Mcircle: two chords after the ellipse. @see lib/common/shapes.c:3034
  if (ctx.diagonals) mcircleHack(ring, coord, ctx);
}

/**
 * Render one polygon periphery ring, dispatching to stripedBox when
 * style.striped + j==0.
 * @see lib/common/shapes.c:poly_gencode :3037-3043
 */
/** Striped j===0 ring: the multicolor box plus an unfilled boundary polygon. */
function renderStripedRing(ring: Point[], coord: Point, ctx: RingCtx): void {
  const af = ring.map((v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, ctx.job));
  stripedBox(ctx.job, af, ctx.fillcolor, true, ctx.renderer);
  renderPolygon(ring, coord, ctx.renderer, ctx.job, false); // boundary unfilled
}

function renderPolyRing(
  ring: Point[], coord: Point, filled: boolean, j: number, ctx: RingCtx,
): void {
  // C dispatch order: striped, underline, SPECIAL_CORNERS, plain.
  // @see lib/common/shapes.c:poly_gencode :3037-3052
  if (ctx.style.striped && j === 0) renderStripedRing(ring, coord, ctx);
  else if (ctx.underline) underlineDraw(ring, coord, filled, ctx);
  // STAR carries a custom vertex generator but draws as a PLAIN filled polygon
  // (C's p_star has option.shape=0 — no special-draw style), unlike CYLINDER and
  // the biological shapes. @see lib/common/shapes.c:p_star / poly_gencode
  else if ((ctx.shape !== 0 && ctx.shape !== STAR) || ctx.diagonals || ctx.rounded) {
    drawRoundCorners(ring, coord, filled, ctx);
  } else renderPolygon(ring, coord, ctx.renderer, ctx.job, filled);
}

/**
 * Draw the node boundary: one ring per periphery, innermost first.
 * The `filled` flag is passed to the FIRST ring (j===0) only; all
 * later rings receive false — matching C: `filled = 0` after first ring.
 *
 * @see lib/common/shapes.c:poly_gencode (peripheries draw loop, :3018-3056)
 */
function renderPeripheries(
  poly: PolygonT, coord: Point, filled: boolean, ctx: RingCtx,
): void {
  const sides = poly.sides <= 2 ? 2 : poly.sides;
  const verts = poly.vertices!;
  for (let j = 0; j < poly.peripheries; j++) {
    const ring = verts.slice(j * sides, (j + 1) * sides);
    if (ring.length < sides) break;
    // C: filled applies to j===0 only; filled=0 for all later rings.
    const ringFilled = j === 0 ? filled : false;
    if (poly.sides <= 2) {
      renderEllipseRing(ring, coord, ringFilled, j, ctx);
    } else {
      renderPolyRing(ring, coord, ringFilled, j, ctx);
    }
  }
}

// ---------------------------------------------------------------------------
// Label rendering
// ---------------------------------------------------------------------------

/**
 * Render the text label for a node.
 *
 * @see lib/common/labels.c:emit_label
 * @see lib/common/shapes.c:poly_gencode (sets ND_label.pos = ND_coord)
 */
export function renderLabel(
  label: TextlabelT,
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  if (label.u.kind !== 'txt' || label.u.nspans < 1) return;
  label.pos = coord;
  label.set = true;
  // First-span baseline per valign (labelloc). @see lib/common/labels.c:240-251
  const VALIGN_TOP = 't'.charCodeAt(0);
  const VALIGN_BOTTOM = 'b'.charCodeAt(0);
  let py = label.valign === VALIGN_TOP
    ? coord.y + label.space.y / 2.0 - label.fontsize
    : label.valign === VALIGN_BOTTOM
      ? coord.y - label.space.y / 2.0 + label.dimen.y - label.fontsize
      : coord.y + label.dimen.y / 2.0 - label.fontsize;
  for (let i = 0; i < label.u.nspans; i++) {
    const span = label.u.span[i] as TextSpan;
    // @see lib/common/labels.c:emit_label (254-266)
    const px = span.just === 'l' ? coord.x - label.space.x / 2.0
      : span.just === 'r' ? coord.x + label.space.x / 2.0
      : coord.x;
    gvrenderTextspan(renderer, { x: px, y: py }, span, job);
    py -= span.size.y;
  }
}

/** Dispatch HTML or text label rendering for a node. */
function renderNodeLabel(
  n: Node,
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const label = n.info.label as TextlabelT | undefined;
  if (label === undefined) return;
  if (label.html && label.u.kind === 'html') {
    label.pos = coord;
    label.set = true;
    // Route the HTML label's box/fill/text ops into the node LABEL emit-state
    // (→ _ldraw_ for xdot), not the node DRAW state. SVG ignores emit_state.
    const html = label.u.html as PlacedHtml;
    withLabelEmitState(job, () => emitHtmlLabel(html, coord, renderer, job));
  } else {
    renderLabel(label, coord, renderer, job);
  }
}

// ---------------------------------------------------------------------------
// Anchor helpers
// ---------------------------------------------------------------------------

/** Non-empty node attr (root-default inheritance), or undefined. */
function anchorAttr(n: Node, key: string): string | undefined {
  const v = nodeAttr(n, n.root, key);
  return v !== undefined && v !== '' ? v : undefined;
}

/** Resolve tooltip string: explicit attr, or fall back to label text. */
function resolveTooltip(n: Node, tooltip: string | undefined): string {
  if (tooltip !== undefined) return substObjAnchor(interpretCRNL(tooltip), n);
  const label = n.info.label as TextlabelT | undefined;
  return label?.text ?? '';
}

/**
 * Open the whole-node anchor when the node has a URL or tooltip.
 * Returns true when the caller must close the anchor after the label.
 * @see lib/common/shapes.c:poly_gencode (doMap)
 * @see lib/common/emit.c:initObjMapData / initMapData
 */
function beginNodeAnchor(n: Node, renderer: RendererPlugin, job: RenderJob): boolean {
  const url = anchorAttr(n, 'href') ?? anchorAttr(n, 'URL');
  const tooltip = anchorAttr(n, 'tooltip');
  if (url === undefined && tooltip === undefined) return false;
  renderer.beginAnchor?.(
    url !== undefined ? substObjAnchor(url, n) : '',
    resolveTooltip(n, tooltip),
    anchorAttr(n, 'target') ?? '',
    svgNodeId(n, job),
    job,
  );
  return true;
}

// ---------------------------------------------------------------------------
// Style resolution — populates job.obj from node attrs
// ---------------------------------------------------------------------------

/**
 * Copy gradient fields from a linear/radial ResolvedFill onto obj.
 * Extracted helper; keeps applyFillState within CCN/param limits.
 * @see lib/common/shapes.c:2985-2998 GRADIENT/RGRADIENT block
 */
function applyGradientFields(
  obj: ObjState,
  fill: Extract<ResolvedFill, { kind: 'linear' | 'radial' }>,
): void {
  obj.fill = fill.kind === 'radial' ? FillType.Radial : FillType.Linear;
  obj.fillColor = resolveRenderColor(fill.fillColor);
  obj.stopColor = resolveRenderColor(fill.stopColor);
  obj.gradientFrac = fill.frac;
  obj.gradientAngle = fill.angle;
}

/** True when the node's bound shape is `shape=point`. @see types.h:SH_POINT */
export function isPointNode(n: Node): boolean {
  return (n.info.shape as ShapeDesc | undefined)?.kind === ShapeKind.SH_POINT;
}

/**
 * Default fill color for a point: fillcolor, else color, else "black".
 * @see lib/common/shapes.c:findFillDflt (point_gencode passes "black")
 */
function findFillDflt(n: Node): string {
  const fillcolor = nodeAttr(n, n.root, 'fillcolor');
  if (fillcolor !== undefined && fillcolor !== '') return fillcolor;
  const color = nodeAttr(n, n.root, 'color');
  if (color !== undefined && color !== '') return color;
  return 'black';
}

/**
 * Apply fill state to obj using the discriminated resolveNodeFillEx.
 * Sets obj.id to the node's SVG id (nodeN) so emitGradientDefs can
 * prefix the gradient id correctly.
 * Returns true when the node should render as filled (truthy fill kind).
 * @see lib/common/shapes.c:2981-2999 GRADIENT/RGRADIENT/FILL/0 block
 * @see plugin/core/gvrender_core_svg.c:572 svg_gradstyle (id prefix from obj->id)
 */
function applyFillState(obj: ObjState, n: Node, job: RenderJob): boolean {
  // Set obj.id so gradient prefix matches C's getObjId result (DOT `id` attr,
  // or "<gid>_node<seq>"). @see lib/common/emit.c:209 getObjId (AGNODE case)
  obj.id = svgNodeId(n, job);
  // point_gencode always fills, defaulting to black (AD-4).
  if (isPointNode(n)) {
    obj.fill = FillType.Solid;
    obj.fillColor = resolveRenderColor(findFillDflt(n));
    return true;
  }
  const fillRes = resolveNodeFillEx({
    style: nodeAttr(n, n.root, 'style'),
    fillcolor: nodeAttr(n, n.root, 'fillcolor'),
    color: nodeAttr(n, n.root, 'color'),
    gradientangle: nodeAttr(n, n.root, 'gradientangle'),
  });
  if (fillRes.kind === 'none') { obj.fill = FillType.None; return false; }
  if (fillRes.kind === 'solid') {
    obj.fill = FillType.Solid;
    obj.fillColor = resolveRenderColor(fillRes.color);
    return true;
  }
  applyGradientFields(obj, fillRes);
  return true;
}

/** Apply pen state (color, type, width) to obj. @see lib/common/shapes.c:3007 */
function applyPenState(obj: ObjState, styleAttr: string | undefined,
  colorAttr: string | undefined, penwidthAttr: string | undefined): void {
  const flags = parseStyleFlags(styleAttr);
  obj.penColor = resolveRenderColor(resolvePenColor(colorAttr));
  obj.pen = resolvePenType(flags);
  obj.penWidth = resolvePenWidth(flags, penwidthAttr);
  // Raw style tokens for xdot's `S` ops; SVG reads only obj.pen (xdot-only).
  obj.rawStyle = styleTokens(styleAttr);
}

/**
 * Resolve and apply node style/fill/pen attrs to the given ObjState.
 * Returns true when the node should be rendered as filled.
 *
 * Gradient fills: Linear/Radial FillType + fillColor/stopColor/frac/angle set.
 * Shared with record_gencode (records resolve style identically in C).
 * @see lib/common/shapes.c:poly_gencode (~2981-3007)
 */
export function applyNodeStyle(obj: ObjState, n: Node, job: RenderJob): boolean {
  const styleAttr = nodeAttr(n, n.root, 'style');
  const colorAttr = nodeAttr(n, n.root, 'color');
  // C wraps each node's color block with setColorScheme so a `colorscheme`
  // attr applies to bare scheme indices. @see lib/common/emit.c:1781/1789
  return withColorScheme(nodeAttr(n, n.root, 'colorscheme'), () => {
    const filled = applyFillState(obj, n, job);
    applyPenState(obj, styleAttr, colorAttr, nodeAttr(n, n.root, 'penwidth'));
    return filled;
  });
}

/**
 * Compute effective poly for borderless-filled case; applies transparent pen.
 * C: if (peripheries==0 && filled && pfilled) { peripheries=1; pencolor=transparent }
 * @see lib/common/shapes.c:3012-3016
 */
function prepareDrawPoly(poly: PolygonT, filled: boolean, obj: ObjState): PolygonT {
  if (poly.peripheries !== 0 || !filled) return poly;
  obj.penColor = { type: 'string', s: 'transparent' };
  return { ...poly, peripheries: 1 };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Resolved draw inputs for polyGencode — reduces CCN of the entry point. */
interface NodeDrawCtx {
  poly: PolygonT;
  coord: Point;
  filled: boolean;
  ringCtx: RingCtx;
}

/**
 * C poly_gencode scales every vertex by xsize/ysize = (ND_lw+ND_rw) /
 * INCH2PS(ND_width) etc. (shapes.c:3010-3011) — squashing the polygon back to
 * the lw/rw/ht extent when an engine leaves ND_width/ND_height divergent
 * (patchwork's finishNode lets poly_init clobber them while the tile survives
 * in lw/rw/ht). On the normal path C's factor is EXACTLY 1.0 by construction
 * (gv_nodesize derives lw/rw from INCH2PS(ND_width)); the port's compressed
 * dataflow can land at 1±ULP where C is exactly 1, so identity-within-ULP is
 * treated as C's exact-1 case and left unscaled.
 */
function vertexScale(n: Node, poly: PolygonT): PolygonT {
  const info = n.info;
  if (poly.vertices == null || info.width === undefined || info.height === undefined) {
    return poly;
  }
  const xsize = (info.lw + info.rw) / (info.width * 72);
  const ysize = info.ht / (info.height * 72);
  if (Math.abs(xsize - 1) < 1e-9 && Math.abs(ysize - 1) < 1e-9) return poly;
  return {
    ...poly,
    vertices: poly.vertices.map((v) => ({ x: v.x * xsize, y: v.y * ysize })),
  };
}

/** Validate and resolve poly/style context for a node; returns null if skip. */
function resolveNodeDrawCtx(job: RenderJob, n: Node): NodeDrawCtx | null {
  const rawPoly = n.info.shape_info as PolygonT | undefined;
  if (rawPoly === undefined || rawPoly.vertices === undefined) return null;
  const poly = vertexScale(n, rawPoly);
  const coord = n.info.coord ?? { x: 0, y: 0 };
  const obj = job.obj;
  const filled = obj !== null && applyNodeStyle(obj, n, job);
  const drawPoly = obj !== null ? prepareDrawPoly(poly, filled, obj) : poly;
  const styleFlags = parseStyleFlags(nodeAttr(n, n.root, 'style'));
  const ringCtx: RingCtx = {
    renderer: job.renderer!,
    job,
    style: styleFlags,
    fillcolor: nodeAttr(n, n.root, 'fillcolor') ?? '',
    ...specialCornerFlags(drawPoly.option, styleFlags),
  };
  return { poly: drawPoly, coord, filled, ringCtx };
}

/**
 * Combine the shape's polygon-option flags with the style-attribute flags, as
 * C does (checkStyle: istyle = style_or(istyle, poly->option)).
 */
function specialCornerFlags(
  opt: GraphvizPolygonStyle, style: PolyStyleFlags,
): { shape: number; diagonals: boolean; rounded: boolean; underline: boolean } {
  return {
    shape: opt.shape,
    diagonals: opt.diagonals || style.diagonals,
    rounded: opt.rounded || style.rounded,
    underline: opt.underline || style.underline,
  };
}

/**
 * Render node shape (polygon/ellipse) and label.
 * Shape codefn — called from walkNodes.
 * @see lib/common/shapes.c:poly_gencode
 */
export function polyGencode(rawJob: unknown, rawNode: unknown): void {
  const job = rawJob as RenderJob;
  const n = rawNode as Node;
  const renderer = job.renderer;
  if (!renderer) return;
  const ctx = resolveNodeDrawCtx(job, n);
  if (ctx === null) return;
  // EMIT_CLUSTERS_LAST (map device): the node's own anchor <area> is emitted
  // AFTER its shape and label, so an inner HTML cell's area precedes the
  // node's. Save the node hot spot first — HTML cells overwrite obj.urlMapPts
  // via emit_map_rect — and restore it for the deferred anchor.
  // @see lib/common/shapes.c:poly_gencode (2936, 3087-3092)
  const clustersLast = (job.flags & EMIT_CLUSTERS_LAST) !== 0;
  const savedShape = job.obj?.urlMapShape;
  const savedPts = job.obj?.urlMapPts;
  let inAnchor = clustersLast ? false : beginNodeAnchor(n, renderer, job);
  renderPeripheries(ctx.poly, ctx.coord, ctx.filled, ctx.ringCtx);
  // point_gencode never emits a label (AD-3).
  if (!isPointNode(n)) renderNodeLabel(n, ctx.coord, renderer, job);
  if (clustersLast) {
    if (job.obj && savedPts !== undefined && savedShape !== undefined) {
      job.obj.urlMapShape = savedShape;
      job.obj.urlMapPts = savedPts;
    }
    inAnchor = beginNodeAnchor(n, renderer, job);
  }
  if (inAnchor) renderer.endAnchor?.(job);
}
