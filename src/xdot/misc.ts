// SPDX-License-Identifier: EPL-2.0
/** @see lib/xdot/xdot.c: sprintXDot, jsonXDot, statXDot, freeXDot */

import type {
  Xdot, XdotOp, XdotStats, XdotColor,
  XdotLinearGrad, XdotRadialGrad, XdotPoint, XdotColorStop,
} from './types.js';

const ALIGN_NUM: Record<string, number> = { left: -1, center: 0, right: 1 };
const SHAPE_LETTER: Record<string, string> = {
  filled_ellipse: "E", unfilled_ellipse: "e",
  filled_polygon: "P", unfilled_polygon: "p",
  filled_bezier: "b", unfilled_bezier: "B",
  polyline: "L",
};
const COLOR_KINDS = new Set(["fill_color","pen_color","grad_fill_color","grad_pen_color"]);
const SHAPE_KINDS = new Set(Object.keys(SHAPE_LETTER));

class XdotMiscHelper {
  static trimZeros(s: string): string {
    if (!s.includes(".")) return s;
    return s.replace(/\.?0+$/, "");
  }

  static fmt(n: number): string {
    return " " + XdotMiscHelper.trimZeros(n.toFixed(2));
  }

  static fmtStr(s: string): string {
    return ` ${s.length} -${s}`;
  }

  static fmtPts(pts: XdotPoint[]): string {
    return `${pts.length}${pts.map(p => `${XdotMiscHelper.fmt(p.x)}${XdotMiscHelper.fmt(p.y)}`).join("")}`;
  }

  static fmtStops(stops: XdotColorStop[]): string {
    return stops.map(s => `${XdotMiscHelper.fmt(s.frac)}${XdotMiscHelper.fmtStr(s.color)}`).join("");
  }

  static fmtLinGrad(g: XdotLinearGrad): string {
    const h = XdotMiscHelper;
    return `[${h.fmt(g.x0)}${h.fmt(g.y0)}${h.fmt(g.x1)}${h.fmt(g.y1)}${h.fmt(g.stops.length)}${h.fmtStops(g.stops)}]`;
  }

  static fmtRadGrad(g: XdotRadialGrad): string {
    const h = XdotMiscHelper;
    return `(${h.fmt(g.x0)}${h.fmt(g.y0)}${h.fmt(g.r0)}${h.fmt(g.x1)}${h.fmt(g.y1)}${h.fmt(g.r1)}${h.fmt(g.stops.length)}${h.fmtStops(g.stops)})`;
  }

  static fmtColor(c: XdotColor): string {
    if (c.type === "linear") return XdotMiscHelper.fmtLinGrad(c.ling);
    if (c.type === "radial") return XdotMiscHelper.fmtRadGrad(c.ring);
    return c.clr;
  }

  static sprintShapeOp(op: XdotOp): string {
    const ch = SHAPE_LETTER[op.kind] ?? "";
    const k = op.kind;
    if (k === "filled_ellipse" || k === "unfilled_ellipse") {
      const e = op.ellipse;
      return `${ch}${XdotMiscHelper.fmt(e.x)}${XdotMiscHelper.fmt(e.y)}${XdotMiscHelper.fmt(e.w)}${XdotMiscHelper.fmt(e.h)}`;
    }
    if (k === "filled_polygon" || k === "unfilled_polygon") {
      return `${ch} ${XdotMiscHelper.fmtPts(op.polygon.pts)}`;
    }
    if (k === "filled_bezier" || k === "unfilled_bezier") {
      return `${ch} ${XdotMiscHelper.fmtPts(op.bezier.pts)}`;
    }
    return `${ch} ${XdotMiscHelper.fmtPts((op as Extract<XdotOp, { kind: "polyline" }>).polyline.pts)}`;
  }

  static sprintTextOp(op: Extract<XdotOp, { kind: "text" }>): string {
    const t = op.text;
    return `T${XdotMiscHelper.fmt(t.x)}${XdotMiscHelper.fmt(t.y)} ${ALIGN_NUM[t.align]}${XdotMiscHelper.fmt(t.width)}${XdotMiscHelper.fmtStr(t.text)}`;
  }

  static sprintColorOp(op: XdotOp): string {
    const k = op.kind;
    const ch = (k === "fill_color" || k === "grad_fill_color") ? "C" : "c";
    const raw = op as { kind: string; color?: string; gradColor?: XdotColor };
    if (k === "fill_color" || k === "pen_color") {
      return `${ch}${XdotMiscHelper.fmtStr(raw.color!)}`;
    }
    const clr = XdotMiscHelper.fmtColor(raw.gradColor!);
    return `${ch}${XdotMiscHelper.fmtStr(clr)}`;
  }

  static sprintMetaOp(op: XdotOp): string {
    const k = op.kind;
    if (k === "font") {
      const f = op.font;
      return `F${XdotMiscHelper.fmt(f.size)}${XdotMiscHelper.fmtStr(f.name)}`;
    }
    if (k === "style") return `S${XdotMiscHelper.fmtStr(op.style)}`;
    if (k === "image") {
      const img = op.image;
      const r = img.pos;
      return `I${XdotMiscHelper.fmt(r.x)}${XdotMiscHelper.fmt(r.y)}${XdotMiscHelper.fmt(r.w)}${XdotMiscHelper.fmt(r.h)}${XdotMiscHelper.fmtStr(img.name)}`;
    }
    return `t ${(op as Extract<XdotOp, { kind: "fontchar" }>).fontchar}`;
  }

  static sprintOp(op: XdotOp, more: number): string {
    let s: string;
    if (SHAPE_KINDS.has(op.kind)) s = XdotMiscHelper.sprintShapeOp(op);
    else if (op.kind === "text") s = XdotMiscHelper.sprintTextOp(op as Extract<XdotOp, { kind: "text" }>);
    else if (COLOR_KINDS.has(op.kind)) s = XdotMiscHelper.sprintColorOp(op);
    else s = XdotMiscHelper.sprintMetaOp(op);
    return more ? s + " " : s;
  }

  static jsonFmt(n: number): string { return n.toFixed(6); }

  static jsonPts(pts: XdotPoint[]): string {
    const f = XdotMiscHelper.jsonFmt;
    return "[" + pts.map(p => `[${f(p.x)},${f(p.y)},${f(p.z)}]`).join(",") + "]";
  }

  static jsonOp(op: XdotOp): string {
    const k = op.kind;
    const f = XdotMiscHelper.jsonFmt;
    if (k === "filled_ellipse" || k === "unfilled_ellipse") {
      const e = op.ellipse;
      const key = k === "filled_ellipse" ? "E" : "e";
      return `{"${key}":[${f(e.x)},${f(e.y)},${f(e.w)},${f(e.h)}]}`;
    }
    if (k === "filled_polygon" || k === "unfilled_polygon") {
      const key = k === "filled_polygon" ? "P" : "p";
      return `{"${key}":${XdotMiscHelper.jsonPts(op.polygon.pts)}}`;
    }
    return XdotMiscHelper.jsonOp2(op);
  }

  static jsonOp2(op: XdotOp): string {
    const k = op.kind;
    const f = XdotMiscHelper.jsonFmt;
    if (k === "filled_bezier" || k === "unfilled_bezier") {
      const key = k === "filled_bezier" ? "b" : "B";
      return `{"${key}":${XdotMiscHelper.jsonPts(op.bezier.pts)}}`;
    }
    if (k === "polyline") return `{"L":${XdotMiscHelper.jsonPts(op.polyline.pts)}}`;
    if (k === "text") {
      const t = op.text;
      return `{"T":{"x":${f(t.x)},"y":${f(t.y)},"align":${ALIGN_NUM[t.align]},"width":${f(t.width)},"text":${JSON.stringify(t.text)}}}`;
    }
    return XdotMiscHelper.jsonOp3(op);
  }

  static jsonOp3(op: XdotOp): string {
    const k = op.kind;
    const jf = XdotMiscHelper.jsonFmt;
    if (k === "fill_color") return `{"C":${JSON.stringify(op.color)}}`;
    if (k === "pen_color") return `{"c":${JSON.stringify(op.color)}}`;
    if (k === "grad_fill_color") return `{"C":${JSON.stringify(XdotMiscHelper.fmtColor(op.gradColor))}}`;
    if (k === "grad_pen_color") return `{"c":${JSON.stringify(XdotMiscHelper.fmtColor(op.gradColor))}}`;
    if (k === "font") {
      const fnt = op.font;
      return `{"F":{"size":${jf(fnt.size)},"name":${JSON.stringify(fnt.name)}}}`;
    }
    if (k === "style") return `{"S":${JSON.stringify(op.style)}}`;
    if (k === "image") {
      const img = op.image;
      const r = img.pos;
      return `{"I":{"x":${jf(r.x)},"y":${jf(r.y)},"w":${jf(r.w)},"h":${jf(r.h)},"name":${JSON.stringify(img.name)}}}`;
    }
    return `{"t":${(op as Extract<XdotOp, { kind: "fontchar" }>).fontchar}}`;
  }

  static statShapeCounts(op: XdotOp, sp: XdotStats): void {
    const k = op.kind;
    if (k === "filled_ellipse" || k === "unfilled_ellipse") { sp.nEllipse++; return; }
    if (k === "filled_polygon" || k === "unfilled_polygon") {
      sp.nPolygon++; sp.nPolygonPts += op.polygon.pts.length; return;
    }
    if (k === "filled_bezier" || k === "unfilled_bezier") {
      sp.nBezier++; sp.nBezierPts += op.bezier.pts.length; return;
    }
    if (k === "polyline") { sp.nPolyline++; sp.nPolylinePts += op.polyline.pts.length; return; }
    if (k === "text") sp.nText++;
  }

  static statAttrCounts(op: XdotOp, sp: XdotStats): void {
    const k = op.kind;
    if (k === "font") { sp.nFont++; return; }
    if (k === "style") { sp.nStyle++; return; }
    if (k === "fill_color" || k === "pen_color") { sp.nColor++; return; }
    if (k === "grad_fill_color" || k === "grad_pen_color") { sp.nGradcolor++; return; }
    if (k === "image") { sp.nImage++; return; }
    if (k === "fontchar") sp.nFontchar++;
  }

  static stat(x: Xdot, sp: XdotStats): boolean {
    if (!x) return false;
    for (const op of x.ops) {
      sp.cnt++;
      XdotMiscHelper.statShapeCounts(op, sp);
      XdotMiscHelper.statAttrCounts(op, sp);
    }
    return true;
  }

  static sprint(x: Xdot): string {
    const n = x.ops.length;
    return x.ops.map((op, i) => XdotMiscHelper.sprintOp(op, i < n - 1 ? 1 : 0)).join("");
  }

  static json(x: Xdot): string {
    return "[\n" + x.ops.map(op => XdotMiscHelper.jsonOp(op) + "\n").join("") + "\n]";
  }
}

/** @see lib/xdot/xdot.c:Pxdot_free */
export function freeXDot(_x: Xdot | null): void { /* GC handles memory */ }

/** @see lib/xdot/xdot.c:freeXDotColor */
export function freeXDotColor(_c: XdotColor | null): void { /* GC handles memory */ }

/** @see lib/xdot/xdot.c:statXDot */
export function statXDot(x: Xdot, sp: XdotStats): boolean { return XdotMiscHelper.stat(x, sp); }

/** @see lib/xdot/xdot.c:sprintXDot */
export function sprintXDot(x: Xdot): string { return XdotMiscHelper.sprint(x); }

/** @see lib/xdot/xdot.c:jsonXDot */
export function jsonXDot(x: Xdot): string { return XdotMiscHelper.json(x); }
