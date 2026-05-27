// SPDX-License-Identifier: EPL-2.0
/**
 * Color translation utilities ported from lib/common/colxlate.c.
 *
 * @see lib/common/colxlate.c
 */

import { isExactlyEqual } from '../util/math.js';
import { COLOR_LIB } from './colorData.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GVColor =
  | { type: 'rgba'; r: number; g: number; b: number; a: number }
  | { type: 'hsva'; h: number; s: number; v: number; a: number }
  | { type: 'string'; s: string }
  | { type: 'none' };

export type ColorType = 'rgba' | 'hsva' | 'string';

/** @see lib/common/colxlate.c colorxlate return values */
export const enum ColorxlateResult {
  ColorOk = 0,
  ColorUnknown = 1,
  ColorError = 2,
}

// Internal helper interfaces declared at top so type aliases between functions
// do not confuse lizard's TypeScript parser.
interface RgbaTuple { r: number; g: number; b: number; a: number }
interface HsvaTuple { H: number; S: number; V: number; A: number }

// ---------------------------------------------------------------------------
// Module-level color scheme state  (@see lib/common/colxlate.c:colorscheme)
// ---------------------------------------------------------------------------

let colorScheme: string = '';

/** @see lib/common/colxlate.c:setColorScheme */
export function setColorScheme(scheme: string): void {
  colorScheme = scheme;
}

/** Returns the active color scheme (empty string means X11 default). */
export function getColorScheme(): string {
  return colorScheme;
}

// ---------------------------------------------------------------------------
// hsv2rgb  (@see lib/common/colxlate.c:hsv2rgb)
// ---------------------------------------------------------------------------

/** Switch on hue sector i; extracted to keep hsv2rgb under 30 lines. */
function hsv2rgbSwitch(
  i: number,
  v: number,
  p: number,
  q: number,
  t: number,
): { r: number; g: number; b: number } {
  switch (i) {
    case 0: return { r: v, g: t, b: p };
    case 1: return { r: q, g: v, b: p };
    case 2: return { r: p, g: v, b: t };
    case 3: return { r: p, g: q, b: v };
    case 4: return { r: t, g: p, b: v };
    default: return { r: v, g: p, b: q }; // case 5
  }
}

/**
 * Convert HSV (all in [0,1]) to RGB (all in [0,1]).
 * Exact algorithm from colxlate.c:hsv2rgb.
 *
 * @see lib/common/colxlate.c:hsv2rgb
 */
export function hsv2rgb(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  if (s <= 0.0) return { r: v, g: v, b: v };
  if (h >= 1.0) h = 0.0;
  h = 6.0 * h;
  const i = Math.trunc(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  return hsv2rgbSwitch(i, v, p, q, t);
}

// ---------------------------------------------------------------------------
// rgb2hsv  (@see lib/common/colxlate.c:rgb2hsv)
// ---------------------------------------------------------------------------

/** Compute raw hue value [0..6); extracted to keep rgb2hsv under 30 lines. */
function computeHue(
  r: number,
  g: number,
  b: number,
  rgbmax: number,
  rgbmin: number,
): number {
  const denom = rgbmax - rgbmin;
  const rc = (rgbmax - r) / denom;
  const gc = (rgbmax - g) / denom;
  const bc = (rgbmax - b) / denom;
  if (isExactlyEqual(r, rgbmax)) return bc - gc;
  if (isExactlyEqual(g, rgbmax)) return 2 + rc - bc;
  return 4 + gc - rc; // b == rgbmax
}

/**
 * Convert RGB (all in [0,1]) to HSV (all in [0,1]).
 * Exact algorithm from colxlate.c:rgb2hsv.
 *
 * @see lib/common/colxlate.c:rgb2hsv
 */
export function rgb2hsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  const rgbmin = Math.min(r, Math.min(g, b));
  const rgbmax = Math.max(r, Math.max(g, b));
  let st = 0.0;
  let ht = 0.0;
  if (rgbmax > 0.0) st = (rgbmax - rgbmin) / rgbmax;
  if (st > 0.0) {
    ht = computeHue(r, g, b, rgbmax, rgbmin) * 60.0;
    if (ht < 0.0) ht += 360.0;
  }
  return { h: ht / 360.0, v: rgbmax, s: st };
}

// ---------------------------------------------------------------------------
// Color scheme resolution  (@see lib/common/colxlate.c:resolveColor)
// ---------------------------------------------------------------------------

/**
 * Returns true if scheme is set, non-empty, and NOT "X11" (case-insensitive).
 * Mirrors ISNONDFLT macro from colxlate.c.
 */
function isNonDefaultScheme(scheme: string): boolean {
  if (!scheme || scheme.length === 0) return false;
  return scheme.toLowerCase() !== 'x11';
}

/**
 * Handle '/' prefixed color strings.
 * Extracted to keep resolveColor under 30 lines.
 *
 * @see lib/common/colxlate.c:resolveColor
 */
function resolveSlashColor(str: string): string {
  const c2 = str.slice(1); // drop leading '/'
  const ssIdx = c2.indexOf('/');
  if (ssIdx < 0) return c2; // one slash: /xxx => xxx
  if (c2.startsWith('/')) {
    const inner = c2.slice(1); // //yyy => yyy or /scheme/yyy
    return isNonDefaultScheme(colorScheme) ? `/${colorScheme}/${inner}` : inner;
  }
  if (c2.slice(0, 4).toLowerCase() !== 'x11/') return str; // /other/yyy => unchanged
  return c2.slice(ssIdx + 1); // /X11/yyy => yyy
}

/**
 * Resolve input color string allowing color scheme namespaces.
 * Faithful port of colxlate.c:resolveColor.
 *
 * @see lib/common/colxlate.c:resolveColor
 */
function resolveColor(str: string): string {
  if (str === 'black' || str === 'white' || str === 'lightgrey') return str;
  if (str.startsWith('/')) return resolveSlashColor(str);
  if (isNonDefaultScheme(colorScheme)) return `/${colorScheme}/${str}`;
  return str;
}

// ---------------------------------------------------------------------------
// Binary search  (@see lib/common/colxlate.c:bsearch + colorcmpf)
// ---------------------------------------------------------------------------

/**
 * Binary search COLOR_LIB by name (case-insensitive).
 * Returns RgbaTuple with 0-255 values, or null if not found.
 *
 * @see lib/common/colxlate.c:colorcmpf / bsearch
 */
function lookupColor(name: string): RgbaTuple | null {
  const target = name.toLowerCase();
  let lo = 0;
  let hi = COLOR_LIB.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cmp = COLOR_LIB[mid][0].toLowerCase().localeCompare(target);
    if (cmp < 0) lo = mid + 1;
    else if (cmp > 0) hi = mid - 1;
    else return { r: COLOR_LIB[mid][4], g: COLOR_LIB[mid][5], b: COLOR_LIB[mid][6], a: COLOR_LIB[mid][7] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Color field mutation helpers
// ---------------------------------------------------------------------------

/** Mutate color in-place to rgba values (0-255 inputs). */
function setRgba(color: GVColor, r: number, g: number, b: number, a: number): void {
  const c = color as Record<string, unknown>;
  c['type'] = 'rgba';
  c['r'] = r / 255.0; c['g'] = g / 255.0; c['b'] = b / 255.0; c['a'] = a / 255.0;
}

/** Mutate color in-place to hsva, converting from 0-255 RGB inputs. */
function setHsvaFromRgb255(color: GVColor, r: number, g: number, b: number, a: number): void {
  const c = color as Record<string, unknown>;
  const { h, s, v } = rgb2hsv(r / 255.0, g / 255.0, b / 255.0);
  c['type'] = 'hsva'; c['h'] = h; c['s'] = s; c['v'] = v; c['a'] = a / 255.0;
}

/** Mutate color in-place to hsva (all [0,1] inputs). */
function setHsvaDirect(color: GVColor, h: number, s: number, v: number, a: number): void {
  const c = color as Record<string, unknown>;
  c['type'] = 'hsva'; c['h'] = h; c['s'] = s; c['v'] = v; c['a'] = a;
}

/** Mutate color in-place to rgba, converting from HSV [0,1] inputs. */
function setRgbaFromHsv(color: GVColor, h: number, s: number, v: number, a: number): void {
  const c = color as Record<string, unknown>;
  const rgb = hsv2rgb(h, s, v);
  c['type'] = 'rgba'; c['r'] = rgb.r; c['g'] = rgb.g; c['b'] = rgb.b; c['a'] = a;
}

/** Set color to opaque black for the given target type (unknown color fallback). */
function setBlackOpaque(color: GVColor, targetType: ColorType): void {
  if (targetType === 'rgba') setRgba(color, 0, 0, 0, 255);
  else if (targetType === 'hsva') setHsvaDirect(color, 0.0, 0.0, 0.0, 1.0);
}

// ---------------------------------------------------------------------------
// Hex and HSV string parsers
// ---------------------------------------------------------------------------

/** Parse "#rrggbb", "#rrggbbaa", or "#rgb". Returns null on failure. */
function parseHexColor(p: string): RgbaTuple | null {
  if (p.charAt(0) !== '#') return null;
  const m8 = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(p);
  if (m8) return { r: parseInt(m8[1], 16), g: parseInt(m8[2], 16), b: parseInt(m8[3], 16), a: parseInt(m8[4], 16) };
  const m6 = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(p);
  if (m6) return { r: parseInt(m6[1], 16), g: parseInt(m6[2], 16), b: parseInt(m6[3], 16), a: 255 };
  const m3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(p);
  if (!m3) return null;
  const r = parseInt(m3[1], 16); const g = parseInt(m3[2], 16); const b = parseInt(m3[3], 16);
  return { r: r | (r << 4), g: g | (g << 4), b: b | (b << 4), a: 255 };
}

/** Clamp a number to [0, 1]. */
function clamp01(x: number): number {
  return Math.max(0.0, Math.min(1.0, x));
}

/** Parse "H,S,V" or "H S V [A]" style strings. Returns null on failure. */
function parseHsvString(p: string): HsvaTuple | null {
  const first = p.charAt(0);
  if (first !== '.' && !(first >= '0' && first <= '9')) return null;
  const parts = p.replace(/,/g, ' ').trim().split(/\s+/);
  if (parts.length < 3) return null;
  const H = parseFloat(parts[0]); const S = parseFloat(parts[1]); const V = parseFloat(parts[2]);
  if (isNaN(H) || isNaN(S) || isNaN(V)) return null;
  const rawA = parts.length >= 4 ? parseFloat(parts[3]) : 1.0;
  return { H: clamp01(H), S: clamp01(S), V: clamp01(V), A: clamp01(isNaN(rawA) ? 1.0 : rawA) };
}

// ---------------------------------------------------------------------------
// colorxlate apply helpers (bundled args keep param count <= 5)
// ---------------------------------------------------------------------------

/** Apply parsed hex/named RGBA (0-255) to color based on targetType. */
function applyRgba255(color: GVColor, t: ColorType, rgba: RgbaTuple): void {
  if (t === 'rgba') setRgba(color, rgba.r, rgba.g, rgba.b, rgba.a);
  else if (t === 'hsva') setHsvaFromRgb255(color, rgba.r, rgba.g, rgba.b, rgba.a);
}

/** Apply HSV float [0,1] values to color based on targetType. */
function applyHsva(color: GVColor, t: ColorType, hsva: HsvaTuple): void {
  if (t === 'hsva') setHsvaDirect(color, hsva.H, hsva.S, hsva.V, hsva.A);
  else if (t === 'rgba') setRgbaFromHsv(color, hsva.H, hsva.S, hsva.V, hsva.A);
}

// ---------------------------------------------------------------------------
// colorxlate  (@see lib/common/colxlate.c:colorxlate)
// ---------------------------------------------------------------------------

/**
 * Translate a color string into a GVColor of the requested target type.
 * Mutates `color` in place (matching C's output-pointer convention).
 * Returns ColorxlateResult.ColorOk on success, ColorxlateResult.ColorUnknown
 * when the name is not found.
 *
 * @see lib/common/colxlate.c:colorxlate
 */
export function colorxlate(
  str: string,
  color: GVColor,
  targetType: ColorType,
): ColorxlateResult {
  const p = str.replace(/^ +/, '');
  const hex = parseHexColor(p);
  if (hex !== null) {
    applyRgba255(color, targetType, hex);
    return ColorxlateResult.ColorOk;
  }
  const hsv = parseHsvString(p);
  if (hsv !== null) {
    applyHsva(color, targetType, hsv);
    return ColorxlateResult.ColorOk;
  }
  const named = lookupColor(resolveColor(p));
  if (named !== null) {
    applyRgba255(color, targetType, named);
    return ColorxlateResult.ColorOk;
  }
  setBlackOpaque(color, targetType);
  return ColorxlateResult.ColorUnknown;
}
