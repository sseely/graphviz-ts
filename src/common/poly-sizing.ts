// SPDX-License-Identifier: EPL-2.0

/**
 * Label-driven node sizing — a faithful port of the sizing portion of
 * poly_init. Computes the node bounding box from the label dimensions
 * and node attributes, then converts to lw/rw/ht via gv_nodesize.
 *
 * Not ported (no TS counterpart yet, no suite coverage):
 * - poly_desc size_gen/vertex_gen hooks (cylinder) — C falls back to the
 *   generic ellipse expansion here instead.
 * - usershape/image sizing (gvusershape_size) — needs an image loader.
 *
 * @see lib/common/shapes.c:poly_init
 * @see lib/common/utils.c:gv_nodesize
 */

import type { Point } from '../model/geom.js';

/** Whitespace in points around labels / between peripheries. @see lib/common/const.h:GAP */
export const GAP = 4;
/** @see lib/common/macros.h:XPAD */
const XPAD = 4 * GAP;
/** @see lib/common/macros.h:YPAD */
const YPAD = 2 * GAP;
/** @see lib/common/arith.h:SQRT2 */
const SQRT2 = 1.41421356237309504880;
/** Points per inch. @see lib/common/geom.h:INCH2PS */
const INCH2PS = 72;

/**
 * Inputs for polySize, mirroring what poly_init reads from the node.
 * All lengths are in points unless suffixed `In` (inches).
 */
export interface PolySizeParams {
  /** Label size in points. @see ND_label(n)->dimen */
  labelDimen: Point;
  /** Effective polygon sides after attr resolution (0 means attr-driven). */
  sides: number;
  /** Periphery count after the peripheries attr override. */
  peripheries: number;
  /** Orientation in degrees (shape base + orientation attr). */
  orientation: number;
  /** Distortion factor. */
  distortion: number;
  /** Skew factor. */
  skew: number;
  /** Shape regular flag OR'd with the regular attr. */
  regular: boolean;
  /** True for shape=plain. @see lib/common/shapes.c:IS_PLAIN */
  isPlain: boolean;
  /** width attr in inches (default 0.75, min 0.01). */
  widthIn: number;
  /** height attr in inches (default 0.5, min 0.02). */
  heightIn: number;
  /** INCH2PS(max(width attr, height attr)), 0 when unset. @see shapes.c:userSize */
  userSizePts: number;
  /** Raw margin attr (inches, "x" or "x,y"), undefined when unset. */
  margin: string | undefined;
  /** fixedsize attr (default "false"). */
  fixedsize: string;
  /** labelloc attr, undefined when unset. */
  labelloc: string | undefined;
  /** Graph quantum attr in inches (0 disables quantization). */
  quantumIn: number;
  /** True when rankdir flips coordinates. @see GD_flip */
  flip: boolean;
}

/** Node geometry in points: left/right half-widths and height. */
export interface NodeSize {
  lw: number;
  rw: number;
  ht: number;
}

/** @see lib/common/utils.c:mapbool */
function mapbool(s: string | undefined): boolean {
  if (!s || s.toLowerCase() === 'false' || s.toLowerCase() === 'no') return false;
  if (s.toLowerCase() === 'true' || s.toLowerCase() === 'yes') return true;
  const n = parseInt(s, 10);
  return !Number.isNaN(n) && n !== 0;
}

/**
 * Initial width/height in points from the width/height attrs,
 * the regular flag, and the plain special case.
 * @see lib/common/shapes.c:poly_init (width/height setup)
 */
export function initialSizePts(p: PolySizeParams): { width: number; height: number } {
  if (p.isPlain) return { width: 0, height: 0 };
  if (p.regular) {
    if (p.userSizePts > 0) return { width: p.userSizePts, height: p.userSizePts };
    const m = INCH2PS * Math.min(p.widthIn, p.heightIn);
    return { width: m, height: m };
  }
  return { width: INCH2PS * p.widthIn, height: INCH2PS * p.heightIn };
}

/** Parse the margin attr like sscanf("%lf,%lf"); null means PAD instead. */
function parseMargin(margin: string | undefined): Point | null {
  if (margin === undefined) return null;
  const mx = parseFloat(margin);
  if (Number.isNaN(mx)) return null;
  const comma = margin.indexOf(',');
  const my = comma >= 0 ? parseFloat(margin.slice(comma + 1)) : NaN;
  const x = Math.max(mx, 0);
  return { x, y: Number.isNaN(my) ? x : Math.max(my, 0) };
}

/**
 * Add minimal whitespace around the label: the margin attr in inches,
 * or PAD (16x8 points) when unset. Plain shapes get no padding.
 * @see lib/common/shapes.c:poly_init (margin/PAD block)
 */
export function padLabelDimen(
  labelDimen: Point,
  margin: string | undefined,
  isPlain: boolean,
): Point {
  const d = { x: labelDimen.x, y: labelDimen.y };
  if ((d.x > 0 || d.y > 0) && !isPlain) {
    const m = parseMargin(margin);
    if (m) {
      d.x += 2 * INCH2PS * m.x;
      d.y += 2 * INCH2PS * m.y;
    } else {
      d.x += XPAD;
      d.y += YPAD;
    }
  }
  return d;
}

/** Round up to a multiple of the quantum (inches). @see lib/common/shapes.c:quant */
function quantize(d: Point, quantumIn: number): Point {
  if (quantumIn <= 0) return d;
  const q = INCH2PS * quantumIn;
  return { x: Math.ceil(d.x / q) * q, y: Math.ceil(d.y / q) * q };
}

/**
 * Expand bb so the smallest ellipse (or inscribing polygon) centered on
 * the origin contains the label box. Boxes are exempt (exact fit).
 * @see lib/common/shapes.c:poly_init (ellipse/polygon expansion)
 */
export function expandForShape(
  bb: Point,
  sides: number,
  heightPts: number,
  valign: string,
): Point {
  const b = { x: bb.x, y: bb.y };
  const temp = b.y * SQRT2;
  if (heightPts > temp && valign === 'c') {
    // spare height + vertically centered label: pad x only
    b.x *= Math.sqrt(1 / (1 - (b.y / heightPts) ** 2));
  } else {
    b.x *= SQRT2;
    b.y = temp;
  }
  if (sides > 2) {
    const c = Math.cos(Math.PI / sides);
    b.x /= c;
    b.y /= c;
  }
  return b;
}

/** Grow an ellipse bb by GAP per extra periphery. @see shapes.c:poly_init (sides < 3) */
function ellipsePeripheryBB(bb: Point, peripheries: number): Point {
  if (peripheries <= 1) return bb;
  const grow = 2 * GAP * (peripheries - 1);
  return { x: bb.x + grow, y: bb.y + grow };
}

/**
 * Unit-polygon vertex loop: distort, skew, orient, then scale by bb.
 * Returns the scaled vertices and the bounding half-extents.
 * @see lib/common/shapes.c:poly_init (polygon vertex loop)
 */
export function polygonVertices(
  bb: Point,
  sides: number,
  orientation: number,
  distortion: number,
  skew: number,
  isBox: boolean,
): { verts: Point[]; xmax: number; ymax: number } {
  const sectorangle = (2 * Math.PI) / sides;
  const sidelength = Math.sin(sectorangle / 2);
  const skewdist = Math.hypot(Math.abs(distortion) + Math.abs(skew), 1);
  const gdistortion = (distortion * SQRT2) / Math.cos(sectorangle / 2);
  const gskew = skew / 2;
  let angle = (sectorangle - Math.PI) / 2;
  const R = { x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) };
  angle += (Math.PI - sectorangle) / 2;
  let xmax = 0;
  let ymax = 0;
  const verts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    angle += sectorangle;
    R.x += sidelength * Math.cos(angle);
    R.y += sidelength * Math.sin(angle);
    const D = { x: R.x * (skewdist + R.y * gdistortion) + R.y * gskew, y: R.y };
    const alpha = (orientation * Math.PI) / 180 + Math.atan2(D.y, D.x);
    const r = Math.hypot(D.x, D.y);
    const P = { x: r * Math.cos(alpha) * bb.x, y: r * Math.sin(alpha) * bb.y };
    xmax = Math.max(Math.abs(P.x), xmax);
    ymax = Math.max(Math.abs(P.y), ymax);
    verts.push(P);
    if (isBox) {
      // enforce exact symmetry of box
      verts.push({ x: -P.x, y: P.y }, { x: -P.x, y: -P.y }, { x: P.x, y: -P.y });
      break;
    }
  }
  return { verts, xmax, ymax };
}

/**
 * Grow a polygon bb to cover the outermost periphery ring. Each base
 * vertex is offset along its angle bisector by GAP per periphery.
 * @see lib/common/shapes.c:poly_init (peripheries bisector loop)
 */
export function polygonPeripheryBB(
  verts: Point[],
  sides: number,
  peripheries: number,
  bb: Point,
): Point {
  let R = verts[0];
  let Q = R;
  for (let j = 1; j < sides; j++) {
    Q = verts[(sides - j) % sides];
    if (Q.x !== R.x || Q.y !== R.y) break;
  }
  let beta = Math.atan2(R.y - Q.y, R.x - Q.x);
  let Qprev = Q;
  let sinx = 0;
  let cosx = 0;
  const out = { x: bb.x, y: bb.y };
  for (let i = 0; i < sides; i++) {
    const V = verts[i];
    if (V.x !== Qprev.x || V.y !== Qprev.y) {
      // degenerate sides keep the previous offset (cylinder-style shapes)
      for (let j = 1; j < sides; j++) {
        R = verts[(i + j) % sides];
        if (R.x !== V.x || R.y !== V.y) break;
      }
      const alpha = beta;
      beta = Math.atan2(R.y - V.y, R.x - V.x);
      const gamma = (alpha + Math.PI - beta) / 2;
      const temp = GAP / Math.sin(gamma);
      sinx = Math.sin(alpha - gamma) * temp;
      cosx = Math.cos(alpha - gamma) * temp;
    }
    Qprev = V;
    const off = peripheries - 1;
    const P = { x: V.x + off * cosx, y: V.y + off * sinx };
    out.x = Math.max(2 * Math.abs(P.x), out.x);
    out.y = Math.max(2 * Math.abs(P.y), out.y);
  }
  return out;
}

/**
 * Polygon (sides >= 3) bounding box: apply minimum dimensions against
 * the vertex extents, then grow for peripheries.
 * @see lib/common/shapes.c:poly_init (apply minimum dimensions)
 */
function polygonBB(
  bb: Point,
  widthPts: number,
  heightPts: number,
  sides: number,
  p: PolySizeParams,
  isBox: boolean,
): Point {
  const { verts, xmax, ymax } = polygonVertices(
    bb, sides, p.orientation, p.distortion, p.skew, isBox,
  );
  const xmax2 = 2 * xmax;
  const ymax2 = 2 * ymax;
  const nbb = { x: Math.max(widthPts, xmax2), y: Math.max(heightPts, ymax2) };
  if (p.peripheries <= 1) return nbb;
  const scalex = nbb.x / xmax2;
  const scaley = nbb.y / ymax2;
  for (const v of verts) {
    v.x *= scalex;
    v.y *= scaley;
  }
  return polygonPeripheryBB(verts, isBox ? 4 : sides, p.peripheries, nbb);
}

/** Convert final node width/height (points) to lw/rw/ht. @see lib/common/utils.c:gv_nodesize */
export function gvNodesize(widthPts: number, heightPts: number, flip: boolean): NodeSize {
  if (flip) return { lw: heightPts / 2, rw: heightPts / 2, ht: widthPts };
  return { lw: widthPts / 2, rw: widthPts / 2, ht: heightPts };
}

/**
 * Compute node dimensions from label size and attrs — the sizing
 * portion of poly_init followed by gv_nodesize.
 * @see lib/common/shapes.c:poly_init
 */
export function polySize(p: PolySizeParams): NodeSize {
  let { width, height } = initialSizePts(p);
  let sides = p.sides;
  const dimen = quantize(padLabelDimen(p.labelDimen, p.margin, p.isPlain), p.quantumIn);
  let bb: Point = { x: dimen.x, y: dimen.y };
  if (sides <= 2 && (p.distortion !== 0 || p.skew !== 0)) sides = 120;
  const ll = p.labelloc?.[0];
  const valign = ll === 't' || ll === 'b' ? ll : 'c';
  const isBox =
    sides === 4 && Math.abs(p.orientation % 90) < 0.5 &&
    p.distortion === 0 && p.skew === 0;
  if (!isBox) bb = expandForShape(bb, sides, height, valign);

  // increase node size to width/height if needed
  let fixedshape = false;
  if (p.fixedsize === 'shape') {
    bb = { x: width, y: height };
    fixedshape = true;
  } else if (mapbool(p.fixedsize)) {
    bb = { x: width, y: height };
  } else {
    bb.x = width = Math.max(width, bb.x);
    bb.y = height = Math.max(height, bb.y);
  }
  if (p.regular) width = height = bb.x = bb.y = Math.max(bb.x, bb.y);

  bb = sides < 3
    ? ellipsePeripheryBB(bb, p.peripheries)
    : polygonBB(bb, width, height, sides, p, isBox);

  if (fixedshape) {
    return gvNodesize(Math.max(dimen.x, bb.x), Math.max(dimen.y, bb.y), p.flip);
  }
  return gvNodesize(bb.x, bb.y, p.flip);
}
