// SPDX-License-Identifier: EPL-2.0
/**
 * xdot attribute string parser.
 * Faithful port of parseXDot / parseXDotF / parseXDotFOn / parseXDotColor
 * from ~/git/graphviz/lib/xdot/xdot.c.
 * @see lib/xdot/xdot.c
 */

import type {
  Xdot, XdotOp, XdotRect, XdotPolyline, XdotPoint,
  XdotText, XdotAlign, XdotColor, XdotLinearGrad,
  XdotRadialGrad, XdotColorStop, OpFunctions,
} from "./types.js";
import { XDOT_PARSE_ERROR } from "./types.js";

type PR<T> = { val: T; pos: number } | null;
type OpResult = { op: XdotOp; pos: number } | "error";
type OpMaybeResult = OpResult | null;

class XdotParser {
  static isWs(c: string): boolean {
    return c === " " || c === "\t" || c === "\n" || c === "\r";
  }

  static skipWs(s: string, pos: number): number {
    while (pos < s.length && XdotParser.isWs(s[pos])) pos++;
    return pos;
  }

  static consumeDigits(s: string, i: number): number {
    while (i < s.length && s[i] >= "0" && s[i] <= "9") i++;
    return i;
  }

  static consumeExponent(s: string, i: number): number {
    if (i < s.length && (s[i] === "e" || s[i] === "E")) {
      i++;
      if (i < s.length && (s[i] === "+" || s[i] === "-")) i++;
      i = XdotParser.consumeDigits(s, i);
    }
    return i;
  }

  static parseReal(s: string, pos: number): PR<number> {
    let i = XdotParser.skipWs(s, pos);
    const start = i;
    if (i < s.length && (s[i] === "-" || s[i] === "+")) i++;
    const digStart = i;
    i = XdotParser.consumeDigits(s, i);
    if (i < s.length && s[i] === ".") { i++; i = XdotParser.consumeDigits(s, i); }
    i = XdotParser.consumeExponent(s, i);
    if (i === start || i === digStart) return null;
    return { val: parseFloat(s.slice(start, i)), pos: i };
  }

  static parseInt_(s: string, pos: number): PR<number> {
    let i = XdotParser.skipWs(s, pos);
    const start = i;
    if (i < s.length && (s[i] === "-" || s[i] === "+")) i++;
    const digStart = i;
    i = XdotParser.consumeDigits(s, i);
    if (i === digStart) return null;
    return { val: parseInt(s.slice(start, i), 10), pos: i };
  }

  static parseUInt_(s: string, pos: number): PR<number> {
    const i = XdotParser.skipWs(s, pos);
    const start = i;
    const end = XdotParser.consumeDigits(s, i);
    if (end === start) return null;
    return { val: parseInt(s.slice(start, end), 10), pos: end };
  }

  static parseRect(s: string, pos: number): PR<XdotRect> {
    const rx = XdotParser.parseReal(s, pos); if (!rx) return null;
    const ry = XdotParser.parseReal(s, rx.pos); if (!ry) return null;
    const rw = XdotParser.parseReal(s, ry.pos); if (!rw) return null;
    const rh = XdotParser.parseReal(s, rw.pos); if (!rh) return null;
    return { val: { x: rx.val, y: ry.val, w: rw.val, h: rh.val }, pos: rh.pos };
  }

  static parsePoint(s: string, pos: number): PR<XdotPoint> {
    const rx = XdotParser.parseReal(s, pos); if (!rx) return null;
    const ry = XdotParser.parseReal(s, rx.pos); if (!ry) return null;
    return { val: { x: rx.val, y: ry.val, z: 0 }, pos: ry.pos };
  }

  static parsePolyline(s: string, pos: number): PR<XdotPolyline> {
    const ri = XdotParser.parseUInt_(s, pos); if (!ri) return null;
    let cur = ri.pos;
    const pts: XdotPoint[] = [];
    for (let i = 0; i < ri.val; i++) {
      const rp = XdotParser.parsePoint(s, cur); if (!rp) return null;
      pts.push(rp.val);
      cur = rp.pos;
    }
    return { val: { pts }, pos: cur };
  }

  static countChar(ch: string, prev: string, accounted: number): number {
    if (ch !== "\\" || prev === "\\") return accounted + 1;
    return accounted;
  }

  static parseString(s: string, pos: number): PR<string> {
    const ri = XdotParser.parseInt_(s, pos);
    if (!ri || ri.val <= 0) return null;
    const len = ri.val;
    let cur = XdotParser.skipWs(s, ri.pos);
    if (s[cur] !== "-") return null;
    cur++;
    let out = "";
    let accounted = 0;
    let j = 0;
    while (accounted < len) {
      if (cur + j >= s.length) break; // C strncpy semantics: stop at end of input
      const ch = s[cur + j];
      const prev = j > 0 ? s[cur + j - 1] : "";
      out += ch;
      accounted = XdotParser.countChar(ch, prev, accounted);
      j++;
    }
    return { val: out, pos: cur + j };
  }

  static parseAlign(s: string, pos: number): PR<XdotAlign> {
    const ri = XdotParser.parseInt_(s, pos); if (!ri) return null;
    const align: XdotAlign = ri.val < 0 ? "left" : ri.val > 0 ? "right" : "center";
    return { val: align, pos: ri.pos };
  }

  static parseStops(s: string, pos: number, n: number): { stops: XdotColorStop[]; pos: number } | null {
    let cur = pos;
    const stops: XdotColorStop[] = [];
    for (let i = 0; i < n; i++) {
      const rf = XdotParser.parseReal(s, cur); if (!rf) return null;
      const rc = XdotParser.parseString(s, rf.pos); if (!rc) return null;
      stops.push({ frac: rf.val, color: rc.val });
      cur = rc.pos;
    }
    return { stops, pos: cur };
  }

  static linGradient(s: string, pos: number): XdotLinearGrad | null {
    const rx0 = XdotParser.parseReal(s, pos); if (!rx0) return null;
    const ry0 = XdotParser.parseReal(s, rx0.pos); if (!ry0) return null;
    const rx1 = XdotParser.parseReal(s, ry0.pos); if (!rx1) return null;
    const ry1 = XdotParser.parseReal(s, rx1.pos); if (!ry1) return null;
    const rn = XdotParser.parseInt_(s, ry1.pos); if (!rn) return null;
    const rs = XdotParser.parseStops(s, rn.pos, rn.val); if (!rs) return null;
    return { x0: rx0.val, y0: ry0.val, x1: rx1.val, y1: ry1.val, stops: rs.stops };
  }

  static radGradient(s: string, pos: number): XdotRadialGrad | null {
    const rx0 = XdotParser.parseReal(s, pos); if (!rx0) return null;
    const ry0 = XdotParser.parseReal(s, rx0.pos); if (!ry0) return null;
    const rr0 = XdotParser.parseReal(s, ry0.pos); if (!rr0) return null;
    const rx1 = XdotParser.parseReal(s, rr0.pos); if (!rx1) return null;
    const ry1 = XdotParser.parseReal(s, rx1.pos); if (!ry1) return null;
    const rr1 = XdotParser.parseReal(s, ry1.pos); if (!rr1) return null;
    const rn = XdotParser.parseInt_(s, rr1.pos); if (!rn) return null;
    const rs = XdotParser.parseStops(s, rn.pos, rn.val); if (!rs) return null;
    return { x0: rx0.val, y0: ry0.val, r0: rr0.val, x1: rx1.val, y1: ry1.val, r1: rr1.val, stops: rs.stops };
  }

  static isAlnum(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9");
  }

  static parseXDotColorAt(s: string, pos: number): PR<XdotColor> {
    const c = pos < s.length ? s[pos] : "";
    if (c === "[") {
      const g = XdotParser.linGradient(s, pos + 1); if (!g) return null;
      return { val: { type: "linear", ling: g }, pos };
    }
    if (c === "(") {
      const g = XdotParser.radGradient(s, pos + 1); if (!g) return null;
      return { val: { type: "radial", ring: g }, pos };
    }
    if (c === "#" || c === "/" || XdotParser.isAlnum(c))
      return { val: { type: "none", clr: s.slice(pos) }, pos };
    return null;
  }

  static parseEllipseOp(ch: string, s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const r = XdotParser.parseRect(s, pos); if (!r) return "error";
    const op: XdotOp = { kind: ch === "E" ? "filled_ellipse" : "unfilled_ellipse", ellipse: r.val };
    fns.ellipse?.(op, 0);
    return { op, pos: r.pos };
  }

  static parsePolygonOp(ch: string, s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const r = XdotParser.parsePolyline(s, pos); if (!r) return "error";
    const op: XdotOp = { kind: ch === "P" ? "filled_polygon" : "unfilled_polygon", polygon: r.val };
    fns.polygon?.(op, 0);
    return { op, pos: r.pos };
  }

  static parseBezierOp(ch: string, s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const r = XdotParser.parsePolyline(s, pos); if (!r) return "error";
    const op: XdotOp = { kind: ch === "b" ? "filled_bezier" : "unfilled_bezier", bezier: r.val };
    fns.bezier?.(op, 0);
    return { op, pos: r.pos };
  }

  static parsePolylineOp(s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const r = XdotParser.parsePolyline(s, pos); if (!r) return "error";
    const op: XdotOp = { kind: "polyline", polyline: r.val };
    fns.polyline?.(op, 0);
    return { op, pos: r.pos };
  }

  static parseTextOp(s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const rx = XdotParser.parseReal(s, pos); if (!rx) return "error";
    const ry = XdotParser.parseReal(s, rx.pos); if (!ry) return "error";
    const ra = XdotParser.parseAlign(s, ry.pos); if (!ra) return "error";
    const rw = XdotParser.parseReal(s, ra.pos); if (!rw) return "error";
    const rt = XdotParser.parseString(s, rw.pos); if (!rt) return "error";
    const text: XdotText = { x: rx.val, y: ry.val, align: ra.val, width: rw.val, text: rt.val };
    const op: XdotOp = { kind: "text", text };
    fns.text?.(op, 0);
    return { op, pos: rt.pos };
  }

  static parseColorOp(ch: string, s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const rs = XdotParser.parseString(s, pos); if (!rs) return "error";
    const rc = XdotParser.parseXDotColorAt(rs.val, 0); if (!rc) return "error";
    const clr = rc.val;
    if (clr.type === "none") {
      const op: XdotOp = { kind: ch === "C" ? "fill_color" : "pen_color", color: clr.clr };
      (ch === "C" ? fns.fill_color : fns.pen_color)?.(op, 0);
      return { op, pos: rs.pos };
    }
    const op: XdotOp = { kind: ch === "C" ? "grad_fill_color" : "grad_pen_color", gradColor: clr };
    fns.grad_color?.(op, 0);
    return { op, pos: rs.pos };
  }

  static parseFontOp(s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const rs = XdotParser.parseReal(s, pos); if (!rs) return "error";
    const rn = XdotParser.parseString(s, rs.pos); if (!rn) return "error";
    const op: XdotOp = { kind: "font", font: { size: rs.val, name: rn.val } };
    fns.font?.(op, 0);
    return { op, pos: rn.pos };
  }

  static parseStyleOp(s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const r = XdotParser.parseString(s, pos); if (!r) return "error";
    const op: XdotOp = { kind: "style", style: r.val };
    fns.style?.(op, 0);
    return { op, pos: r.pos };
  }

  static parseImageOp(s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const rr = XdotParser.parseRect(s, pos); if (!rr) return "error";
    const rn = XdotParser.parseString(s, rr.pos); if (!rn) return "error";
    const op: XdotOp = { kind: "image", image: { pos: rr.val, name: rn.val } };
    fns.image?.(op, 0);
    return { op, pos: rn.pos };
  }

  static parseFontcharOp(s: string, pos: number, fns: Partial<OpFunctions>): OpResult {
    const r = XdotParser.parseUInt_(s, pos); if (!r) return "error";
    const op: XdotOp = { kind: "fontchar", fontchar: r.val };
    fns.fontchar?.(op, 0);
    return { op, pos: r.pos };
  }

  static parseShapeOp(ch: string, s: string, pos: number, fns: Partial<OpFunctions>): OpMaybeResult {
    if (ch === "E" || ch === "e") return XdotParser.parseEllipseOp(ch, s, pos, fns);
    if (ch === "P" || ch === "p") return XdotParser.parsePolygonOp(ch, s, pos, fns);
    if (ch === "b" || ch === "B") return XdotParser.parseBezierOp(ch, s, pos, fns);
    if (ch === "L") return XdotParser.parsePolylineOp(s, pos, fns);
    return null;
  }

  static parseMetaOp(ch: string, s: string, pos: number, fns: Partial<OpFunctions>): OpMaybeResult {
    if (ch === "T") return XdotParser.parseTextOp(s, pos, fns);
    if (ch === "C" || ch === "c") return XdotParser.parseColorOp(ch, s, pos, fns);
    if (ch === "F") return XdotParser.parseFontOp(s, pos, fns);
    if (ch === "S") return XdotParser.parseStyleOp(s, pos, fns);
    if (ch === "I") return XdotParser.parseImageOp(s, pos, fns);
    if (ch === "t") return XdotParser.parseFontcharOp(s, pos, fns);
    if (ch === "\0") return null;
    return "error";
  }

  static parseOp(s: string, pos: number, fns: Partial<OpFunctions>): OpMaybeResult {
    pos = XdotParser.skipWs(s, pos);
    if (pos >= s.length) return null;
    const ch = s[pos++];
    const shape = XdotParser.parseShapeOp(ch, s, pos, fns);
    if (shape !== null) return shape;
    return XdotParser.parseMetaOp(ch, s, pos, fns);
  }

  static parseXDotFOn(s: string, opFns: Partial<OpFunctions>, _sz: number, x: Xdot | null): Xdot | null {
    if (!s) return x;
    const result: Xdot = x ?? { ops: [], flags: 0 };
    let pos = 0;
    while (pos < s.length) {
      const r = XdotParser.parseOp(s, pos, opFns);
      if (r === null) break;
      if (r === "error") { result.flags |= XDOT_PARSE_ERROR; break; }
      result.ops.push(r.op);
      pos = r.pos;
    }
    return result.ops.length === 0 ? null : result;
  }

  static parseXDotF(s: string, opFns: Partial<OpFunctions>, sz: number): Xdot | null {
    return XdotParser.parseXDotFOn(s, opFns, sz, null);
  }

  static parseXDot(s: string): Xdot | null { return XdotParser.parseXDotF(s, {}, 0); }

  static parseXDotColor(s: string): XdotColor | null {
    const r = XdotParser.parseXDotColorAt(s, 0);
    return r ? r.val : null;
  }
}

export function parseRect(s: string, pos: number): PR<XdotRect> { return XdotParser.parseRect(s, pos); }
export function parsePolyline(s: string, pos: number): PR<XdotPolyline> { return XdotParser.parsePolyline(s, pos); }
export function parseString(s: string, pos: number): PR<string> { return XdotParser.parseString(s, pos); }
export function parseXDotColorAt(s: string, pos: number): PR<XdotColor> { return XdotParser.parseXDotColorAt(s, pos); }
export function parseXDotFOn(s: string, opFns: Partial<OpFunctions>, sz: number, x: Xdot | null): Xdot | null {
  return XdotParser.parseXDotFOn(s, opFns, sz, x);
}
export function parseXDotF(s: string, opFns: Partial<OpFunctions>, sz: number): Xdot | null {
  return XdotParser.parseXDotF(s, opFns, sz);
}
export function parseXDot(s: string): Xdot | null { return XdotParser.parseXDot(s); }
export function parseXDotColor(s: string): XdotColor | null { return XdotParser.parseXDotColor(s); }
