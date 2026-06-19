// SPDX-License-Identifier: EPL-2.0
//
// Per-shape vertex generators, verbatim ports of the round_corners switch
// cases (lib/common/shapes.c:740-1739). Each builds a D[] polygon (and any
// inner polylines) from the box vertices AF[] (`af`) and bevel polygon B[]
// (`b`), then renders via the adapters in poly-shapes-util.ts.

import type { Point } from '../model/geom.js';
import {
  type ShapeCtx, renderShapePolygon, renderShapePolyline,
  vadd, vsub, midX, midY1, dsDnaLine,
} from './poly-shapes-util.js';

// ---------------------------------------------------------------------------
// Box family
// ---------------------------------------------------------------------------

/** CDS — arrow without protrusions (5-point polygon). @see shapes.c:959-989 */
export function drawCds(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const w = b[3]!.y - b[4]!.y;
  const D: Point[] = [
    { x: b[1]!.x, y: b[1]!.y - w / 2 },
    { x: b[3]!.x, y: b[3]!.y - w / 2 },
    { x: af[2]!.x, y: af[2]!.y + w / 2 },
    { x: b[1]!.x, y: af[2]!.y + w / 2 },
    { x: af[0]!.x, y: af[0]!.y - (af[0]!.y - af[3]!.y) / 2 },
  ];
  renderShapePolygon(D, coord, ctx, filled);
}

/** DOGEAR (note): cutoff corner + inner fold lines. @see shapes.c:740-758 */
export function drawDogear(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const sides = af.length;
  const D: Point[] = new Array<Point>(sides + 1);
  for (let seg = 1; seg < sides; seg++) D[seg] = af[seg]!;
  D[0] = b[3 * (sides - 1) + 4]!;
  D[sides] = b[3 * (sides - 1) + 2]!;
  renderShapePolygon(D, coord, ctx, filled);
  const s = sides - 1;
  const c0 = b[3 * s + 2]!;
  const c2 = vadd(b[3 * s + 4]!, vsub(c0, b[3 * s + 3]!));
  renderShapePolyline([b[3 * s + 4]!, c2], coord, ctx);
  renderShapePolyline([c0, c2], coord, ctx);
}

/** TAB: top-left tab protrusion. @see shapes.c:760-791 */
export function drawTab(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const sides = af.length;
  const w = { x: (b[3]!.x - b[4]!.x) / 3, y: (b[3]!.y - b[4]!.y) / 3 };
  const D: Point[] = [af[0]!, b[2]!, vadd(b[2]!, w), vadd(b[3]!, w)];
  for (let seg = 4; seg < sides + 2; seg++) D.push(af[seg - 2]!);
  renderShapePolygon(D, coord, ctx, filled);
  renderShapePolyline([b[3]!, b[2]!], coord, ctx);
}

/** FOLDER: top folder-tab outline. @see shapes.c:793-821 */
export function drawFolder(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const sides = af.length;
  const dx = af[0]!.x - b[1]!.x;
  const wy = (b[3]!.y - b[4]!.y) / 3;
  // C sets D[4]=B[3] then the seg=4 loop overwrites it with AF[1] (==B[3]).
  const D: Point[] = [
    af[0]!,
    { x: af[0]!.x - dx / 4, y: af[0]!.y + wy },
    { x: af[0]!.x - 2 * dx, y: af[0]!.y + wy },
    { x: af[0]!.x - 2.25 * dx, y: b[3]!.y },
  ];
  for (let seg = 4; seg < sides + 3; seg++) D.push(af[seg - 3]!);
  renderShapePolygon(D, coord, ctx, filled);
}

/** BOX3D: cutoff corners + three depth lines. @see shapes.c:823-844 (sides==4) */
export function drawBox3d(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const D: Point[] = [af[0]!, b[2]!, b[4]!, af[2]!, b[8]!, b[10]!];
  renderShapePolygon(D, coord, ctx, filled);
  const c0 = vadd(b[1]!, vsub(b[11]!, b[0]!));
  renderShapePolyline([c0, b[4]!], coord, ctx);
  renderShapePolyline([c0, b[8]!], coord, ctx);
  renderShapePolyline([c0, b[0]!], coord, ctx);
}

/** COMPONENT: two side bays + their inner lines. @see shapes.c:846-905 (sides==4) */
export function drawComponent(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const u = vsub(b[4]!, b[3]!);
  const v = vsub(b[3]!, b[2]!);
  const D: Point[] = new Array<Point>(12);
  D[0] = af[0]!; D[1] = af[1]!;
  D[2] = vadd(b[3]!, u); D[3] = vadd(D[2], v); D[4] = vadd(D[3], u); D[5] = vadd(D[4], vsub(D[2], D[3]));
  const u2 = vsub(b[5]!, b[6]!);
  const v2 = vsub(b[6]!, b[7]!);
  D[9] = vadd(b[6]!, u2); D[8] = vadd(D[9], v2); D[7] = vadd(D[8], u2); D[6] = vadd(D[7], vsub(D[9], D[8]));
  D[10] = af[2]!; D[11] = af[3]!;
  renderShapePolygon(D, coord, ctx, filled);
  componentInnerLines(D, coord, ctx);
}

/** COMPONENT's two 4-point inner bay outlines. @see shapes.c:889-903 */
function componentInnerLines(D: Point[], coord: Point, ctx: ShapeCtx): void {
  const a1 = vsub(D[2]!, vsub(D[3]!, D[2]!));
  const a2 = vadd(a1, vsub(D[4]!, D[3]!));
  renderShapePolyline([D[2]!, a1, a2, D[5]!], coord, ctx);
  const b1 = vsub(D[6]!, vsub(D[7]!, D[6]!));
  const b2 = vadd(b1, vsub(D[8]!, D[7]!));
  renderShapePolyline([D[6]!, b1, b2, D[9]!], coord, ctx);
}

// ---------------------------------------------------------------------------
// Gene-expression SBOLv (filled polygon + dsDNA centre line)
// ---------------------------------------------------------------------------

/** PROMOTER: L-shaped arrow on the centre line. @see shapes.c:908-957 */
export function drawPromoter(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const mx = midX(af), my = midY1(af);
  const w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const D0 = { x: mx + (af[0]!.x - af[1]!.x) / 8, y: my + (w * 3) / 2 };
  const D1 = { x: mx - (af[0]!.x - af[1]!.x) / 4, y: D0.y };
  const D2 = { x: D1.x, y: my };
  const D3 = { x: D2.x + wx / 2, y: my };
  const D4 = { x: D3.x, y: my + w };
  const D5 = { x: D0.x, y: D4.y };
  const D6 = { x: D0.x, y: D4.y - w / 4 };
  const D7 = { x: D6.x + wx, y: D6.y + w / 2 };
  const D8 = { x: D0.x, y: D0.y + w / 4 };
  renderShapePolygon([D0, D1, D2, D3, D4, D5, D6, D7, D8], coord, ctx, filled);
  renderShapePolyline(dsDnaLine(af), coord, ctx);
}

/** TERMINATOR: centred T-shape. @see shapes.c:991-1033 */
export function drawTerminator(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const mx = midX(af), my = midY1(af);
  const w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const D0 = { x: mx + wx / 4, y: my };
  const D1 = { x: D0.x, y: D0.y + w / 2 };
  const D2 = { x: D1.x + wx / 2, y: D1.y };
  const D3 = { x: D2.x, y: D2.y + w / 2 };
  const D4 = { x: mx - (wx * 3) / 4, y: D3.y };
  const D5 = { x: D4.x, y: D2.y };
  const D6 = { x: mx - wx / 4, y: D1.y };
  const D7 = { x: D6.x, y: D0.y };
  renderShapePolygon([D0, D1, D2, D3, D4, D5, D6, D7], coord, ctx, filled);
  renderShapePolyline(dsDnaLine(af), coord, ctx);
}

/** UTR: centred half-octagon. @see shapes.c:1036-1073 */
export function drawUtr(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const mx = midX(af), my = midY1(af);
  const w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const D0 = { x: mx + (wx * 3) / 4, y: my };
  const D1 = { x: D0.x, y: D0.y + w / 4 };
  const D2 = { x: mx + wx / 4, y: D1.y + w / 2 };
  const D3 = { x: mx - wx / 4, y: D2.y };
  const D4 = { x: mx - (wx * 3) / 4, y: D1.y };
  const D5 = { x: D4.x, y: D0.y };
  renderShapePolygon([D0, D1, D2, D3, D4, D5], coord, ctx, filled);
  renderShapePolyline(dsDnaLine(af), coord, ctx);
}

/** INSULATOR: nested squares with split dsDNA. @see shapes.c:1455-1503 */
export function drawInsulator(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const mx = midX(af), my = midY1(af);
  const h = (b[2]!.x - b[3]!.x) / 2, q = ((b[2]!.x - b[3]!.x) * 3) / 4;
  const dy = af[2]!.y + (af[0]!.y - af[3]!.y) / 2;
  renderShapePolygon([
    { x: mx + h, y: my + h }, { x: mx + h, y: my - h },
    { x: mx - h, y: my - h }, { x: mx - h, y: my + h },
  ], coord, ctx, filled);
  renderShapePolyline([
    { x: mx + q, y: my + q }, { x: mx + q, y: my - q },
    { x: mx - q, y: my - q }, { x: mx - q, y: my + q }, { x: mx + q, y: my + q },
  ], coord, ctx);
  renderShapePolyline([{ x: mx + q, y: my }, { x: af[0]!.x, y: dy }], coord, ctx);
  renderShapePolyline([{ x: af[1]!.x, y: my }, { x: mx - q, y: dy }], coord, ctx);
}

// ---------------------------------------------------------------------------
// Shared geometry: 16-point X (ribosite/proteasesite), 8-point octagon
// (rnastab/proteinstab). Both add a stem line + dsDNA.
// ---------------------------------------------------------------------------

/** The 16-point "X" body. @see shapes.c:1517-1548 (ribosite ≡ proteasesite) */
function xShape(af: Point[], b: Point[]): Point[] {
  const mx = midX(af), my = midY1(af);
  const w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const D0 = { x: mx + wx / 4, y: my + w / 2 };
  const D1 = { x: D0.x, y: D0.y + w / 8 };
  const D2 = { x: D0.x - wx / 8, y: D1.y + w / 8 };
  const D3 = { x: D0.x, y: D2.y + w / 8 };
  const D4 = { x: D0.x, y: D3.y + w / 8 };
  const D5 = { x: D2.x, y: D4.y };
  const D6 = { x: mx, y: D3.y };
  const D7 = { x: D6.x - wx / 8, y: D5.y };
  const D8 = { x: D7.x - wx / 8, y: D7.y };
  const D9 = { x: D8.x, y: D3.y };
  const D10 = { x: D8.x + wx / 8, y: D2.y };
  const D11 = { x: D8.x, y: D1.y };
  const D12 = { x: D8.x, y: D0.y };
  const D13 = { x: D10.x, y: D12.y };
  const D14 = { x: D6.x, y: D1.y };
  const D15 = { x: D2.x, y: D0.y };
  return [D0, D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13, D14, D15];
}

/** The 8-point octagon body. @see shapes.c:1588-1603 (rnastab ≡ proteinstab) */
function octShape(af: Point[], b: Point[]): Point[] {
  const mx = midX(af), my = midY1(af);
  const w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const D0 = { x: mx + wx / 8, y: my + w / 2 };
  const D1 = { x: D0.x + wx / 8, y: D0.y + w / 8 };
  const D2 = { x: D1.x, y: D1.y + w / 4 };
  const D3 = { x: D0.x, y: D2.y + w / 8 };
  const D4 = { x: D3.x - wx / 4, y: D3.y };
  const D5 = { x: D4.x - wx / 8, y: D2.y };
  const D6 = { x: D5.x, y: D1.y };
  const D7 = { x: D4.x, y: D0.y };
  return [D0, D1, D2, D3, D4, D5, D6, D7];
}

/** RIBOSITE: X + 2-part dashed stem. @see shapes.c:1505-1573 */
export function drawRibosite(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const D = xShape(af, b);
  const my = midY1(af), w = b[3]!.y - b[4]!.y, cx = D[14]!.x;
  renderShapePolygon(D, coord, ctx, filled);
  renderShapePolyline([{ x: cx, y: my }, { x: cx, y: my + w / 8 }], coord, ctx);
  renderShapePolyline([{ x: cx, y: my + w / 4 }, { x: cx, y: my + w / 4 + w / 8 }], coord, ctx);
  renderShapePolyline(dsDnaLine(af), coord, ctx);
}

/** PROTEASESITE: X + solid stem. @see shapes.c:1633-1690 */
export function drawProteasesite(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const D = xShape(af, b);
  renderShapePolygon(D, coord, ctx, filled);
  renderShapePolyline([D[14]!, { x: D[14]!.x, y: midY1(af) }], coord, ctx);
  renderShapePolyline(dsDnaLine(af), coord, ctx);
}

/** RNASTAB: octagon + 2-part dashed stem. @see shapes.c:1576-1629 */
export function drawRnastab(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const D = octShape(af, b);
  const mx = midX(af), my = midY1(af), w = b[3]!.y - b[4]!.y;
  renderShapePolygon(D, coord, ctx, filled);
  renderShapePolyline([{ x: mx, y: my }, { x: mx, y: my + w / 8 }], coord, ctx);
  renderShapePolyline([{ x: mx, y: my + w / 4 }, { x: mx, y: my + w / 4 + w / 8 }], coord, ctx);
  renderShapePolyline(dsDnaLine(af), coord, ctx);
}

/** PROTEINSTAB: octagon + solid stem. @see shapes.c:1694-1736 */
export function drawProteinstab(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const D = octShape(af, b);
  const mx = midX(af);
  renderShapePolygon(D, coord, ctx, filled);
  renderShapePolyline([{ x: mx, y: D[0]!.y }, { x: mx, y: midY1(af) }], coord, ctx);
  renderShapePolyline(dsDnaLine(af), coord, ctx);
}
