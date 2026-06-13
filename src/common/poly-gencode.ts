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
import type { PolygonT, TextlabelT } from './types.js';
import type { TextSpan } from './emit-types.js';
import type { PlacedHtml } from './htmltable-pos.js';
import type { ObjState } from '../gvc/job.js';
import { FillType } from '../gvc/context.js';
import { emitHtmlLabel } from './htmltable-emit.js';
import { transformPoint } from '../gvc/device.js';
import { nodeAttr } from './poly-init.js';
import { substObjAnchor, interpretCRNL } from './subst.js';
import {
  parseStyleFlags,
  resolveNodeFill,
  resolvePenColor,
  resolvePenType,
  resolvePenWidth,
} from './style-resolve.js';

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
  ring: Point[],
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
  filled: boolean,
): void {
  const pts = ring.map(
    (v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, job),
  );
  renderer.polygon(pts, filled, job);
}

/**
 * Draw the node boundary: one ring per periphery, innermost first.
 * The `filled` flag is passed to the FIRST ring (j===0) only; all
 * later rings receive false — matching C: `filled = 0` after first ring.
 *
 * @see lib/common/shapes.c:poly_gencode (peripheries draw loop, :3018-3056)
 */
function renderPeripheries(
  poly: PolygonT,
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
  filled: boolean,
): void {
  const sides = poly.sides <= 2 ? 2 : poly.sides;
  const verts = poly.vertices!;
  for (let j = 0; j < poly.peripheries; j++) {
    const ring = verts.slice(j * sides, (j + 1) * sides);
    if (ring.length < sides) break;
    // C: filled applies to j===0 only; filled=0 for all later rings.
    const ringFilled = j === 0 ? filled : false;
    if (poly.sides <= 2) renderEllipse(ring, coord, renderer, job, ringFilled);
    else renderPolygon(ring, coord, renderer, job, ringFilled);
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

/** Apply fill state to obj; returns true when filled. @see lib/common/shapes.c:2981-2999 */
function applyFillState(obj: ObjState, styleAttr: string | undefined,
  fillcolorAttr: string | undefined, colorAttr: string | undefined): boolean {
  const fillRes = resolveNodeFill({ style: styleAttr, fillcolor: fillcolorAttr, color: colorAttr });
  obj.fill = fillRes.filled ? FillType.Solid : FillType.None;
  if (fillRes.filled) obj.fillColor = { type: 'string', s: fillRes.color };
  return fillRes.filled;
}

/** Apply pen state (color, type, width) to obj. @see lib/common/shapes.c:3007 */
function applyPenState(obj: ObjState, styleAttr: string | undefined,
  colorAttr: string | undefined, penwidthAttr: string | undefined): void {
  const flags = parseStyleFlags(styleAttr);
  obj.penColor = { type: 'string', s: resolvePenColor(colorAttr) };
  obj.pen = resolvePenType(flags);
  obj.penWidth = resolvePenWidth(flags, penwidthAttr);
}

/**
 * Resolve and apply node style/fill/pen attrs to the given ObjState.
 * Returns true when the node should be rendered as filled.
 *
 * Striped/wedged: resolveNodeFill returns first solid color (AD3).
 * True stripe/wedge is owned by the gradient mission.
 * @see lib/common/shapes.c:poly_gencode (~2981-3007)
 */
function applyNodeStyle(obj: ObjState, n: Node): boolean {
  const styleAttr = nodeAttr(n, n.root, 'style');
  const colorAttr = nodeAttr(n, n.root, 'color');
  const filled = applyFillState(obj, styleAttr, nodeAttr(n, n.root, 'fillcolor'), colorAttr);
  applyPenState(obj, styleAttr, colorAttr, nodeAttr(n, n.root, 'penwidth'));
  return filled;
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

  const poly = n.info.shape_info as PolygonT | undefined;
  if (poly === undefined || poly.vertices === undefined) return;

  const coord = n.info.coord ?? { x: 0, y: 0 };
  const obj = job.obj;

  // Resolve style/fill/pen onto job.obj (T2 guarantees non-null; guard for TS)
  const filled = obj !== null && applyNodeStyle(obj, n);
  const drawPoly = obj !== null ? prepareDrawPoly(poly, filled, obj) : poly;

  const inAnchor = beginNodeAnchor(n, renderer, job);
  renderPeripheries(drawPoly, coord, renderer, job, filled);
  renderNodeLabel(n, coord, renderer, job);
  if (inAnchor) renderer.endAnchor?.(job);
}
