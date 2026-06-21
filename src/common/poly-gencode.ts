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
import type { PolygonT, TextlabelT, GraphvizPolygonStyle, ShapeDesc } from './types.js';
import { ShapeKind } from './types.js';
import type { TextSpan } from './emit-types.js';
import type { PlacedHtml } from './htmltable-pos.js';
import type { ObjState } from '../gvc/job.js';
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
} from './style-resolve.js';
import { stripedBox, wedgedEllipse } from '../render/svg-multicolor.js';
import { resolveRenderColor, withColorScheme } from '../render/color-resolve.js';
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
  else if (ctx.shape !== 0 || ctx.diagonals || ctx.rounded) {
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
  let py = coord.y + label.dimen.y / 2.0 - label.fontsize;
  for (let i = 0; i < label.u.nspans; i++) {
    const span = label.u.span[i] as TextSpan;
    // @see lib/common/labels.c:emit_label (254-266)
    const px = span.just === 'l' ? coord.x - label.space.x / 2.0
      : span.just === 'r' ? coord.x + label.space.x / 2.0
      : coord.x;
    renderer.textspan({ x: px, y: py }, span, job);
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
    emitHtmlLabel(label.u.html as PlacedHtml, coord, renderer, job);
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
    'node' + (n.id + 1),
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
function isPointNode(n: Node): boolean {
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
function applyFillState(obj: ObjState, n: Node): boolean {
  // Set obj.id so gradient prefix matches C's getObjId result ("nodeN").
  // @see lib/common/emit.c:209 getObjId (AGNODE case: pfx="node", idnum=AGSEQ)
  obj.id = 'node' + (n.id + 1);
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
}

/**
 * Resolve and apply node style/fill/pen attrs to the given ObjState.
 * Returns true when the node should be rendered as filled.
 *
 * Gradient fills: Linear/Radial FillType + fillColor/stopColor/frac/angle set.
 * Shared with record_gencode (records resolve style identically in C).
 * @see lib/common/shapes.c:poly_gencode (~2981-3007)
 */
export function applyNodeStyle(obj: ObjState, n: Node): boolean {
  const styleAttr = nodeAttr(n, n.root, 'style');
  const colorAttr = nodeAttr(n, n.root, 'color');
  // C wraps each node's color block with setColorScheme so a `colorscheme`
  // attr applies to bare scheme indices. @see lib/common/emit.c:1781/1789
  return withColorScheme(nodeAttr(n, n.root, 'colorscheme'), () => {
    const filled = applyFillState(obj, n);
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

/** Validate and resolve poly/style context for a node; returns null if skip. */
function resolveNodeDrawCtx(job: RenderJob, n: Node): NodeDrawCtx | null {
  const poly = n.info.shape_info as PolygonT | undefined;
  if (poly === undefined || poly.vertices === undefined) return null;
  const coord = n.info.coord ?? { x: 0, y: 0 };
  const obj = job.obj;
  const filled = obj !== null && applyNodeStyle(obj, n);
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
  const inAnchor = beginNodeAnchor(n, renderer, job);
  renderPeripheries(ctx.poly, ctx.coord, ctx.filled, ctx.ringCtx);
  // point_gencode never emits a label (AD-3).
  if (!isPointNode(n)) renderNodeLabel(n, ctx.coord, renderer, job);
  if (inAnchor) renderer.endAnchor?.(job);
}
