// SPDX-License-Identifier: EPL-2.0
/**
 * XML/SVG escaping.
 *
 * @see lib/util/xml.h
 * @see lib/util/xml.c
 */

/** Options to tweak the behaviour of XML escaping. @see lib/util/xml.h:xml_flags_t */
export interface XmlFlags {
  /** Escape & unconditionally; also escape \n and \r. */
  raw: boolean;
  /** Escape '-' as &#45;. */
  dash: boolean;
  /** Convert 2nd+ consecutive space to &#160;. */
  nbsp: boolean;
  /** Encode non-ASCII as &#xNNNN;. */
  utf8: boolean;
}

/**
 * XML-escape a string.
 *
 * @see lib/util/xml.c:gv_xml_escape
 */
export function gvXmlEscape(s: string, flags: XmlFlags): string {
  return XmlEscaper.escape(s, flags);
}

/**
 * Internal helpers grouped into a class so each method is measured
 * independently by complexity tooling. All methods are static.
 */
class XmlEscaper {
  static escape(s: string, flags: XmlFlags): string {
    let result = "";
    let previous = "";
    let pos = 0;
    while (pos < s.length) {
      const prev = s[pos];
      const [fragment, consumed] = XmlEscaper.core(previous, s, pos, flags);
      result += fragment;
      previous = prev;
      pos += consumed;
    }
    return result;
  }

  /**
   * Escape one character/codepoint at s[pos].
   * Returns [escaped_fragment, characters_consumed].
   * Delegates to focused helpers to stay within CCN limit.
   * @see lib/util/xml.c:xml_core
   */
  static core(
    previous: string,
    s: string,
    pos: number,
    flags: XmlFlags,
  ): [string, number] {
    const special = XmlEscaper.coreSpecial(previous, s, pos, flags);
    if (special !== null) return special;
    const code = s.charCodeAt(pos);
    if (code > 0x7f && flags.utf8) return XmlEscaper.utf8Entity(s, pos);
    return [s[pos], 1];
  }

  /**
   * Handle all the fixed-escape cases (& < > - space " ' \n \r).
   * Returns null when none of those cases applies.
   * @see lib/util/xml.c:xml_core
   */
  static coreSpecial(
    previous: string,
    s: string,
    pos: number,
    flags: XmlFlags,
  ): [string, number] | null {
    const c = s[pos];
    if (c === "&" && (flags.raw || !XmlEscaper.isEntity(s, pos))) {
      return ["&amp;", 1];
    }
    if (c === "<") return ["&lt;", 1];
    if (c === ">") return ["&gt;", 1];
    if (c === '"') return ["&quot;", 1];
    if (c === "'") return ["&#39;", 1];
    if (c === "-" && flags.dash) return ["&#45;", 1];
    if (c === " " && previous === " " && flags.nbsp) return ["&#160;", 1];
    if (c === "\n" && flags.raw) return ["&#10;", 1];
    if (c === "\r" && flags.raw) return ["&#13;", 1];
    return null;
  }

  /**
   * Return true if s[pos] (which is '&') starts a valid XML entity:
   *   &[A-Za-z]+;      e.g. &Ccedil;
   *   &#[0-9]*;        e.g. &#38;
   *   &#x[0-9a-fA-F]*; e.g. &#x6C34;
   * @see lib/util/xml.c:xml_isentity
   */
  static isEntity(s: string, pos: number): boolean {
    let i = pos + 1; // skip the known '&'
    if (i >= s.length || s[i] === ";") return false;
    i = s[i] === "#" ? XmlEscaper.scanNumericRef(s, i) : XmlEscaper.scanNamedRef(s, i);
    return i < s.length && s[i] === ";";
  }

  /** Scan a numeric entity body starting just after the '#'. */
  static scanNumericRef(s: string, hashPos: number): number {
    let i = hashPos + 1; // skip '#'
    if (i < s.length && (s[i] === "x" || s[i] === "X")) {
      i++;
      while (i < s.length && XmlEscaper.isXDigit(s[i])) i++;
    } else {
      while (i < s.length && XmlEscaper.isDecDigit(s[i])) i++;
    }
    return i;
  }

  /** Scan a named entity body (alpha chars after the '&'). */
  static scanNamedRef(s: string, start: number): number {
    let i = start;
    while (i < s.length && XmlEscaper.isAlpha(s[i])) i++;
    return i;
  }

  /**
   * Decode a multi-byte UTF-8 sequence at s[pos] and emit &#xNNNN;.
   * @see lib/util/xml.c:xml_core (UTF-8 block)
   */
  static utf8Entity(s: string, pos: number): [string, number] {
    const b0 = s.charCodeAt(pos) & 0xff;
    const cp = XmlEscaper.decodeUtf8(s, pos, b0);
    const consumed = XmlEscaper.utf8ByteLen(b0);
    return [`&#x${cp.toString(16)};`, consumed];
  }

  /** Decode the codepoint value from a multi-byte UTF-8 sequence. */
  static decodeUtf8(s: string, pos: number, b0: number): number {
    if ((b0 >> 5) === 6) {
      return ((b0 & 0x1f) << 6) | (s.charCodeAt(pos + 1) & 0x3f);
    }
    if ((b0 >> 4) === 14) {
      return (
        ((b0 & 0x0f) << 12) |
        ((s.charCodeAt(pos + 1) & 0x3f) << 6) |
        (s.charCodeAt(pos + 2) & 0x3f)
      );
    }
    if ((b0 >> 3) === 30) {
      return (
        ((b0 & 0x07) << 18) |
        ((s.charCodeAt(pos + 1) & 0x3f) << 12) |
        ((s.charCodeAt(pos + 2) & 0x3f) << 6) |
        (s.charCodeAt(pos + 3) & 0x3f)
      );
    }
    throw new Error(`gvXmlEscape: malformed UTF-8 at position ${pos}`);
  }

  /** Return the byte-length of a UTF-8 sequence from its leading byte. */
  static utf8ByteLen(b0: number): number {
    if ((b0 >> 5) === 6) return 2;
    if ((b0 >> 4) === 14) return 3;
    if ((b0 >> 3) === 30) return 4;
    throw new Error(`gvXmlEscape: invalid UTF-8 leading byte 0x${b0.toString(16)}`);
  }

  static isDecDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  static isAlpha(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
  }

  static isXDigit(c: string): boolean {
    return (
      XmlEscaper.isDecDigit(c) ||
      (c >= "a" && c <= "f") ||
      (c >= "A" && c <= "F")
    );
  }
}
