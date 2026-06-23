// SPDX-License-Identifier: EPL-2.0
//
// Drawing-scale (viewport fit) for the `size=` graph attribute. Ports the parse
// (getdoubles2ptf) and the zoom factor Z (init_job_viewport) so SVG output is
// fitted to the requested size, exactly as native `dot` does. The zoom is
// carried by the SVG group transform, never by the coordinates (decisions D4).
//
// @see lib/common/input.c:476 getdoubles2ptf
// @see lib/common/emit.c:3356 init_job_viewport

import type { Box } from '../model/geom.js';
import { POINTS_PER_INCH } from '../model/geom.js';
import { SVG_PAD } from '../render/svg-helpers.js';

/** Parsed `size=` drawing size in points, plus the *filled* flag. */
export interface DrawingSize {
  x: number;
  y: number;
  filled: boolean;
}

/** A C-`sscanf("%lf")`-style float token (sign, digits, optional exponent). */
const FLOAT = '[-+]?[0-9.]+(?:[eE][-+]?[0-9]+)?';
/** sscanf("%lf,%lf%c"): two floats (whitespace-tolerant) then the next char. */
const SIZE_XY_RE = new RegExp(`^\\s*(${FLOAT})\\s*,\\s*(${FLOAT})(.?)`);
/** sscanf("%lf%c"): a lone float (square box) then the next char. */
const SIZE_X_RE = new RegExp(`^\\s*(${FLOAT})(.?)`);

/** Inches→points exactly as C's POINTS macro: ROUND(in * 72). @see geom.h:62 */
function toPoints(inches: number): number {
  return Math.round(inches * POINTS_PER_INCH);
}

/**
 * Port of getdoubles2ptf(g, "size", …) for the `size=` attribute: parse
 * `"x,y"` (or a lone `"x"` meaning square), convert inches→points, and treat a
 * trailing `!` as the *filled* flag. Returns null when `size` is absent or
 * non-positive (Z stays 1 — D5).
 * @see lib/common/input.c:476 getdoubles2ptf
 */
export function parseDrawingSize(raw: string | undefined): DrawingSize | null {
  if (raw === undefined) return null;
  const xy = SIZE_XY_RE.exec(raw);
  if (xy) {
    const xf = Number(xy[1]);
    const yf = Number(xy[2]);
    if (xf > 0 && yf > 0) return { x: toPoints(xf), y: toPoints(yf), filled: xy[3] === '!' };
  }
  const x = SIZE_X_RE.exec(raw);
  if (x) {
    const xf = Number(x[1]);
    if (xf > 0) return { x: toPoints(xf), y: toPoints(xf), filled: x[2] === '!' };
  }
  return null;
}

/**
 * Whether the drawing needs scaling to fit `size`: too big in either axis, or
 * (when *filled*) too small in both. @see lib/common/emit.c:3380-3382
 */
function drawingNeedsFit(size: DrawingSize, szx: number, szy: number): boolean {
  const tooBig = size.x < szx || size.y < szy;
  const fillsUp = size.filled && size.x > szx && size.y > szy;
  return tooBig || fillsUp;
}

/**
 * Port of init_job_viewport's zoom factor Z (emit.c:3375-3384). When the user
 * gave a `size=`, fit the drawing (size `sz` = bb plus pad, in points) into it.
 * Z stays 1.0 otherwise, leaving every non-`size` byte unchanged (D5). SVG
 * carries Z via the group transform, not the coordinates (D4).
 * @see lib/common/emit.c:3356 init_job_viewport
 */
export function initJobViewportZoom(bb: Box, size: DrawingSize | null): number {
  if (size === null || size.x <= 0.001 || size.y <= 0.001) return 1.0;
  // sz = bb extent including the pad the SVG emit adds on every side.
  let szx = bb.ur.x - bb.ll.x + 2 * SVG_PAD;
  let szy = bb.ur.y - bb.ll.y + 2 * SVG_PAD;
  if (szx <= 0.001) szx = size.x;
  if (szy <= 0.001) szy = size.y;
  if (drawingNeedsFit(size, szx, szy)) return Math.min(size.x / szx, size.y / szy);
  return 1.0;
}
