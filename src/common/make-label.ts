// SPDX-License-Identifier: EPL-2.0

/**
 * Label construction for plain-text and HTML node labels.
 * Unified entry point mirrors C labels.c:make_label which branches
 * internally on is_html.
 *
 * @see lib/common/labels.c:make_label
 * @see lib/common/htmltable.c:make_html_label
 */

import type { TextlabelT } from './types.js';
import type { TextMeasurer, TextSize } from './textmeasure.js';
import type { TextSpan } from './emit-types.js';
import { makeHtmlLabel } from './htmltable-pos.js';

export const DEFAULT_FONTSIZE = 14.0;
export const DEFAULT_FONTNAME = 'Times,serif';
export const DEFAULT_COLOR = 'black';

/** Font attributes bundle — mirrors C fontinfo_t fields used in label init. */
export interface FontInfo {
  fontname: string;
  fontsize: number;
  fontcolor: string;
}

function buildSpan(
  text: string,
  font: FontInfo,
  measured: TextSize,
): TextSpan {
  return {
    str: text,
    fontName: font.fontname,
    fontSize: font.fontsize,
    fontColor: font.fontcolor,
    fontFlags: 0,
    yoffset_layout: 0,
    yoffset_centerline: 0.05 * font.fontsize,
    size: { x: measured.w, y: measured.h },
    just: 'n',
  };
}

function makePlainLabel(
  text: string,
  font: FontInfo,
  measurer: TextMeasurer,
): TextlabelT {
  const measured = measurer.measure(text, font.fontname, font.fontsize);
  return {
    text, ...font, charset: 0,
    dimen: { x: measured.w, y: measured.h },
    space: { x: measured.w, y: measured.h },
    pos: { x: 0, y: 0 },
    u: { kind: 'txt', span: [buildSpan(text, font, measured)], nspans: 1 },
    valign: 'c'.charCodeAt(0),
    set: false, html: false,
  };
}

/**
 * Create a TextlabelT for a plain-text label string.
 * @see lib/common/labels.c:make_label
 */
export function makeLabel(
  text: string,
  fontname: string,
  fontsize: number,
  fontcolor: string,
  measurer: TextMeasurer,
): TextlabelT {
  return makePlainLabel(text, { fontname, fontsize, fontcolor }, measurer);
}

/**
 * Unified label entry mirroring C labels.c:make_label(obj, str, kind).
 *
 * C branches on `kind & LT_HTML` (labels.c:145,147). isHtml is the port
 * equivalent (aghtmlstr / HTML_STRING_MARK).
 *
 * Empty-string case (labels.c:119): "disregard HTML intent for empty
 * string labels" — C: is_html &= !streq(str, "");
 *
 * Parse-failure fallback (htmltable.c:1884-1907): "Parse of label failed;
 * revert to simple text label" — C sets lp->html=false and substitutes the
 * object name. The port has no object context so it keeps the markup text,
 * matching makeHtmlLabel's existing fallback contract.
 *
 * @see lib/common/labels.c:make_label
 * @see lib/common/htmltable.c:make_html_label
 */
export function makeAnyLabel(
  content: string,
  isHtml: boolean,
  font: FontInfo,
  measurer: TextMeasurer,
): TextlabelT {
  // labels.c:119 — is_html &= !streq(str, "");
  if (isHtml && content !== '') {
    // labels.c:145-161; htmltable.c:1856 — on parse failure falls back to
    // plain text (html=false) per htmltable.c:1892.
    return makeHtmlLabel(content, font, measurer);
  }
  return makePlainLabel(content, font, measurer);
}
