// SPDX-License-Identifier: EPL-2.0

/**
 * HTML-string marking. cgraph tags strings created from `label=<...>` via
 * a flag on the refstr (aghtmlstr); this port marks the attribute value
 * with a leading control character that cannot appear in DOT input.
 *
 * @see lib/cgraph/refstr.c:aghtmlstr
 */

/** Marker prefix identifying an attribute value parsed from `<...>`. */
export const HTML_STRING_MARK = '\u0001';

/** True when the attribute value came from an HTML `<...>` literal. */
export function isHtmlValue(s: string): boolean {
  return s.startsWith(HTML_STRING_MARK);
}

/** Strip the HTML marker, returning the markup content. */
export function htmlValueContent(s: string): string {
  return s.slice(HTML_STRING_MARK.length);
}
