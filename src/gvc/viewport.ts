// SPDX-License-Identifier: EPL-2.0
//
// Drawing-scale (viewport fit) for the `size=` graph attribute. Ports the parse
// (getdoubles2ptf) and the zoom factor Z (init_job_viewport) so SVG output is
// fitted to the requested size, exactly as native `dot` does. The zoom is
// carried by the SVG group transform, never by the coordinates (decisions D4).
//
// Also ports the `pad=` graph-attribute parse (init_gvc's attr read +
// init_job_pad's fallback), threaded into the fit computation exactly as C's
// init_job_viewport does (job->bb = graph bb expanded by job->pad on every
// side before the size= fit is computed).
//
// @see lib/common/input.c:476 getdoubles2ptf
// @see lib/common/emit.c:3356 init_job_viewport
// @see lib/common/emit.c:3230-3251 init_gvc (pad attr read)
// @see lib/common/emit.c:3290-3304 init_job_pad

import type { Box, Point } from '../model/geom.js';
import { POINTS_PER_INCH } from '../model/geom.js';
import { SVG_PAD } from '../render/svg-helpers.js';
import type { Graph } from '../model/graph.js';

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
/** sscanf("%lf,%lf") without the trailing-char capture used by `pad=`. */
const PAD_XY_RE = new RegExp(`^\\s*(${FLOAT})\\s*,\\s*(${FLOAT})`);
/** sscanf("%lf") without the trailing-char capture used by `pad=`. */
const PAD_X_RE = new RegExp(`^\\s*(${FLOAT})`);

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
 * Port of the `pad=` graph-attribute parse: init_gvc reads it via
 * `sscanf(p, "%lf,%lf", &xf, &yf)` (2 values matched → both axes
 * independently; 1 value → y = x; 0 matched — attr absent or unparsable —
 * leaves `graph_sets_pad` false) and init_job_pad falls back to the SVG
 * plugin's `default_pad` (this port's only renderer) when unset, which is
 * numerically identical to `DEFAULT_GRAPH_PAD` (4pt) — so the two C fallback
 * branches collapse to the same constant here (`SVG_PAD`).
 *
 * Unlike `size=`, pad values are NOT rounded (`xf * POINTS_PER_INCH`
 * directly — no `POINTS()` macro) and are not required to be positive.
 *
 * @see lib/common/emit.c:3241-3251 init_gvc (pad attr read)
 * @see lib/common/emit.c:3290-3304 init_job_pad (fallback)
 */
export function parseGraphPad(raw: string | undefined): Point {
  if (raw !== undefined) {
    const xy = PAD_XY_RE.exec(raw);
    if (xy) {
      return { x: Number(xy[1]) * POINTS_PER_INCH, y: Number(xy[2]) * POINTS_PER_INCH };
    }
    const x = PAD_X_RE.exec(raw);
    if (x) {
      const v = Number(x[1]) * POINTS_PER_INCH;
      return { x: v, y: v };
    }
  }
  return { x: SVG_PAD, y: SVG_PAD };
}

/**
 * Port of `mapbool` for the `landscape=` branch only: falsy spellings →
 * false, truthy spellings → true, else `atoi(s) != 0`. Kept local (not imported
 * from layout/dot) to avoid pulling the layout engine into this leaf module.
 * @see lib/common/utils.c:mapbool
 */
function landscapeMapbool(s: string): boolean {
  const v = s.toLowerCase();
  if (v === '' || v === 'false' || v === 'no') return false;
  if (v === 'true' || v === 'yes') return true;
  return Number.parseInt(s, 10) !== 0;
}

/**
 * Port of the landscape detection in `input.c`: `rotate=90`, or
 * `orientation` starting with `l`/`L`, or a truthy `landscape`. Each branch is
 * mutually exclusive in the same precedence as C (rotate wins over orientation
 * wins over landscape). Returns false when no rotation attribute is present.
 * This flag is **emit-only** — it drives `job.rotation`, never layout (ADR-1).
 * @see lib/common/input.c:699-704
 */
export function parseLandscape(g: Graph): boolean {
  const rotate = g.attrs.get('rotate');
  if (rotate !== undefined) return Number.parseInt(rotate, 10) === 90;
  const orientation = g.attrs.get('orientation');
  if (orientation !== undefined) {
    return orientation[0] === 'l' || orientation[0] === 'L';
  }
  const landscape = g.attrs.get('landscape');
  if (landscape !== undefined) return landscapeMapbool(landscape);
  return false;
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
 * carries Z via the group transform, not the coordinates (D4). `pad` is the
 * resolved `job.pad` (parseGraphPad), matching C's `job->bb = bb ± job->pad`
 * before `sz = job->bb.UR - job->bb.LL` (emit.c:3363-3368).
 * @see lib/common/emit.c:3356 init_job_viewport
 */
export function initJobViewportZoom(bb: Box, size: DrawingSize | null, pad: Point): number {
  if (size === null || size.x <= 0.001 || size.y <= 0.001) return 1.0;
  // sz = bb extent including the pad the SVG emit adds on every side.
  let szx = bb.ur.x - bb.ll.x + 2 * pad.x;
  let szy = bb.ur.y - bb.ll.y + 2 * pad.y;
  if (szx <= 0.001) szx = size.x;
  if (szy <= 0.001) szy = size.y;
  if (drawingNeedsFit(size, szx, szy)) return Math.min(size.x / szx, size.y / szy);
  return 1.0;
}
