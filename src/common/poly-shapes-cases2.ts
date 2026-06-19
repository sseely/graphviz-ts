// SPDX-License-Identifier: EPL-2.0
//
// Per-shape vertex generators (part 2): DNA construction symbols and the
// arrow/promoter family. Verbatim ports of the round_corners switch cases
// (lib/common/shapes.c:1076-1454, 1741-1889). See poly-shapes-cases.ts for the
// box and gene-expression families.

import type { Point } from '../model/geom.js';
import {
  type ShapeCtx, renderShapePolygon, renderShapePolyline,
  midX, midY1, dsDnaLine, rect, dnaY,
} from './poly-shapes-util.js';

// ---------------------------------------------------------------------------
// DNA construction symbols
// ---------------------------------------------------------------------------

/** PRIMERSITE: half-arrow, scales in x. @see shapes.c:1076-1112 */
export function drawPrimersite(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const mx = midX(af), my = midY1(af);
  const w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const D0 = { x: mx + wx, y: my + w / 4 };
  const D1 = { x: D0.x - wx, y: D0.y + w };
  const D2 = { x: D1.x, y: D0.y + w / 2 };
  const D3 = { x: mx - (af[0]!.x - af[1]!.x) / 4, y: D2.y };
  const D4 = { x: D3.x, y: D0.y };
  renderShapePolygon([D0, D1, D2, D3, D4], coord, ctx, filled);
  renderShapePolyline(dsDnaLine(af), coord, ctx);
}

/** RESTRICTIONSITE: zigzag with split dsDNA. @see shapes.c:1115-1163 */
export function drawRestrictionsite(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const mx = midX(af), my = midY1(af), sw = (af[0]!.x - af[1]!.x) / 8;
  const w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const D0 = { x: mx + sw + wx / 2, y: my + w / 4 };
  const D1 = { x: mx - sw, y: D0.y };
  const D2 = { x: D1.x, y: D1.y + w / 2 };
  const D3 = { x: D2.x - wx / 2, y: D2.y };
  const D4 = { x: D3.x, y: my - w / 4 };
  const D5 = { x: D0.x - wx / 2, y: D4.y };
  const D6 = { x: D5.x, y: D5.y - w / 2 };
  const D7 = { x: D0.x, y: D6.y };
  renderShapePolygon([D0, D1, D2, D3, D4, D5, D6, D7], coord, ctx, filled);
  renderShapePolyline([{ x: af[1]!.x, y: my }, { x: D4.x, y: dnaY(af) }], coord, ctx);
  renderShapePolyline([{ x: D7.x, y: my }, { x: af[0]!.x, y: dnaY(af) }], coord, ctx);
}

/** FIVEPOVERHANG: two left rects + right dsDNA. @see shapes.c:1167-1213 */
export function drawFivepoverhang(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const my = midY1(af), w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  renderShapePolygon(rect(af[1]!.x, my + w / 8, 2 * wx, w / 2), coord, ctx, filled);
  const r2 = rect(af[1]!.x + wx, my - (w * 5) / 8, wx, w / 2);
  renderShapePolygon(r2, coord, ctx, filled);
  renderShapePolyline([{ x: r2[1]!.x, y: my }, { x: af[0]!.x, y: dnaY(af) }], coord, ctx);
}

/** THREEPOVERHANG: two right rects + left dsDNA. @see shapes.c:1217-1263 */
export function drawThreepoverhang(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const my = midY1(af), w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const a0 = { x: af[0]!.x, y: my + w / 8 };
  const a1 = { x: a0.x, y: a0.y + w / 2 };
  renderShapePolygon([a0, a1, { x: a1.x - 2 * w, y: a1.y }, { x: a1.x - 2 * w, y: a0.y }], coord, ctx, filled);
  const c0 = { x: af[0]!.x - wx, y: my - (w * 5) / 8 };
  const c1 = { x: c0.x, y: c0.y + w / 2 };
  const c2x = c1.x - w;
  renderShapePolygon([c0, c1, { x: c2x, y: c1.y }, { x: c2x, y: c0.y }], coord, ctx, filled);
  renderShapePolyline([{ x: af[1]!.x, y: my }, { x: c2x, y: dnaY(af) }], coord, ctx);
}

/** NOVERHANG: four rects + split dsDNA. @see shapes.c:1267-1348 */
export function drawNoverhang(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const mx = midX(af), my = midY1(af), w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const lx = mx - (wx * 9) / 8, rx = mx + wx / 8;
  const top = my + w / 8, bot = my - (w * 5) / 8;
  for (const [x, y] of [[lx, top], [lx, bot], [rx, bot], [rx, top]] as const) {
    renderShapePolygon(rect(x, y, wx, w / 2), coord, ctx, filled);
  }
  renderShapePolyline([{ x: rx + wx, y: my }, { x: af[0]!.x, y: dnaY(af) }], coord, ctx);
  renderShapePolyline([{ x: lx, y: my }, { x: af[1]!.x, y: dnaY(af) }], coord, ctx);
}

/** ASSEMBLY: two centred rects + split dsDNA. @see shapes.c:1352-1404 */
export function drawAssembly(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const mx = midX(af), my = midY1(af), w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  const x0 = mx - wx;
  renderShapePolygon(rect(x0, my + w / 8, 2 * wx, w / 2), coord, ctx, filled);
  renderShapePolygon(rect(x0, my - (w * 5) / 8, 2 * wx, w / 2), coord, ctx, filled);
  renderShapePolyline([{ x: x0 + 2 * wx, y: my }, { x: af[0]!.x, y: dnaY(af) }], coord, ctx);
  renderShapePolyline([{ x: af[1]!.x, y: my }, { x: x0, y: dnaY(af) }], coord, ctx);
}

/** SIGNATURE: box + "X" + bottom line. @see shapes.c:1408-1451 */
export function drawSignature(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const my = midY1(af), w = b[3]!.y - b[4]!.y, wx = b[2]!.x - b[3]!.x;
  renderShapePolygon([
    { x: af[0]!.x, y: b[1]!.y - w / 2 },
    { x: b[3]!.x, y: b[3]!.y - w / 2 },
    { x: af[2]!.x, y: af[2]!.y + w / 2 },
    { x: af[0]!.x, y: af[2]!.y + w / 2 },
  ], coord, ctx, filled);
  const xl = af[1]!.x + wx / 4;
  renderShapePolyline([{ x: xl, y: my + w / 8 }, { x: xl + wx / 4, y: my + w / 8 - w / 4 }], coord, ctx);
  renderShapePolyline([{ x: xl, y: my - w / 8 }, { x: xl + wx / 4, y: my - w / 8 + w / 4 }], coord, ctx);
  const by = af[2]!.y + (w * 3) / 4;
  renderShapePolyline([{ x: xl, y: by }, { x: af[0]!.x - wx / 4, y: by }], coord, ctx);
}

// ---------------------------------------------------------------------------
// Arrow / promoter family (single filled polygon, triangle point on one end)
// ---------------------------------------------------------------------------

/** RPROMOTER: right-pointing arrow with a tab. @see shapes.c:1741-1777 */
export function drawRpromoter(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const w = b[3]!.y - b[4]!.y, hw = (b[2]!.x - b[3]!.x) / 2;
  const lx = b[1]!.x - hw, rx = b[2]!.x + hw;
  renderShapePolygon([
    { x: lx, y: b[1]!.y - w / 2 },
    { x: b[3]!.x, y: b[3]!.y - w / 2 },
    { x: af[2]!.x, y: af[2]!.y },
    { x: rx, y: af[2]!.y },
    { x: rx, y: af[2]!.y + w / 2 },
    { x: lx, y: af[2]!.y + w / 2 },
    { x: lx, y: af[3]!.y },
    { x: af[0]!.x, y: af[0]!.y - (af[0]!.y - af[3]!.y) / 2 },
    { x: lx, y: af[0]!.y },
  ], coord, ctx, filled);
}

/** RARROW: right-pointing arrow. @see shapes.c:1781-1813 */
export function drawRarrow(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const w = b[3]!.y - b[4]!.y, lx = b[1]!.x - (b[2]!.x - b[3]!.x) / 2;
  renderShapePolygon([
    { x: lx, y: b[1]!.y - w / 2 },
    { x: b[3]!.x, y: b[3]!.y - w / 2 },
    { x: af[2]!.x, y: af[2]!.y + w / 2 },
    { x: lx, y: af[2]!.y + w / 2 },
    { x: lx, y: af[3]!.y },
    { x: af[0]!.x, y: af[0]!.y - (af[0]!.y - af[3]!.y) / 2 },
    { x: lx, y: af[0]!.y },
  ], coord, ctx, filled);
}

/** Shared head of LARROW / LPROMOTER (D[0..5], left-pointing arrow body). */
function leftArrowHead(af: Point[], b: Point[]): Point[] {
  const w = b[3]!.y - b[4]!.y, rx = b[2]!.x + (b[2]!.x - b[3]!.x) / 2;
  return [
    { x: af[0]!.x, y: af[0]!.y - w / 2 },
    { x: rx, y: af[0]!.y - w / 2 },
    { x: rx, y: b[2]!.y },
    { x: af[1]!.x, y: af[1]!.y - (af[1]!.y - af[2]!.y) / 2 },
    { x: rx, y: af[2]!.y },
    { x: rx, y: af[2]!.y + w / 2 },
  ];
}

/** LARROW: left-pointing arrow. @see shapes.c:1817-1847 */
export function drawLarrow(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const w = b[3]!.y - b[4]!.y;
  const D = leftArrowHead(af, b);
  D.push({ x: af[0]!.x, y: af[3]!.y + w / 2 });
  renderShapePolygon(D, coord, ctx, filled);
}

/** LPROMOTER: left-pointing arrow with a tab. @see shapes.c:1851-1887 */
export function drawLpromoter(af: Point[], b: Point[], coord: Point, filled: boolean, ctx: ShapeCtx): void {
  const w = b[3]!.y - b[4]!.y, lx = b[1]!.x - (b[2]!.x - b[3]!.x) / 2;
  const D = leftArrowHead(af, b);
  D.push({ x: lx, y: af[3]!.y + w / 2 }, { x: lx, y: af[3]!.y }, { x: af[3]!.x, y: af[3]!.y });
  renderShapePolygon(D, coord, ctx, filled);
}
