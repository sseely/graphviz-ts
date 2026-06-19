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
import { type ShapeCtx, interpolationPoints, renderShapeBezier } from './poly-shapes-util.js';
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
