// SPDX-License-Identifier: EPL-2.0

/**
 * Style string tokenizer and gradient stop parser.
 *
 * @see lib/common/emit.c:parse_style (lines 4010-4074)
 * @see lib/common/emit.c:findStopColor (lines 4335-4364)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of style tokens returned by parseStyle. @see emit.c:FUNLIMIT */
const FUNLIMIT = 64;

/** Small tolerance for comparing segment fractions. @see emit.c:EPS */
const EPS = 1e-5;

// Internal charCodes used in token dispatch
const CHARCODE_LPAREN = '('.charCodeAt(0);
const CHARCODE_RPAREN = ')'.charCodeAt(0);
const SID = 1 as const;

// ---------------------------------------------------------------------------
// StyleToken helpers — extracted to a class so Lizard resets CCN boundary
// ---------------------------------------------------------------------------

/** Internal token produced by styleToken(). @see emit.c:token_t */
interface StyleToken {
  type: number;
  value: string;
}

/** StyleToken helpers. Each static method is CCN-bounded on its own. */
class StyleTokenHelper {
  /** Returns true when ch is a style-string delimiter. @see emit.c:is_style_delim */
  static isDelim(ch: string): boolean {
    return ch === '(' || ch === ')' || ch === ',' || ch === '';
  }

  /** Skip whitespace and comma characters; return new position. */
  static skipWs(s: string, pos: number): number {
    while (pos < s.length) {
      const c = s[pos];
      if (c === ' ' || c === '\t' || c === ',' || c === '\n') {
        pos++;
      } else {
        break;
      }
    }
    return pos;
  }

  /** True when ch terminates an identifier. Matches C: delim OR whitespace. */
  static isIdentStop(ch: string | undefined): boolean {
    return ch === undefined || ch === ' ' || ch === '\t' || ch === '\n' || StyleTokenHelper.isDelim(ch);
  }

  /** Advance past one identifier token (SID). Pre: s[pos] is not a delimiter. */
  static scanIdent(s: string, pos: number): { value: string; pos: number } {
    const start = pos;
    while (pos < s.length && !StyleTokenHelper.isIdentStop(s[pos])) pos++;
    return { value: s.slice(start, pos), pos };
  }

  /**
   * Parse one style token starting at pos (after WS skip).
   * Returns end-of-input token when pos >= s.length.
   *
   * @see lib/common/emit.c:style_token
   */
  static next(s: string, pos: number): { token: StyleToken; pos: number } {
    pos = StyleTokenHelper.skipWs(s, pos);
    if (pos >= s.length) return { token: { type: 0, value: '' }, pos };
    const ch = s[pos];
    if (ch === undefined) return { token: { type: 0, value: '' }, pos };
    if (ch === '(' || ch === ')') {
      return { token: { type: ch.charCodeAt(0), value: ch }, pos: pos + 1 };
    }
    const r = StyleTokenHelper.scanIdent(s, pos);
    return { token: { type: SID, value: r.value }, pos: r.pos };
  }
}

// ---------------------------------------------------------------------------
// ParseStyleHelper — drives the main parse loop
// ---------------------------------------------------------------------------

/** Drives the parse_style loop. Extracted to class for CCN reset. */
class ParseStyleHelper {
  private result: string[] = [];
  private buf = '';
  private fun = 0;
  private inParens = false;
  private error: 'nesting' | 'unmatched_close' | 'unmatched_open' | null = null;

  /** Flush the current buffer as a completed token. */
  private flush(): void {
    if (this.buf.length > 0 && this.fun < FUNLIMIT - 1) {
      this.result.push(this.buf);
      this.fun++;
      this.buf = '';
    }
  }

  /** Handle an open-paren token. Returns false on nesting error. */
  private handleOpen(): boolean {
    if (this.inParens) { this.error = 'nesting'; return false; }
    this.inParens = true;
    this.buf += '(';
    return true;
  }

  /** Handle a close-paren token. Returns false on unmatched error. */
  private handleClose(): boolean {
    if (!this.inParens) { this.error = 'unmatched_close'; return false; }
    this.inParens = false;
    this.buf += ')';
    return true;
  }

  /** Handle an SID (identifier) token. */
  private handleSid(value: string): void {
    if (!this.inParens) {
      this.flush();
      if (this.fun < FUNLIMIT - 1) this.buf = value;
    } else {
      this.buf += value;
    }
  }

  /**
   * Run the full parse loop over style string s.
   * Returns the token array, or null on parse error.
   *
   * @see lib/common/emit.c:parse_style
   */
  run(s: string): string[] | null {
    let pos = 0;
    while (pos < s.length) {
      const { token: c, pos: np } = StyleTokenHelper.next(s, pos);
      pos = np;
      if (c.type === 0) break;
      if (c.type === CHARCODE_LPAREN) { if (!this.handleOpen()) return null; }
      else if (c.type === CHARCODE_RPAREN) { if (!this.handleClose()) return null; }
      else { this.handleSid(c.value); }
    }
    if (this.inParens) { this.error = 'unmatched_open'; return null; }
    this.flush();
    void this.error; // suppress unused-variable lint
    return this.result;
  }
}

// ---------------------------------------------------------------------------
// parseStyle — public API
// ---------------------------------------------------------------------------

/**
 * Parse a Graphviz style string into an array of style tokens.
 *
 * Tokens inside parentheses are appended to the preceding token (e.g.
 * "setlinewidth(2)" becomes one entry). Returns null on parse error.
 *
 * @see lib/common/emit.c:parse_style (line 4010)
 */
export function parseStyle(s: string): string[] | null {
  return new ParseStyleHelper().run(s);
}

// ---------------------------------------------------------------------------
// ColorSeg helpers — extracted to class for CCN boundary
// ---------------------------------------------------------------------------

/** A parsed color segment with optional fractional size. */
interface ColorSeg {
  color: string | null;
  t: number;
  hasFraction: boolean;
}

/** Helpers for parseSegs and findStopColor. */
class ColorSegHelper {
  /**
   * Parse optional semicolon-separated fraction from a raw color token.
   * Returns t=-1 to signal a parse error.
   *
   * @see lib/common/emit.c:getSegLen
   */
  static getSegLen(colorToken: string): { color: string; t: number } {
    const semi = colorToken.indexOf(';');
    if (semi < 0) return { color: colorToken, t: 0 };
    const color = colorToken.slice(0, semi);
    const v = parseFloat(colorToken.slice(semi + 1));
    if (!isNaN(v) && v >= 0) return { color, t: v };
    return { color, t: -1 };
  }

  /** Distribute remaining fraction to zero-t segments, or last segment. */
  static distributeLeft(segs: ColorSeg[], left: number): void {
    const zeroCnt = segs.filter((s) => s.t <= 0).length;
    if (zeroCnt > 0) {
      const delta = left / zeroCnt;
      for (const s of segs) {
        if (s.t <= 0) s.t = delta;
      }
    } else if (segs.length > 0) {
      const last = segs[segs.length - 1];
      if (last !== undefined) last.t += left;
    }
  }

  /** Drop trailing zero-t segments in place. */
  static trimTrailing(segs: ColorSeg[]): void {
    while (segs.length > 0) {
      const last = segs[segs.length - 1];
      if (last !== undefined && last.t > 0) break;
      segs.pop();
    }
  }

  /**
   * Parse one colon-separated part, apply left-budget clamping, push to segs.
   * Returns false on error.
   */
  static parsePart(
    part: string,
    segs: ColorSeg[],
    leftRef: { v: number },
  ): boolean {
    const { color, t } = ColorSegHelper.getSegLen(part.trim());
    if (t < 0) return false;
    const hasFraction = t > 0;
    let segT = t;
    if (hasFraction) {
      if (segT - leftRef.v > EPS) segT = leftRef.v;
      leftRef.v -= segT;
    }
    segs.push({ color: color.length > 0 ? color : null, t: segT, hasFraction });
    return true;
  }
}

// ---------------------------------------------------------------------------
// parseSegs — internal
// ---------------------------------------------------------------------------

/**
 * Parse a colon-separated color list with optional fractional sizes.
 * Returns null on parse error.
 *
 * @see lib/common/emit.c:parseSegs
 */
function parseSegs(clrs: string): ColorSeg[] | null {
  const segs: ColorSeg[] = [];
  const leftRef = { v: 1.0 };
  for (const part of clrs.split(':')) {
    if (!ColorSegHelper.parsePart(part, segs, leftRef)) return null;
    if (leftRef.v < EPS) { leftRef.v = 0; break; }
  }
  if (leftRef.v > EPS) ColorSegHelper.distributeLeft(segs, leftRef.v);
  ColorSegHelper.trimTrailing(segs);
  return segs;
}

// ---------------------------------------------------------------------------
// findStopColor — public API
// ---------------------------------------------------------------------------

/**
 * Extract gradient stop fraction from the first two parsed segments.
 * Uses explicit index checks instead of optional chaining to keep CCN low.
 *
 * @see lib/common/emit.c:findStopColor
 */
function extractFrac(segs: ColorSeg[]): number {
  const s0 = segs[0];
  if (s0 !== undefined && s0.hasFraction) return s0.t;
  const s1 = segs[1];
  if (s1 !== undefined && s1.hasFraction) return 1 - s1.t;
  return 0;
}

/** Populate clrs[0]/clrs[1] from the first two segments of segs. */
function populateClrs(
  segs: ColorSeg[],
  clrs: [string | null, string | null],
): void {
  const s0 = segs[0];
  clrs[0] = s0 !== undefined ? s0.color : null;
  const s1 = segs[1];
  clrs[1] = s1 !== undefined ? s1.color : null;
}

/**
 * Parse a gradient color list and return at most 2 colors and a stop fraction.
 *
 * Returns true when a gradient (at least 2 non-null colors) is found.
 * `clrs[0]` and `clrs[1]` receive the first two color strings (null if absent).
 * `frac.value` receives the gradient stop fraction (0 if not specified).
 *
 * @see lib/common/emit.c:findStopColor (line 4335)
 */
export function findStopColor(
  colorlist: string,
  clrs: [string | null, string | null],
  frac: { value: number },
): boolean {
  clrs[0] = null;
  clrs[1] = null;
  frac.value = 0;
  const segs = parseSegs(colorlist);
  const seg0 = segs !== null ? segs[0] : undefined;
  if (segs === null || segs.length < 2 || seg0 === undefined || seg0.color === null) {
    return false;
  }
  populateClrs(segs, clrs);
  frac.value = extractFrac(segs);
  return true;
}
