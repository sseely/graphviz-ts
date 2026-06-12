// SPDX-License-Identifier: EPL-2.0

/**
 * Cluster label dimension setup for dot layout.
 *
 * @see lib/common/input.c:do_graph_label
 */

import type { Graph } from '../../model/graph.js';
import type { Point } from '../../model/geom.js';
import type { TextMeasurer } from '../../common/textmeasure.js';
import { makeAnyLabel, DEFAULT_FONTSIZE, DEFAULT_FONTNAME, DEFAULT_COLOR } from '../../common/make-label.js';
import { isHtmlValue, htmlValueContent } from '../../common/html-string.js';
import { BOTTOM_IX, TOP_IX, RIGHT_IX, LEFT_IX } from './position-aux.js';

/** Graph has a label. @see lib/common/const.h:GRAPH_LABEL */
export const GRAPH_LABEL = 1 << 3;

/** @see lib/common/const.h:GAP */
const GAP = 4;

/** LABEL_AT_BOTTOM=0; LABEL_AT_TOP=1. @see lib/common/const.h */
function readLabelPos(sg: Graph): number {
  const loc = sg.attrs.get('labelloc');
  return loc && loc[0] === 'b' ? 0 : 1;
}

function readFontParams(sg: Graph): { fontsize: number; fontname: string; fontcolor: string } {
  return {
    fontsize: parseFloat(sg.attrs.get('fontsize') ?? '') || DEFAULT_FONTSIZE,
    fontname: sg.attrs.get('fontname') ?? DEFAULT_FONTNAME,
    fontcolor: sg.attrs.get('fontcolor') ?? DEFAULT_COLOR,
  };
}

/** Apply PAD and store in sg.info.border at the index appropriate for flip/pos. */
function applyLabelBorder(sg: Graph, dimen: Point): void {
  if (!sg.info.border) {
    sg.info.border = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  }
  const labelPos = sg.info.label_pos ?? 1;
  if (!sg.root.info.flip) {
    sg.info.border[(labelPos & 1) ? TOP_IX : BOTTOM_IX] = dimen;
  } else {
    sg.info.border[(labelPos & 1) ? RIGHT_IX : LEFT_IX] = { x: dimen.y, y: dimen.x };
  }
}

/**
 * Compute cluster label dimensions and set sg.info.border so that clustHt
 * accounts for label height.
 *
 * @see lib/common/input.c:do_graph_label
 * @see lib/common/input.c:850 — make_label(sg, str, aghtmlstr(str), false, ...)
 */
export function doGraphLabel(sg: Graph, measurer: TextMeasurer | undefined): void {
  if (!measurer) return;
  const str = sg.attrs.get('label');
  if (!str) return;

  const { fontsize, fontname, fontcolor } = readFontParams(sg);
  const isHtml = isHtmlValue(str);
  const content = isHtml ? htmlValueContent(str) : str;
  const label = makeAnyLabel(content, isHtml, { fontname, fontsize, fontcolor }, measurer);
  sg.info.label = label;
  sg.root.info.has_labels |= GRAPH_LABEL;

  if (sg === sg.root) return;
  sg.info.label_pos = readLabelPos(sg);
  applyLabelBorder(sg, { x: label.dimen.x + 4 * GAP, y: label.dimen.y + 2 * GAP });
}
