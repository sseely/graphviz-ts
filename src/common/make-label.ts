// SPDX-License-Identifier: EPL-2.0

/**
 * Label construction for plain-text node labels.
 *
 * @see lib/common/labels.c:make_label
 */

import type { TextlabelT } from './types.js';
import type { TextMeasurer, TextSize } from './textmeasure.js';
import type { TextSpan } from './emit-types.js';

export const DEFAULT_FONTSIZE = 14.0;
export const DEFAULT_FONTNAME = 'Times,serif';
export const DEFAULT_COLOR = 'black';

/** Build a single TextSpan for a measured plain-text label. */
function buildSpan(
  text: string,
  fontname: string,
  fontsize: number,
  fontcolor: string,
  measured: TextSize,
): TextSpan {
  return {
    str: text,
    fontName: fontname,
    fontSize: fontsize,
    fontColor: fontcolor,
    fontFlags: 0,
    yoffset_layout: 0,
    yoffset_centerline: 0.1 * fontsize,
    size: { x: measured.w, y: measured.h },
    just: 'n',
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
  const measured = measurer.measure(text, fontname, fontsize);
  const span = buildSpan(text, fontname, fontsize, fontcolor, measured);
  return {
    text,
    fontname,
    fontcolor,
    charset: 0,
    fontsize,
    dimen: { x: measured.w, y: measured.h },
    space: { x: measured.w, y: measured.h },
    pos: { x: 0, y: 0 },
    u: { kind: 'txt', span: [span], nspans: 1 },
    valign: 'c'.charCodeAt(0),
    set: false,
    html: false,
  };
}
