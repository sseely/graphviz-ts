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

/** LABEL_AT_BOTTOM=0, LABEL_AT_TOP=1, LABEL_AT_LEFT=2, LABEL_AT_RIGHT=4.
 *  @see lib/common/const.h */
const LABEL_AT_TOP = 1;
const LABEL_AT_LEFT = 2;
const LABEL_AT_RIGHT = 4;

/**
 * Cluster label-position flag from `labelloc` (top/bottom) AND `labeljust`
 * (left/right), mirroring C `do_graph_label`. The cluster default is TOP (the
 * root default is BOTTOM — see rootLabelPos); the labeljust logic is identical
 * for both. Both keys inherit from an ancestor's default (C `agget`), so read
 * them through graphAttrInherited — the same helper `label`/`fontname` use —
 * not raw `sg.attrs`, else an inherited `labelloc=bottom` is lost.
 * @see lib/common/input.c:858-877 do_graph_label
 */
function readLabelPos(sg: Graph): number {
  const loc = graphAttrInherited(sg, 'labelloc');
  let pos = loc && loc[0] === 'b' ? 0 : LABEL_AT_TOP;
  const just = graphAttrInherited(sg, 'labeljust');
  if (just) {
    if (just[0] === 'l') pos |= LABEL_AT_LEFT;
    else if (just[0] === 'r') pos |= LABEL_AT_RIGHT;
  }
  return pos;
}

/**
 * Read a graph attribute with subgraph→root inheritance, mirroring C's
 * agxget (late_nnstring(sg, agfindgraphattr(sg, key), ...) in do_graph_label):
 * a cluster inherits `fontname`/`fontsize`/`fontcolor` set on an ancestor
 * (e.g. root `graph[fontname=Arial]`) when it sets none of its own.
 * @see lib/common/input.c:do_graph_label
 */
function graphAttrInherited(sg: Graph, key: string): string | undefined {
  // Own value wins; otherwise the ancestor defaults SNAPSHOTTED when this
  // subgraph opened (not a live parent walk) — so an ancestor attribute set
  // later in statement order does not retroactively apply (2184).
  // @see lib/cgraph/graph.c:agsubg (parse-time defval copy)
  return sg.attrs.get(key) ?? sg.graphDefaultsSnapshot?.get(key);
}

function readFontParams(sg: Graph): { fontsize: number; fontname: string; fontcolor: string } {
  return {
    fontsize: parseFloat(graphAttrInherited(sg, 'fontsize') ?? '') || DEFAULT_FONTSIZE,
    fontname: graphAttrInherited(sg, 'fontname') ?? DEFAULT_FONTNAME,
    fontcolor: graphAttrInherited(sg, 'fontcolor') ?? DEFAULT_COLOR,
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
  // C reads agget(sg, "label"), which returns the value seeded at subgraph
  // creation from the nearest ancestor's default (agmakeattrs copies the parent
  // dict's defvals). So a cluster with no label of its own inherits a parent
  // cluster's — or even the root graph's — label. graphviz #1323's nested
  // cluster_mount1/cluster_mount2 (label commented out) inherit the enclosing
  // cluster_vfsmount's "struct vfsmount" and each render it.
  // @see lib/common/input.c:844 do_graph_label — agget(sg, "label")
  // @see lib/cgraph/attr.c:165 agmakeattrs — copies parent defvals at creation
  const str = graphAttrInherited(sg, 'label');
  if (!str) return;

  const { fontsize, fontname, fontcolor } = readFontParams(sg);
  const isHtml = isHtmlValue(str);
  const content = isHtml ? htmlValueContent(str) : str;
  const label = makeAnyLabel(content, isHtml, { fontname, fontsize, fontcolor }, measurer, sg);
  sg.info.label = label;
  sg.root.info.has_labels |= GRAPH_LABEL;

  if (sg === sg.root) return;
  sg.info.label_pos = readLabelPos(sg);
  applyLabelBorder(sg, { x: label.dimen.x + 4 * GAP, y: label.dimen.y + 2 * GAP });
}
