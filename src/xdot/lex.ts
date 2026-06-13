// SPDX-License-Identifier: EPL-2.0
/**
 * Low-level lexer primitives for xdot attribute string parsing.
 * Ported from ~/git/graphviz/lib/xdot/xdot.c helper functions.
 */

import type { XdotAlign, XdotPoint, XdotRect, XdotPolyline } from "./types.js";

export type PR<T> = { val: T; pos: number } | null;

// ---------------------------------------------------------------------------
// Character helpers
// ---------------------------------------------------------------------------
export function isWs(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r";
}

export function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

export function isAlnum(c: string): boolean {
  return isDigit(c) || (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

export function skipWs(s: string, pos: number): number {
  while (pos < s.length && isWs(s[pos])) pos++;
  return pos;
}

// ---------------------------------------------------------------------------
// Digit / exponent consumers
// ---------------------------------------------------------------------------
export function consumeDigits(s: string, i: number): number {
  while (i < s.length && isDigit(s[i])) i++;
  return i;
}

function consumeExponent(s: string, i: number): number {
  if (i >= s.length) return i;
  if (s[i] !== "e" && s[i] !== "E") return i;
  i++;
  if (i < s.length && (s[i] === "+" || s[i] === "-")) i++;
  return consumeDigits(s, i);
}

// ---------------------------------------------------------------------------
// parseReal — @see xdot.c:parseReal
// ---------------------------------------------------------------------------
export function parseReal(s: string, pos: number): PR<number> {
  let i = skipWs(s, pos);
  const start = i;
  if (i < s.length && (s[i] === "-" || s[i] === "+")) i++;
  const digStart = i;
  i = consumeDigits(s, i);
  if (i < s.length && s[i] === ".") { i++; i = consumeDigits(s, i); }
  i = consumeExponent(s, i);
  if (i === start || i === digStart) return null;
  return { val: parseFloat(s.slice(start, i)), pos: i };
}

// ---------------------------------------------------------------------------
// parseInt_ — @see xdot.c:parseInt
// ---------------------------------------------------------------------------
export function parseInt_(s: string, pos: number): PR<number> {
  let i = skipWs(s, pos);
  const start = i;
  if (i < s.length && (s[i] === "-" || s[i] === "+")) i++;
  const digStart = i;
  i = consumeDigits(s, i);
  if (i === digStart) return null;
  return { val: parseInt(s.slice(start, i), 10), pos: i };
}

// ---------------------------------------------------------------------------
// parseUInt_ — @see xdot.c:parseUInt
// ---------------------------------------------------------------------------
export function parseUInt_(s: string, pos: number): PR<number> {
  const i = skipWs(s, pos);
  const end = consumeDigits(s, i);
  if (end === i) return null;
  return { val: parseInt(s.slice(i, end), 10), pos: end };
}

// ---------------------------------------------------------------------------
// parseRect — @see xdot.c:parseRect
// ---------------------------------------------------------------------------
export function parseRect(s: string, pos: number): PR<XdotRect> {
  const rx = parseReal(s, pos); if (!rx) return null;
  const ry = parseReal(s, rx.pos); if (!ry) return null;
  const rw = parseReal(s, ry.pos); if (!rw) return null;
  const rh = parseReal(s, rw.pos); if (!rh) return null;
  return { val: { x: rx.val, y: ry.val, w: rw.val, h: rh.val }, pos: rh.pos };
}

// ---------------------------------------------------------------------------
// parsePoint / parsePolyline — @see xdot.c:parsePolyline
// ---------------------------------------------------------------------------
function parsePoint(s: string, pos: number): PR<XdotPoint> {
  const rx = parseReal(s, pos); if (!rx) return null;
  const ry = parseReal(s, rx.pos); if (!ry) return null;
  return { val: { x: rx.val, y: ry.val, z: 0 }, pos: ry.pos };
}

export function parsePolyline(s: string, pos: number): PR<XdotPolyline> {
  const ri = parseUInt_(s, pos); if (!ri) return null;
  let cur = ri.pos;
  const pts: XdotPoint[] = [];
  for (let i = 0; i < ri.val; i++) {
    const rp = parsePoint(s, cur); if (!rp) return null;
    pts.push(rp.val);
    cur = rp.pos;
  }
  return { val: { pts }, pos: cur };
}

// ---------------------------------------------------------------------------
// parseString — @see xdot.c:parseString
// len counts source characters; a lone `\` is an escape prefix (not counted).
// ---------------------------------------------------------------------------
function nextAccounted(ch: string, prev: string, n: number): number {
  return (ch !== "\\" || prev === "\\") ? n + 1 : n;
}

export function parseString(s: string, pos: number): PR<string> {
  const ri = parseInt_(s, pos);
  if (!ri || ri.val <= 0) return null;
  const len = ri.val;
  let cur = skipWs(s, ri.pos);
  if (s[cur] !== "-") return null;
  cur++;
  let out = "";
  let accounted = 0;
  for (let j = 0; accounted < len; j++) {
    if (cur + j >= s.length) return null;
    const ch = s[cur + j];
    out += ch;
    accounted = nextAccounted(ch, j > 0 ? s[cur + j - 1] : "", accounted);
    if (accounted >= len) return { val: out, pos: cur + j + 1 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// parseAlign — @see xdot.c:parseAlign
// ---------------------------------------------------------------------------
export function parseAlign(s: string, pos: number): PR<XdotAlign> {
  const ri = parseInt_(s, pos); if (!ri) return null;
  const align: XdotAlign = ri.val < 0 ? "left" : ri.val > 0 ? "right" : "center";
  return { val: align, pos: ri.pos };
}
