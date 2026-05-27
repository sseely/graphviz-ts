// SPDX-License-Identifier: EPL-2.0
/**
 * @see lib/util/agxbuf.h
 * @see lib/util/agxbuf.c (agxbuf_trim_zeros)
 *
 * Dynamically expanding string buffer. SSO threshold need not be
 * replicated — only the observable contract matters.
 */

/**
 * Extensible string buffer, analogous to C's agxbuf.
 *
 * @see cgraph/agxbuf.h:agxbuf
 */
export class AgBuffer {
  private _data: string = "";

  /** @see cgraph/agxbuf.h:agxbput */
  append(s: string): this {
    this._data += s;
    return this;
  }

  /** @see cgraph/agxbuf.h:agxbputc */
  appendChar(c: string): this {
    this._data += c[0] ?? "";
    return this;
  }

  /**
   * Append first n characters of s.
   * @see cgraph/agxbuf.h:agxbput_n
   */
  appendN(s: string, n: number): this {
    this._data += s.slice(0, n);
    return this;
  }

  /** @see cgraph/agxbuf.h:agxbclear */
  clear(): void {
    this._data = "";
  }

  /**
   * Matches agxbuse semantics: resets the buffer and returns the content.
   * The returned string is valid only until the next write.
   * @see cgraph/agxbuf.h:agxbuse
   */
  str(): string {
    const result = this._data;
    this._data = "";
    return result;
  }

  /**
   * Caller takes ownership; buffer is reset.
   * @see cgraph/agxbuf.h:agxbdisown
   */
  disown(): string {
    return this.str();
  }

  /** @see cgraph/agxbuf.h:agxblen */
  length(): number {
    return this._data.length;
  }

  /**
   * Removes and returns the last character (UTF-16 charCodeAt semantics
   * matching C char-pop), or null if empty.
   * @see cgraph/agxbuf.h:agxbpop
   */
  pop(): string | null {
    if (this._data.length === 0) {
      return null;
    }
    const c = this._data[this._data.length - 1];
    this._data = this._data.slice(0, -1);
    return c;
  }

  /**
   * Trim trailing fractional zeros from a printed floating-point value.
   *
   * Examples:
   *   "42.00" → "42"
   *   "42.01" → "42.01"
   *   "42.10" → "42.1"
   *   "-0.0"  → "0"
   *
   * @see cgraph/agxbuf.h:agxbuf_trim_zeros
   */
  trimZeros(): void {
    const period = this._lastPeriodIndex();
    if (period < 0) return;
    const trimmed = this._trimFractional(period);
    if (trimmed !== null) this._data = trimmed;
  }

  /** Return index of last '.' in _data, or -1 if none. */
  private _lastPeriodIndex(): number {
    for (let i = this._data.length - 1; i >= 0; i--) {
      if (this._data[i] === ".") return i;
    }
    return -1;
  }

  /**
   * Walk backwards from end; trim trailing '0' digits then the '.' if all
   * fractional digits were zero. Returns the trimmed string, or null when
   * no trimming is needed.
   * @see cgraph/agxbuf.h:agxbuf_trim_zeros (truncate loop)
   */
  private _trimFractional(period: number): string | null {
    const s = this._data;
    let end = s.length;
    while (end > period + 1 && s[end - 1] === "0") {
      end--;
    }
    if (end === s.length) return null; // no trailing zeros
    if (end === period + 1) {
      return AgBuffer._fixNegativeZero(s.slice(0, period));
    }
    return s.slice(0, end);
  }

  /**
   * Replace trailing "-0" with "0".
   * @see cgraph/agxbuf.h:agxbuf_trim_zeros (-0 fix)
   */
  private static _fixNegativeZero(s: string): string {
    const n = s.length;
    if (n >= 2 && s[n - 2] === "-" && s[n - 1] === "0") {
      return s.slice(0, n - 2) + "0";
    }
    return s;
  }
}
