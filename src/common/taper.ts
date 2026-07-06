// SPDX-License-Identifier: EPL-2.0
//
// Tapered edges — faithful port of lib/common/taper.c (based on lines.ps by
// Denis Moskowitz). Given an edge's first Bézier and a half-width radius
// function, returns a closed polygon that renders the spline as a tapered
// stroke (full width at one end, zero at the other). Used by the SVG edge
// emit for `style="tapered"`.
//
// @see lib/common/taper.c:taper

import type { Point, Bezier } from '../model/geom.js';

/** Sample points per Bézier segment. @see taper.c:BEZIERSUBDIVISION */
const BEZIER_SUBDIVISION = 20;
/** @see taper.c:currentmiterlimit */
const MITER_LIMIT = 10.0;
/** Degrees→radians, matching C's D2R macro. @see taper.c:D2R */
const D2R = (d: number): number => (Math.PI * d) / 180.0;

/** Half-width function along the curve. @see taper.c:radfunc_t */
export type RadFunc = (curlen: number, totallen: number, initwid: number) => number;

/** Taper from initwid/2 at the start to 0 at the end. @see taper.c:forfunc */
export const forfunc: RadFunc = (cur, total, init) => ((1 - cur / total) * init) / 2.0;
/** Taper from 0 to initwid/2. @see taper.c:revfunc */
export const revfunc: RadFunc = (cur, total, init) => ((cur / total) * init) / 2.0;
/** Constant half-width. @see taper.c:nonefunc */
export const nonefunc: RadFunc = (_cur, _total, init) => init / 2.0;
/** Widen to the midpoint then taper. @see taper.c:bothfunc */
export const bothfunc: RadFunc = (cur, total, init) => {
  const fr = cur / total;
  return fr <= 0.5 ? fr * init : (1 - fr) * init;
};

/**
 * Select the taper radius function from the edge's `dir`. Undirected graphs
 * default to `none`, directed to `forward`. @see taper.c:taperfun
 */
export function taperfun(dir: string | undefined, directed: boolean): RadFunc {
  if (dir === 'forward') return forfunc;
  if (dir === 'back') return revfunc;
  if (dir === 'both') return bothfunc;
  if (dir === 'none') return nonefunc;
  return directed ? forfunc : nonefunc;
}

/** atan2 mapped to [0, 2π), with (0,0)→0. @see taper.c:myatan */
function myatan(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const v = Math.atan2(y, x);
  return v >= 0 ? v : v + 2 * Math.PI;
}

/** Float modulus that maps negatives positive. @see taper.c:mymod */
function mymod(original: number, modulus: number): number {
  if (original < 0 || original >= modulus) {
    const v = -Math.floor(original / modulus);
    return v * modulus + original;
  }
  return original;
}

/** Euclidean distance. @see taper.c:l2dist */
function l2dist(p0: Point, p1: Point): number {
  return Math.hypot(p0.x - p1.x, p0.y - p1.y);
}

/** Evaluate a cubic Bézier at t via de Casteljau. @see lib/common/utils.c:Bezier */
function bezierPoint(v: readonly Point[], t: number): Point {
  const vx = [v[0]!.x, v[1]!.x, v[2]!.x, v[3]!.x];
  const vy = [v[0]!.y, v[1]!.y, v[2]!.y, v[3]!.y];
  for (let i = 1; i <= 3; i++) {
    for (let j = 0; j <= 3 - i; j++) {
      vx[j] = (1.0 - t) * vx[j]! + t * vx[j + 1]!;
      vy[j] = (1.0 - t) * vy[j]! + t * vy[j + 1]!;
    }
  }
  return { x: vx[0]!, y: vy[0]! };
}

interface PathPoint {
  x: number;
  y: number;
  lengthsofar: number;
  dir: number;
  lout: number;
  bevel: boolean;
  dir2: number;
}

/**
 * Turn the Bézier into a polyline, recording cumulative arc length per point.
 * @see taper.c:pathtolines
 */
function pathtolines(bez: Bezier): PathPoint[] {
  const arr: PathPoint[] = [];
  const A = bez.list;
  const n = bez.size;
  const push = (p: Point, l: number): void => {
    arr.push({ x: p.x, y: p.y, lengthsofar: l, dir: 0, lout: 0, bevel: false, dir2: 0 });
  };
  push(A[0]!, 0);
  const V: Point[] = [A[0]!, A[0]!, A[0]!, A[0]!];
  let linelen = 0;
  for (let i = 0; i + 3 < n; i += 3) {
    V[0] = V[3]!;
    for (let j = 1; j <= 3; j++) V[j] = A[i + j]!;
    let p0 = V[0]!;
    for (let step = 1; step <= BEZIER_SUBDIVISION; step++) {
      const p1 = bezierPoint(V, step / BEZIER_SUBDIVISION);
      linelen += l2dist(p0, p1);
      push(p1, linelen);
      p0 = p1;
    }
  }
  return arr;
}

/**
 * Miter/bevel geometry for one interior point (i not an endpoint). Writes
 * dir/lout/bevel/dir2 onto pp[i]. @see taper.c:taper (interior branch)
 */
function annotateInterior(
  pp: PathPoint[], i: number, ndir: number, ldir: number, linerad: number,
): void {
  let theta = ndir - ldir;
  if (theta < 0) theta += D2R(360);
  const phi = D2R(90) - theta / 2;
  let lineout = Math.cos(phi) === 0 ? 0 : linerad / Math.cos(phi);
  let direction = ndir + D2R(90) + phi;
  let direction2 = direction;
  let bevel = false;
  if (lineout > MITER_LIMIT * linerad) {
    bevel = i !== pp.length - 1;
    lineout = linerad;
    direction = mymod(ldir - D2R(90), D2R(360));
    direction2 = mymod(ndir + D2R(90), D2R(360));
  }
  pp[i]!.dir = direction;
  pp[i]!.lout = lineout;
  pp[i]!.bevel = bevel;
  pp[i]!.dir2 = direction2;
}

/**
 * First pass: determine each point's miter/bevel offset direction and length.
 * @see taper.c:taper (first for-loop)
 */
function annotate(pp: PathPoint[], linelen: number, radfunc: RadFunc, initwid: number): void {
  const count = pp.length;
  for (let i = 0; i < count; i++) {
    const l = i === 0 ? count - 1 : i - 1;
    const next = (i + 1) % count;
    const { x, y, lengthsofar } = pp[i]!;
    const ndir = myatan(pp[next]!.y - y, pp[next]!.x - x);
    const ldir = myatan(pp[l]!.y - y, pp[l]!.x - x);
    const linerad = radfunc(lengthsofar, linelen, initwid);
    if (i === 0 || i === count - 1) {
      const direction = i === 0 ? ndir + D2R(90) : ldir - D2R(90);
      pp[i]!.dir = direction;
      pp[i]!.lout = linerad;
      pp[i]!.dir2 = direction;
    } else {
      annotateInterior(pp, i, ndir, ldir, linerad);
    }
  }
}

/**
 * Append a bevel vertex at angle `a2`. C's drawbevel picks a2 = dir2 when
 * forward (side 1), else dir (side 2); the caller passes the resolved angle.
 * The `x`-for-y in the second coordinate faithfully reproduces C's drawbevel,
 * which is handed only x, not y. @see taper.c:drawbevel
 */
function drawbevel(out: Point[], x: number, lineout: number, a2: number): void {
  out.push({ x: x + lineout * Math.cos(a2), y: x + lineout * Math.sin(a2) });
}

/**
 * Second pass: emit side 1, the end cap, and side 2 as one closed polygon.
 * @see taper.c:taper (second/third for-loops)
 */
function emitStroke(pp: PathPoint[]): Point[] {
  const out: Point[] = [];
  const count = pp.length;
  let x = 0, y = 0, direction = 0, lineout = 0;
  for (let i = 0; i < count; i++) {
    ({ x, y, dir: direction, lout: lineout } = pp[i]!);
    out.push({ x: x + Math.cos(direction) * lineout, y: y + Math.sin(direction) * lineout });
    if (pp[i]!.bevel) drawbevel(out, x, lineout, pp[i]!.dir2); // forward: a2 = dir2
  }
  // end circle
  direction += D2R(180);
  out.push({ x: x + Math.cos(direction) * lineout, y: y + Math.sin(direction) * lineout });
  // side 2
  for (let i = count - 2; i >= 0; i--) {
    const cur = pp[i]!;
    x = cur.x;
    y = cur.y;
    direction = cur.dir + D2R(180);
    const direction2 = cur.dir2 + D2R(180);
    lineout = cur.lout;
    out.push({ x: x + Math.cos(direction2) * lineout, y: y + Math.sin(direction2) * lineout });
    if (cur.bevel) drawbevel(out, x, lineout, direction); // side 2 (not forward): a2 = dir
  }
  return out;
}

/**
 * Given a Bézier `bez`, return a polygon representing the spline as a tapered
 * edge of starting width `initwid`; `radfunc` sets the half-width along the
 * curve. @see taper.c:taper
 */
export function taper(bez: Bezier, radfunc: RadFunc, initwid: number): Point[] {
  const pp = pathtolines(bez);
  const linelen = pp[pp.length - 1]!.lengthsofar;
  annotate(pp, linelen, radfunc, initwid);
  return emitStroke(pp);
}
