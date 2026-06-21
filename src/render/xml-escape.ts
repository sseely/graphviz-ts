// SPDX-License-Identifier: EPL-2.0
//
// XML escaping faithful to graphviz's gv_xml_escape (lib/util/xml.c). '<', '>',
// '"', and "'" are always escaped; '&' is escaped to &amp; only when it does
// not begin a valid entity (&name; / &#NNN; / &#xHH;). The text/tooltip variant
// additionally honors the {raw, dash, nbsp} flags used by the SVG plugin.

// Regexes for quote chars: /"/g and /'/g break Lizard's quote-tracker.
// Use these named patterns instead to avoid the parser bug.
const RE_DQUOTE = new RegExp('"', 'g');
const RE_SQUOTE = new RegExp("'", 'g');
// A bare '&' that does NOT begin a valid entity (&name; / &#NNN; / &#xHH;).
// Mirrors xml_isentity (lib/util/xml.c): only such '&' are escaped to &amp;.
const RE_AMP_NONENTITY = /&(?![A-Za-z]+;|#[0-9]+;|#x[0-9A-Fa-f]+;)/g;

/**
 * Base XML escape (gv_xml_escape with flags {0}): ids, titles, hrefs.
 * @see lib/util/xml.c gv_xml_escape / xml_core / xml_isentity
 */
export function escapeXml(s: string): string {
  let r = s.replace(RE_AMP_NONENTITY, '&amp;');
  r = r.replace(/</g, '&lt;');
  r = r.replace(/>/g, '&gt;');
  r = r.replace(RE_DQUOTE, '&quot;');
  r = r.replace(RE_SQUOTE, '&#39;');
  return r;
}

/**
 * Text/tooltip XML escape (gv_xml_escape with flags {raw, dash, nbsp}):
 * additionally escapes '-'→&#45;, newline/CR→&#10;/&#13;, and 2nd+ consecutive
 * spaces→&#160;. Used for textspans and tooltips.
 * @see plugin/core/gvrender_core_svg.c:546 (svg_textspan flags)
 */
export function escapeXmlText(s: string): string {
  let r = escapeXml(s);
  r = r.replace(/-/g, '&#45;');
  r = r.replace(/\n/g, '&#10;');
  r = r.replace(/\r/g, '&#13;');
  r = r.replace(/ {2,}/g, (m) => ' ' + '&#160;'.repeat(m.length - 1));
  return r;
}
