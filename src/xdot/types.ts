// SPDX-License-Identifier: EPL-2.0
/**
 * Type definitions for lib/xdot.
 * @see cgraph/xdot/xdot.h
 */

export const XDOT_PARSE_ERROR = 0x1;

export type XdotGradType = "none" | "linear" | "radial";

export interface XdotColorStop {
  frac: number;
  color: string;
}

export interface XdotLinearGrad {
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  x0: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  y0: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  x1: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  y1: number;
  stops: XdotColorStop[];
}

export interface XdotRadialGrad {
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  x0: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  y0: number;
  r0: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  x1: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  y1: number;
  r1: number;
  stops: XdotColorStop[];
}

export type XdotColor =
  | { type: "none"; clr: string }
  | { type: "linear"; ling: XdotLinearGrad }
  | { type: "radial"; ring: XdotRadialGrad };

export type XdotAlign = "left" | "center" | "right";

export interface XdotPoint {
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  x: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  y: number;
  z: number;
}

export interface XdotRect {
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  x: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  y: number;
  w: number;
  h: number;
}

export interface XdotPolyline {
  pts: XdotPoint[];
}

export interface XdotText {
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  x: number;
  /** x coordinate in PostScript points. Y-up origin; caller flips for SVG. */
  y: number;
  align: XdotAlign;
  width: number;
  text: string;
}

export interface XdotImage {
  pos: XdotRect;
  name: string;
}

export interface XdotFont {
  size: number;
  name: string;
}

export type XdotKind =
  | "filled_ellipse"
  | "unfilled_ellipse"
  | "filled_polygon"
  | "unfilled_polygon"
  | "filled_bezier"
  | "unfilled_bezier"
  | "polyline"
  | "text"
  | "fill_color"
  | "pen_color"
  | "font"
  | "style"
  | "image"
  | "grad_fill_color"
  | "grad_pen_color"
  | "fontchar";

export type XdotOp =
  | { kind: "filled_ellipse" | "unfilled_ellipse"; ellipse: XdotRect }
  | { kind: "filled_polygon" | "unfilled_polygon"; polygon: XdotPolyline }
  | { kind: "filled_bezier" | "unfilled_bezier"; bezier: XdotPolyline }
  | { kind: "polyline"; polyline: XdotPolyline }
  | { kind: "text"; text: XdotText }
  | { kind: "fill_color" | "pen_color"; color: string }
  | { kind: "grad_fill_color" | "grad_pen_color"; gradColor: XdotColor }
  | { kind: "font"; font: XdotFont }
  | { kind: "style"; style: string }
  | { kind: "image"; image: XdotImage }
  | { kind: "fontchar"; fontchar: number };

export interface Xdot {
  ops: XdotOp[];
  flags: number;
}

export interface XdotStats {
  cnt: number;
  nEllipse: number;
  nPolygon: number;
  nPolygonPts: number;
  nPolyline: number;
  nPolylinePts: number;
  nBezier: number;
  nBezierPts: number;
  nText: number;
  nFont: number;
  nStyle: number;
  nColor: number;
  nImage: number;
  nGradcolor: number;
  nFontchar: number;
}

/** Per-op-kind draw callbacks, indexed by xop_kind. @see xdot.h */
export interface OpFunctions {
  ellipse: (op: XdotOp, more: number) => void;
  polygon: (op: XdotOp, more: number) => void;
  bezier: (op: XdotOp, more: number) => void;
  polyline: (op: XdotOp, more: number) => void;
  text: (op: XdotOp, more: number) => void;
  fill_color: (op: XdotOp, more: number) => void;
  pen_color: (op: XdotOp, more: number) => void;
  font: (op: XdotOp, more: number) => void;
  style: (op: XdotOp, more: number) => void;
  image: (op: XdotOp, more: number) => void;
  grad_color: (op: XdotOp, more: number) => void;
  fontchar: (op: XdotOp, more: number) => void;
}
