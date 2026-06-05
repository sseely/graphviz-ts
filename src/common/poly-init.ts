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
import { bindShape } from './shapes.js';
import {
  makeLabel,
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

/** Assign computed polygon vertices to node shape_info. */
export function assignShapeInfo(n: Node, polyDesc: PolygonT): void {
  const w = (n.info.lw || DEFAULT_LW) + (n.info.rw || DEFAULT_RW);
  const h = n.info.ht || DEFAULT_HT;
  n.info.shape_info = {
    ...polyDesc,
    vertices: computeVertices(polyDesc, w, h),
  } as PolygonT;
}

/**
 * Initialise shape descriptor and label for a node before rendering.
 * @see lib/common/shapes.c:poly_init
 */
export function polyInit(n: Node, g: Graph, measurer: TextMeasurer): void {
  const shapeName = nodeAttr(n, g, 'shape') ?? 'ellipse';
  const labelText = nodeAttr(n, g, 'label') ?? n.name;
  const { fontname, fontsize, fontcolor } = readFontAttrs(n, g);

  n.info.shape = bindShape(shapeName);
  n.info.label = makeLabel(labelText, fontname, fontsize, fontcolor, measurer);

  const polyDesc = (n.info.shape as ShapeDesc).polygon;
  if (polyDesc !== null) assignShapeInfo(n, polyDesc);
}
