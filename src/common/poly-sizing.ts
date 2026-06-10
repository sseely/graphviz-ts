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
  /** penwidth attr (default 1, min 0). @see lib/common/const.h:DEFAULT_NODEPENWIDTH */
  penwidth?: number;
}

/** Node geometry in points: left/right half-widths and height. */
export interface NodeSize {
  lw: number;
  rw: number;
  ht: number;
}

/** polySize result: node size plus unflipped outline extents (points). */
export interface PolySizeResult extends NodeSize {
  /** Outline width in points (bb + penwidth growth). @see ND_outline_width */
  outlineW: number;
  /** Outline height in points. @see ND_outline_height */
  outlineH: number;
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

/**
 * Grow an ellipse bb by GAP per extra periphery; the outline adds half
 * the penwidth on each side. @see shapes.c:poly_init (sides < 3)
 */
function ellipsePeripheryBB(
  bb: Point,
  peripheries: number,
  penwidth: number,
  hasOutline: boolean,
): { bb: Point; outline: Point } {
  let b = bb;
  if (peripheries > 1) {
    const grow = 2 * GAP * (peripheries - 1);
    b = { x: bb.x + grow, y: bb.y + grow };
  }
  const outline = hasOutline ? { x: b.x + penwidth, y: b.y + penwidth } : b;
  return { bb: b, outline };
}

/** Effective polygon geometry for the unit vertex loop. */
export interface PolyGeom {
  sides: number;
  orientation: number;
  distortion: number;
  skew: number;
}

/** Distort, skew, orient, and scale one unit vertex. @see shapes.c:poly_init */
function transformUnitVertex(R: Point, g: PolyGeom, c: { skewdist: number; gdistortion: number; gskew: number }, bb: Point): Point {
  const D = { x: R.x * (c.skewdist + R.y * c.gdistortion) + R.y * c.gskew, y: R.y };
  const alpha = (g.orientation * Math.PI) / 180 + Math.atan2(D.y, D.x);
  const r = Math.hypot(D.x, D.y);
  return { x: r * Math.cos(alpha) * bb.x, y: r * Math.sin(alpha) * bb.y };
}

/**
 * Unit-polygon vertex loop: distort, skew, orient, then scale by bb.
 * Returns the scaled vertices and the bounding half-extents.
 * @see lib/common/shapes.c:poly_init (polygon vertex loop)
 */
export function polygonVertices(
  bb: Point,
  g: PolyGeom,
  isBox: boolean,
): { verts: Point[]; xmax: number; ymax: number } {
  const sectorangle = (2 * Math.PI) / g.sides;
  const sidelength = Math.sin(sectorangle / 2);
  const c = {
    skewdist: Math.hypot(Math.abs(g.distortion) + Math.abs(g.skew), 1),
    gdistortion: (g.distortion * SQRT2) / Math.cos(sectorangle / 2),
    gskew: g.skew / 2,
  };
  let angle = (sectorangle - Math.PI) / 2;
  const R = { x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) };
  angle += (Math.PI - sectorangle) / 2;
  const verts: Point[] = [];
  for (let i = 0; i < g.sides; i++) {
    angle += sectorangle;
    R.x += sidelength * Math.cos(angle);
    R.y += sidelength * Math.sin(angle);
    const P = transformUnitVertex(R, g, c, bb);
    verts.push(P);
    if (isBox) {
      // enforce exact symmetry of box
      verts.push({ x: -P.x, y: P.y }, { x: -P.x, y: -P.y }, { x: P.x, y: -P.y });
      break;
    }
  }
  return { verts, ...vertexExtents(verts) };
}

/** Max |x| / |y| half-extents over a vertex list. */
function vertexExtents(verts: Point[]): { xmax: number; ymax: number } {
  let xmax = 0;
  let ymax = 0;
  for (const v of verts) {
    xmax = Math.max(Math.abs(v.x), xmax);
    ymax = Math.max(Math.abs(v.y), ymax);
  }
  return { xmax, ymax };
}

/** Mutable bisector-walk state shared across vertices. */
interface BisectorState {
  beta: number;
  Qprev: Point;
  sinx: number;
  cosx: number;
}

/** Initial bisector state from the last distinct vertex pair. @see shapes.c:poly_init */
function initBisector(verts: Point[], sides: number): BisectorState {
  const R = verts[0]!;
  let Q = R;
  for (let j = 1; j < sides; j++) {
    Q = verts[(sides - j) % sides]!;
    if (Q.x !== R.x || Q.y !== R.y) break;
  }
  return { beta: Math.atan2(R.y - Q.y, R.x - Q.x), Qprev: Q, sinx: 0, cosx: 0 };
}

/**
 * Per-vertex GAP offset along the angle bisector; degenerate sides
 * keep the previous offset (cylinder-style shapes).
 * @see lib/common/shapes.c:poly_init (peripheries bisector loop)
 */
function bisectorOffset(verts: Point[], sides: number, i: number, st: BisectorState): void {
  const V = verts[i]!;
  if (V.x !== st.Qprev.x || V.y !== st.Qprev.y) {
    let R = V;
    for (let j = 1; j < sides; j++) {
      R = verts[(i + j) % sides]!;
      if (R.x !== V.x || R.y !== V.y) break;
    }
    const alpha = st.beta;
    st.beta = Math.atan2(R.y - V.y, R.x - V.x);
    const gamma = (alpha + Math.PI - st.beta) / 2;
    const temp = GAP / Math.sin(gamma);
    st.sinx = Math.sin(alpha - gamma) * temp;
    st.cosx = Math.cos(alpha - gamma) * temp;
  }
  st.Qprev = V;
}

/**
 * Grow a polygon bb to cover the outermost periphery ring, and the
 * outline bb to cover the half-penwidth ring beyond it.
 * @see lib/common/shapes.c:poly_init (peripheries bisector loop)
 */
export function polygonPeripheryBB(
  verts: Point[],
  sides: number,
  p: { peripheries: number; penwidth: number; hasOutline: boolean },
  bb: Point,
): { bb: Point; outline: Point } {
  const st = initBisector(verts, sides);
  const out = { x: bb.x, y: bb.y };
  const outl = { x: bb.x, y: bb.y };
  for (let i = 0; i < sides; i++) {
    bisectorOffset(verts, sides, i, st);
    const off = p.peripheries - 1;
    const V = verts[i]!;
    const P = { x: V.x + off * st.cosx, y: V.y + off * st.sinx };
    out.x = Math.max(2 * Math.abs(P.x), out.x);
    out.y = Math.max(2 * Math.abs(P.y), out.y);
    // outline ring: half the penwidth outside the outermost periphery
    const k = p.hasOutline ? p.penwidth / 2 / GAP : 0;
    const Q = { x: P.x + k * st.cosx, y: P.y + k * st.sinx };
    outl.x = Math.max(2 * Math.abs(Q.x), outl.x);
    outl.y = Math.max(2 * Math.abs(Q.y), outl.y);
  }
  return { bb: out, outline: { x: Math.max(outl.x, out.x), y: Math.max(outl.y, out.y) } };
}

/**
 * Polygon (sides >= 3) bounding box: apply minimum dimensions against
 * the vertex extents, then grow for peripheries and the outline.
 * @see lib/common/shapes.c:poly_init (apply minimum dimensions)
 */
function polygonBB(
  bb: Point,
  minSize: Point,
  p: PolySizeParams & { penwidth: number; hasOutline: boolean },
  sides: number,
  isBox: boolean,
): { bb: Point; outline: Point } {
  const geom: PolyGeom = {
    sides, orientation: p.orientation, distortion: p.distortion, skew: p.skew,
  };
  const { verts, xmax, ymax } = polygonVertices(bb, geom, isBox);
  const xmax2 = 2 * xmax;
  const ymax2 = 2 * ymax;
  const nbb = { x: Math.max(minSize.x, xmax2), y: Math.max(minSize.y, ymax2) };
  // C gates the bisector walk on outp > 1; peripheries < 1 never enters it.
  const walk = p.peripheries > 1 || (p.peripheries >= 1 && p.penwidth > 0);
  if (!walk) return { bb: nbb, outline: nbb };
  const scalex = nbb.x / xmax2;
  const scaley = nbb.y / ymax2;
  for (const v of verts) {
    v.x *= scalex;
    v.y *= scaley;
  }
  return polygonPeripheryBB(verts, isBox ? 4 : sides, p, nbb);
}

/** Convert final node width/height (points) to lw/rw/ht. @see lib/common/utils.c:gv_nodesize */
export function gvNodesize(widthPts: number, heightPts: number, flip: boolean): NodeSize {
  if (flip) return { lw: heightPts / 2, rw: heightPts / 2, ht: widthPts };
  return { lw: widthPts / 2, rw: widthPts / 2, ht: heightPts };
}

/** Result of the fixedsize/regular constraint block. */
interface SizeConstraints {
  bb: Point;
  width: number;
  height: number;
  fixedshape: boolean;
}

/** Apply fixedsize/regular minimums. @see shapes.c:poly_init ("increase node size") */
function applySizeConstraints(
  p: PolySizeParams,
  bb0: Point,
  width0: number,
  height0: number,
): SizeConstraints {
  let c: SizeConstraints;
  if (p.fixedsize === 'shape') {
    c = { bb: { x: width0, y: height0 }, width: width0, height: height0, fixedshape: true };
  } else if (mapbool(p.fixedsize)) {
    c = { bb: { x: width0, y: height0 }, width: width0, height: height0, fixedshape: false };
  } else {
    const bb = { x: Math.max(width0, bb0.x), y: Math.max(height0, bb0.y) };
    c = { bb, width: bb.x, height: bb.y, fixedshape: false };
  }
  if (p.regular) {
    const m = Math.max(c.bb.x, c.bb.y);
    c = { bb: { x: m, y: m }, width: m, height: m, fixedshape: c.fixedshape };
  }
  return c;
}

/**
 * Compute node dimensions from label size and attrs — the sizing
 * portion of poly_init followed by gv_nodesize.
 * @see lib/common/shapes.c:poly_init
 */
export function polySize(p: PolySizeParams): PolySizeResult {
  const init = initialSizePts(p);
  const dimen = quantize(padLabelDimen(p.labelDimen, p.margin, p.isPlain), p.quantumIn);
  const { sides, isBox } = effectiveShape(p);
  let bb: Point = { x: dimen.x, y: dimen.y };
  if (!isBox) bb = expandForShape(bb, sides, init.height, labelValign(p));

  const c = applySizeConstraints(p, bb, init.width, init.height);
  const penwidth = p.penwidth ?? 1; // DEFAULT_NODEPENWIDTH
  // C: outp exceeds peripheries when an outline ring is added.
  const hasOutline = penwidth > 0 || p.peripheries < 1;
  const grown = sides < 3
    ? ellipsePeripheryBB(c.bb, p.peripheries, penwidth, hasOutline)
    : polygonBB(c.bb, { x: c.width, y: c.height }, { ...p, penwidth, hasOutline }, sides, isBox);
  return assembleResult(p, dimen, grown, c.fixedshape);
}

/** Effective sides (distortion/skew turn ellipses into 120-gons) and box test. */
function effectiveShape(p: PolySizeParams): { sides: number; isBox: boolean } {
  let sides = p.sides;
  if (sides <= 2 && (p.distortion !== 0 || p.skew !== 0)) sides = 120;
  const isBox =
    sides === 4 && Math.abs(p.orientation % 90) < 0.5 &&
    p.distortion === 0 && p.skew === 0;
  return { sides, isBox };
}

/** labelloc -> vertical alignment character. @see shapes.c:poly_init */
function labelValign(p: PolySizeParams): string {
  const ll = p.labelloc?.[0];
  return ll === 't' || ll === 'b' ? ll : 'c';
}

/** Final width/height selection (fixedshape covers the label) + gv_nodesize. */
function assembleResult(
  p: PolySizeParams,
  dimen: Point,
  grown: { bb: Point; outline: Point },
  fixedshape: boolean,
): PolySizeResult {
  if (fixedshape) {
    return {
      ...gvNodesize(Math.max(dimen.x, grown.bb.x), Math.max(dimen.y, grown.bb.y), p.flip),
      outlineW: Math.max(dimen.x, grown.outline.x),
      outlineH: Math.max(dimen.y, grown.outline.y),
    };
  }
  return {
    ...gvNodesize(grown.bb.x, grown.bb.y, p.flip),
    outlineW: grown.outline.x,
    outlineH: grown.outline.y,
  };
}
