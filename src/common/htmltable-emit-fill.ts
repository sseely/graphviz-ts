// SPDX-License-Identifier: EPL-2.0

/**
 * Fill, border, and rule-line helpers for HTML label emission.
 * Ports setFill, mkPts, doSide, doBorder from lib/common/htmltable.c.
 *
 * @see lib/common/htmltable.c:setFill
 * @see lib/common/htmltable.c:mkPts
 * @see lib/common/htmltable.c:doSide
 * @see lib/common/htmltable.c:doBorder
 */

import type { Point, Box } from '../model/geom.js';
import type { ObjState, RenderJob } from '../gvc/job.js';
import { ObjType, EmitState, MapShape } from '../gvc/job.js';
import type { RendererPlugin } from '../gvc/context.js';
import { FillType, PenType } from '../gvc/context.js';
import { transformPoint } from '../gvc/device.js';
import { resolveRenderColor } from '../render/color-resolve.js';
import {
  BORDER_LEFT,
  BORDER_TOP,
  BORDER_RIGHT,
  BORDER_BOTTOM,
  BORDER_MASK,
} from './htmltable-types.js';

// ---------------------------------------------------------------------------
// Gradient spec parser
// ---------------------------------------------------------------------------

/**
 * Parse a color spec for gradient: "color1:color2" → [color1, color2].
 * Single-color strings return null (not a gradient spec).
 *
 * @see lib/common/emit.c:findStopColor
 */
export function parseGradientSpec(color: string): [string, string] | null {
  const idx = color.indexOf(':');
  if (idx < 1) return null;
  const c0 = color.slice(0, idx).trim();
  const c1 = color.slice(idx + 1).trim();
  if (c0.length === 0) return null;
  return [c0, c1.length > 0 ? c1 : 'black'];
}

// ---------------------------------------------------------------------------
// Scoped paint state — the port of C's gvrender set_fillcolor/set_pencolor
// ---------------------------------------------------------------------------

/**
 * Reusable scoped ObjState for HTML decoration painting.
 *
 * The live render path keeps no persistent ObjState (job.obj is null
 * outside the dormant emit family), so decoration drawing pushes this
 * one for the duration of each paint call. Mirrors C's
 * gvrender_set_fillcolor/gvrender_set_pencolor on the active obj
 * before each drawing call in emit_html_tbl / emit_html_cell.
 *
 * Module-level reuse avoids per-decoration allocation (hot-loop rule).
 *
 * @see lib/common/htmltable.c:setFill
 */
const paintObj: ObjState = {
  parent: null, type: ObjType.Node, graphObj: null,
  emitState: EmitState.NDraw,
  penColor: { type: 'string', s: 'black' },
  fillColor: { type: 'none' },
  stopColor: { type: 'none' },
  gradientAngle: 0, gradientFrac: 0,
  pen: PenType.Solid, fill: FillType.None, penWidth: 1.0,
  rawStyle: [],
  label: null, xlabel: null, tailLabel: null, headLabel: null,
  url: null, id: null, labelUrl: null, tailUrl: null, headUrl: null,
  tooltip: null, labelTooltip: null, tailTooltip: null, headTooltip: null,
  target: null, labelTarget: null, tailTarget: null, headTarget: null,
  explicitTooltip: false, explicitTailTooltip: false,
  explicitHeadTooltip: false, explicitLabelTooltip: false,
  explicitTailTarget: false, explicitHeadTarget: false,
  explicitEdgeTarget: false, explicitTailUrl: false,
  explicitHeadUrl: false, labelEdgeAligned: false,
  urlMapShape: MapShape.Rectangle,
  urlMapPts: [], urlBsplineMapPts: [],
  tailEndMapPts: [], headEndMapPts: [],
};

/** Paint requested for a scoped drawing call. */
export interface HtmlPaint {
  /** Solid fill color; absent → no fill ("none"). */
  fill?: string;
  /** Pen (stroke) color; absent → "none" (transparent). */
  pen?: string;
  /** Pen width; default 1.0 (omitted from SVG at 1.0). */
  penWidth?: number;
  /** Style string; "dashed"/"dotted" map to the pen type. */
  penStyle?: string;
}

/** Map a style string to the C pen type. @see lib/common/htmltable.c:doBorder */
function penTypeOf(style: string | undefined): PenType {
  if (style !== undefined && style.includes('dashed')) return PenType.Dashed;
  if (style !== undefined && style.includes('dotted')) return PenType.Dotted;
  return PenType.Solid;
}

/**
 * Run drawFn with a scoped ObjState carrying the given paint colors,
 * then restore the previous (usually null) obj state.
 *
 * @see lib/common/htmltable.c:setFill
 */
export function withHtmlPaint(paint: HtmlPaint, job: RenderJob, drawFn: () => void): void {
  paintObj.fillColor = paint.fill !== undefined
    ? resolveRenderColor(paint.fill) : { type: 'none' };
  paintObj.penColor = paint.pen !== undefined
    ? resolveRenderColor(paint.pen) : { type: 'string', s: 'transparent' };
  paintObj.fill = paint.fill !== undefined ? FillType.Solid : FillType.None;
  paintObj.pen = penTypeOf(paint.penStyle);
  paintObj.penWidth = paint.penWidth !== undefined ? paint.penWidth : 1.0;
  job.pushObj(paintObj);
  try { drawFn(); } finally { job.popObj(); }
}

// ---------------------------------------------------------------------------
// mkPts
// ---------------------------------------------------------------------------

/**
 * Build the four inset corner points of box b (SW, SE, NE, NW).
 * When border > 1, insets by border/2 on each side.
 *
 * @see lib/common/htmltable.c:mkPts
 */
export function mkPts(b: Box, border: number, pos: Point): Point[] {
  let llx = b.ll.x + pos.x;
  let lly = b.ll.y + pos.y;
  let urx = b.ur.x + pos.x;
  let ury = b.ur.y + pos.y;
  if (border > 1) {
    const delta = border / 2.0;
    llx += delta; lly += delta;
    urx -= delta; ury -= delta;
  }
  return [
    { x: llx, y: lly }, // SW
    { x: urx, y: lly }, // SE
    { x: urx, y: ury }, // NE
    { x: llx, y: ury }, // NW
  ];
}

// ---------------------------------------------------------------------------
// doSide
// ---------------------------------------------------------------------------

/**
 * Emit a filled rule box from point p with given width/height.
 * wd=0 means a vertical rule; ht=0 means a horizontal rule.
 *
 * @see lib/common/htmltable.c:doSide
 */
export function doSide(
  p: Point,
  wd: number,
  ht: number,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const pts = [
    { x: p.x,      y: p.y      },
    { x: p.x,      y: p.y + ht },
    { x: p.x + wd, y: p.y + ht },
    { x: p.x + wd, y: p.y      },
  ].map((pt) => transformPoint(pt, job));
  renderer.polygon(pts, true, job);
}

// ---------------------------------------------------------------------------
// doBorder — descriptor type + implementation
// ---------------------------------------------------------------------------

/** Parameters for doBorder, grouped to stay within the 5-param limit. */
export interface BorderSpec {
  box: Box;
  pos: Point;
  border: number;
  color: string;
  /** SIDES bitmask (0 / undefined → full box). */
  sides?: number;
  /** Style string: "dashed", "dotted", etc. */
  style?: string;
}

/**
 * Emit a rectangular border for box b, respecting SIDES bitmask.
 * When sides is 0 or undefined, emits a full-box polygon (unfilled).
 *
 * @see lib/common/htmltable.c:doBorder
 */
export function doBorder(
  spec: BorderSpec,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const { box, pos, border, color, sides, style } = spec;
  withHtmlPaint({ pen: color, penWidth: border, penStyle: style }, job, () => {
    const effSides = (sides !== undefined) ? (sides & BORDER_MASK) : 0;
    if (effSides !== 0) {
      const corners = mkPts(box, border, pos).map((p) => transformPoint(p, job));
      emitSidedPolylines(effSides, corners, renderer, job);
    } else {
      emitFullBoxBorder(box, pos, border, renderer, job);
    }
  });
}

/** Emit an inset full-box border polygon (unfilled). */
function emitFullBoxBorder(
  box: Box,
  pos: Point,
  border: number,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const b2: Box = border > 1 ? {
    ll: { x: box.ll.x + border / 2, y: box.ll.y + border / 2 },
    ur: { x: box.ur.x - border / 2, y: box.ur.y - border / 2 },
  } : box;
  const pts = [
    { x: b2.ll.x + pos.x, y: b2.ll.y + pos.y },
    { x: b2.ll.x + pos.x, y: b2.ur.y + pos.y },
    { x: b2.ur.x + pos.x, y: b2.ur.y + pos.y },
    { x: b2.ur.x + pos.x, y: b2.ll.y + pos.y },
  ].map((pt) => transformPoint(pt, job));
  renderer.polygon(pts, false, job);
}

// ---------------------------------------------------------------------------
// emitSidedPolylines — lookup table, CCN ≤ 4
// ---------------------------------------------------------------------------

// Corner index aliases: 0=SW, 1=SE, 2=NE, 3=NW
const SW = 0, SE = 1, NE = 2, NW = 3;
const B = BORDER_BOTTOM, R = BORDER_RIGHT, T = BORDER_TOP, L = BORDER_LEFT;

/**
 * Lookup table: sides bitmask → list of polyline sequences (each sequence is
 * an array of corner indices into [SW, SE, NE, NW]).
 * Matches C doBorder switch-case exactly (htmltable.c:278-330).
 *
 * @see lib/common/htmltable.c:doBorder
 */
const SIDES_TABLE: ReadonlyMap<number, ReadonlyArray<ReadonlyArray<number>>> = new Map([
  [B|R|T|L, [[SW,SE,NE,NW,SW]]],
  [B|R|T,   [[SW,SE,NE,NW]]   ],
  [R|T|L,   [[SE,NE,NW,SW]]   ],
  [T|L|B,   [[NE,NW,SW,SE]]   ],
  [L|B|R,   [[NW,SW,SE,NE]]   ],
  [B|R,     [[SW,SE,NE]]      ],
  [R|T,     [[SE,NE,NW]]      ],
  [T|L,     [[NE,NW,SW]]      ],
  [L|B,     [[NW,SW,SE]]      ],
  [T|B,     [[SW,SE],[NE,NW]] ],
  [L|R,     [[NW,SW],[SE,NE]] ],
  [B,       [[SW,SE]]         ],
  [R,       [[SE,NE]]         ],
  [T,       [[NE,NW]]         ],
  [L,       [[NW,SW]]         ],
]);

/**
 * Emit polyline segments for a SIDES bitmask via a lookup table.
 * CCN = 2 (loop + no-match guard).
 *
 * @see lib/common/htmltable.c:doBorder
 */
function emitSidedPolylines(
  sides: number,
  corners: Point[],
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const seqs = SIDES_TABLE.get(sides & BORDER_MASK);
  if (seqs === undefined) return;
  for (const seq of seqs) {
    renderer.polyline(seq.map((i) => corners[i]!), job);
  }
}
