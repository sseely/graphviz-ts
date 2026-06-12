// SPDX-License-Identifier: EPL-2.0

/**
 * Shape and label initialisation for polygon nodes.
 *
 * @see lib/common/shapes.c:poly_init
 * @see lib/common/utils.c:common_init_node
 */

import type { Node } from '../model/node.js';
import type { Graph } from '../model/graph.js';
import type { TextMeasurer } from './textmeasure.js';
import type { PolygonT, ShapeDesc } from './types.js';
import { ShapeKind } from './types.js';
import type { TextlabelT } from './types.js';
import { bindShape } from './shapes.js';
import { isHtmlValue, htmlValueContent } from './html-string.js';
// Circular imports: poly-init ↔ record / htmltable-pos — safe for function declarations.
import { recordNodeInit } from './record.js';
import {
  makeAnyLabel,
  DEFAULT_FONTSIZE,
  DEFAULT_FONTNAME,
  DEFAULT_COLOR,
} from './make-label.js';
import { computeVertices } from './poly-vertices.js';

// Default half-dimensions in points (72 dpi, 0.75 in wide, 0.5 in tall)
const DEFAULT_LW = 27;
const DEFAULT_RW = 27;
const DEFAULT_HT = 36;

/**
 * Read attribute from node attrs → graph nodeDefaults → root nodeDefaults.
 * Matches graphviz attribute inheritance: lib/cgraph/attr.c:agxget
 */
export function nodeAttr(n: Node, g: Graph, key: string): string | undefined {
  return n.attrs.get(key)
    ?? g.nodeDefaults.get(key)
    ?? (g !== g.root ? g.root.nodeDefaults.get(key) : undefined);
}

/** Read label-font attributes from node, falling back to defaults. */
export function readFontAttrs(n: Node, g: Graph): {
  fontname: string;
  fontsize: number;
  fontcolor: string;
} {
  return {
    fontname:  nodeAttr(n, g, 'fontname')  ?? DEFAULT_FONTNAME,
    fontsize:  parseFloat(nodeAttr(n, g, 'fontsize') ?? String(DEFAULT_FONTSIZE)),
    fontcolor: nodeAttr(n, g, 'fontcolor') ?? DEFAULT_COLOR,
  };
}

/** Assign computed polygon vertices to node shape_info.
 *
 * Vertices are computed from the UNFLIPPED visual dimensions (width × 72,
 * height × 72) so that the rendered ellipse/polygon is always the
 * correct shape before any rotation is applied by gvPostprocess.
 *
 * n.info.width / n.info.height are stored in INCHES (unflipped) by
 * storeNodeSize (nodeinit.ts).  lw/rw/ht are the LAYOUT-FLIPPED values;
 * using them would produce swapped rx/ry for LR/RL graphs.
 *
 * @see lib/common/shapes.c:poly_init — vertices use bb.x/bb.y (unflipped)
 */
export function assignShapeInfo(n: Node, polyDesc: PolygonT): void {
  // Prefer the stored unflipped dimensions; fall back to lw+rw / ht for
  // the no-measurer path where width/height may not be set.
  const w = n.info.width !== undefined
    ? n.info.width * 72
    : (n.info.lw || DEFAULT_LW) + (n.info.rw || DEFAULT_RW);
  const h = n.info.height !== undefined
    ? n.info.height * 72
    : (n.info.ht || DEFAULT_HT);
  const base = n.info.base_width !== undefined && n.info.base_height !== undefined
    ? { w: n.info.base_width * 72, h: n.info.base_height * 72 }
    : undefined;
  n.info.shape_info = {
    ...polyDesc,
    vertices: computeVertices(polyDesc, w, h, base),
  } as PolygonT;
}

/**
 * Initialise shape descriptor and label for a node before rendering.
 * Record nodes are initialised during layout (their size depends on the
 * field tree); only build them here if layout did not.
 * @see lib/common/shapes.c:poly_init
 */
/** Build the node's label via the unified C make_label boundary. */
export function buildNodeLabel(n: Node, g: Graph, measurer: TextMeasurer): void {
  // Layout init may already have built the label; keep it (and any
  // position it acquired) rather than re-measuring at render time.
  if ((n.info.label as TextlabelT | undefined) !== undefined) return;
  const labelAttr = nodeAttr(n, g, 'label');
  const font = readFontAttrs(n, g);
  const isHtml = labelAttr !== undefined && isHtmlValue(labelAttr);
  const content = isHtml ? htmlValueContent(labelAttr) : (labelAttr ?? n.name);
  n.info.label = makeAnyLabel(content, isHtml, font, measurer, n);
}

export function polyInit(n: Node, g: Graph, measurer: TextMeasurer): void {
  const shapeName = nodeAttr(n, g, 'shape') ?? 'ellipse';
  n.info.shape = bindShape(shapeName);
  if ((n.info.shape as ShapeDesc).kind === ShapeKind.SH_RECORD) {
    if (n.info.shape_info === undefined) recordNodeInit(n, g, measurer);
    return;
  }
  buildNodeLabel(n, g, measurer);

  // Layout-time common_init_node already installed the attr-resolved
  // polygon; keep it (C never re-runs poly_init at render time).
  if (n.info.shape_info !== undefined) return;
  const polyDesc = (n.info.shape as ShapeDesc).polygon;
  if (polyDesc !== null) assignShapeInfo(n, polyDesc);
}
