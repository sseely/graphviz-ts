// SPDX-License-Identifier: EPL-2.0
//
// Special node-shape rendering — a faithful port of C's round_corners shape
// switch (lib/common/shapes.c:709), which draws the SBOLv synthetic-biology
// shapes, the box family, the arrows, and cylinder as custom polygons. Without
// this the port drew every special shape as a plain box.
//
// This module is the dispatcher; the bevel/helper machinery lives in
// poly-shapes-util.ts and the per-shape vertex generators in
// poly-shapes-cases.ts.

import type { Point } from '../model/geom.js';
import {
  type ShapeCtx, interpolationPoints, renderShapeBezier,
  renderShapePolygon, renderShapePolyline,
} from './poly-shapes-util.js';
import {
  BOX3D, COMPONENT, DOGEAR, CDS, TAB, FOLDER, PROMOTER, TERMINATOR, UTR,
  INSULATOR, RIBOSITE, RNASTAB, PROTEASESITE, PROTEINSTAB,
  PRIMERSITE, RESTRICTIONSITE, FIVEPOVERHANG, THREEPOVERHANG, NOVERHANG,
  ASSEMBLY, SIGNATURE, RPROMOTER, RARROW, LARROW, LPROMOTER, CYLINDER,
} from './shapeData.js';
import * as C from './poly-shapes-cases.js';
import * as C2 from './poly-shapes-cases2.js';

export type { ShapeCtx } from './poly-shapes-util.js';

/** One shape-case renderer: (af, b, coord, filled, ctx) → void. */
type Case = (af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx) => void;

/** option.shape → renderer. A shape absent here is not yet ported. */
const CASES: ReadonlyMap<number, Case> = new Map<number, Case>([
  [CDS, C.drawCds],
  [DOGEAR, C.drawDogear],
  [TAB, C.drawTab],
  [FOLDER, C.drawFolder],
  [BOX3D, C.drawBox3d],
  [COMPONENT, C.drawComponent],
  [PROMOTER, C.drawPromoter],
  [TERMINATOR, C.drawTerminator],
  [UTR, C.drawUtr],
  [INSULATOR, C.drawInsulator],
  [RIBOSITE, C.drawRibosite],
  [RNASTAB, C.drawRnastab],
  [PROTEASESITE, C.drawProteasesite],
  [PROTEINSTAB, C.drawProteinstab],
  [PRIMERSITE, C2.drawPrimersite],
  [RESTRICTIONSITE, C2.drawRestrictionsite],
  [FIVEPOVERHANG, C2.drawFivepoverhang],
  [THREEPOVERHANG, C2.drawThreepoverhang],
  [NOVERHANG, C2.drawNoverhang],
  [ASSEMBLY, C2.drawAssembly],
  [SIGNATURE, C2.drawSignature],
  [RPROMOTER, C2.drawRpromoter],
  [RARROW, C2.drawRarrow],
  [LARROW, C2.drawLarrow],
  [LPROMOTER, C2.drawLpromoter],
]);

/**
 * Draw one periphery ring of a special-shape node, mirroring round_corners.
 * A shape that is not yet ported throws (loud) — never a silent plain box.
 * @see lib/common/shapes.c:709 round_corners; :739 switch
 */
export function drawSpecialShape(
  shape: number, ring: Point[], coord: Point, filled: boolean, ctx: ShapeCtx,
): void {
  // C handles cylinder before allocating B[] (round_corners:734); it is a
  // bezier outline + an unfilled top arc, not a B[]-derived polygon.
  if (shape === CYLINDER) {
    drawCylinder(ring, coord, filled, ctx);
    return;
  }
  const draw = CASES.get(shape);
  if (draw === undefined) {
    throw new Error('special shape ' + String(shape) + ' not yet ported');
  }
  const b = interpolationPoints(ring, ring.length, shape);
  draw(ring, b, coord, filled, ctx);
}

/**
 * CYLINDER: the 19-point control polygon as a (filled) bezier outline, plus a
 * 7-point unfilled top arc mirrored across AF[0].y.
 * @see lib/common/shapes.c:4199 cylinder_draw
 */
function drawCylinder(ring: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  renderShapeBezier(ring, coord, ctx, filled);
  const y02 = 2 * ring[0]!.y;
  const top: Point[] = [ring[0]!];
  for (let i = 1; i <= 5; i++) top.push({ x: ring[i]!.x, y: y02 - ring[i]!.y });
  top.push(ring[6]!);
  renderShapeBezier(top, coord, ctx, false);
}

/** Render context for the round_corners dispatcher (shape + style flags). */
export interface RoundCtx extends ShapeCtx {
  shape: number;
  diagonals: boolean;
  rounded: boolean;
}

/**
 * Dispatch one periphery ring of a node with special corners, mirroring
 * round_corners: diagonals → shape switch → rounded.
 * @see lib/common/shapes.c:709 round_corners (:722 diagonals, :725 shape, :727 rounded)
 */
export function drawRoundCorners(ring: Point[], coord: Point, filled: boolean, ctx: RoundCtx): void {
  if (ctx.diagonals) diagonalsDraw(ring, coord, filled, ctx);
  else if (ctx.shape !== 0) drawSpecialShape(ctx.shape, ring, coord, filled, ctx);
  else if (ctx.rounded) roundedDraw(ring, coord, filled, ctx);
}

/** diagonals: the plain polygon plus a corner-cutoff polyline per side.
 * @see lib/common/shapes.c:619 diagonals_draw */
function diagonalsDraw(ring: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const sides = ring.length;
  const b = interpolationPoints(ring, sides, 0);
  renderShapePolygon(ring, coord, ctx, filled);
  for (let seg = 0; seg < sides; seg++) {
    renderShapePolyline([b[3 * seg + 2]!, b[3 * seg + 4]!], coord, ctx);
  }
}

/** rounded: a Bézier outline through the per-corner inset curve points.
 * @see lib/common/shapes.c rounded_draw */
function roundedDraw(ring: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const sides = ring.length;
  const b = interpolationPoints(ring, sides, 0, true);
  const pts: Point[] = [];
  for (let seg = 0; seg < sides; seg++) {
    pts.push(b[4 * seg]!, b[4 * seg + 1]!, b[4 * seg + 1]!, b[4 * seg + 2]!, b[4 * seg + 2]!, b[4 * seg + 3]!);
  }
  pts.push(pts[0]!, pts[1]!);
  renderShapeBezier(pts.slice(1), coord, ctx, filled);
}

/** Mcircle: two horizontal chords on an ellipse (style=diagonals, sides<=2).
 * @see lib/common/shapes.c:547 Mcircle_hack */
export function mcircleHack(ring: Point[], coord: Point, ctx: ShapeCtx): void {
  const px = ring[1]!.x * 0.6614;
  const py = (0.75 * (ring[1]!.y - ring[0]!.y)) / 2;
  renderShapePolyline([{ x: px, y: py }, { x: -px, y: py }], coord, ctx);
  renderShapePolyline([{ x: px, y: -py }, { x: -px, y: -py }], coord, ctx);
}

/** underline: borderless fill, then only the bottom edge (AF[2]→AF[3]) stroked.
 * @see lib/common/shapes.c:3044 poly_gencode underline branch */
export function underlineDraw(ring: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const obj = ctx.job.obj;
  const saved = obj?.penColor;
  if (obj) obj.penColor = { type: 'none' };
  try {
    renderShapePolygon(ring, coord, ctx, filled);
  } finally {
    if (obj && saved !== undefined) obj.penColor = saved;
  }
  renderShapePolyline([ring[2]!, ring[3]!], coord, ctx);
}
