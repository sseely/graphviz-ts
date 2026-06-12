// SPDX-License-Identifier: EPL-2.0
/**
 * Common node geometry initialisation shared by all layout engines.
 * Ports common_init_node / gv_nodesize from lib/common/utils.c: binds
 * the shape, builds the label (text/html/record), and sizes the node
 * from the label via the poly_init port.
 *
 * @see lib/common/utils.c:common_init_node
 * @see lib/common/utils.c:gv_nodesize
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { TextMeasurer } from './textmeasure.js';
import type { PolygonT, ShapeDesc, TextlabelT } from './types.js';
import { ShapeKind } from './types.js';
import { bindShape } from './shapes.js';
import { assignShapeInfo, buildNodeLabel, nodeAttr, readFontAttrs } from './poly-init.js';
import { makeAnyLabel } from './make-label.js';
import { isHtmlValue, htmlValueContent } from './html-string.js';
import { NODE_XLABEL } from '../layout/dot/rank.js';
import { recordNodeInit } from './record.js';
import {
  gvNodesize,
  polySize,
  type PolySizeParams,
  type PolySizeResult,
} from './poly-sizing.js';

/** Default node half-width in points. C: DEFAULT_NODEWIDTH=0.75in/2 * 72 = 27 */
export const DEFAULT_NODE_LW = 27;
/** Default node full-height in points. C: DEFAULT_NODEHEIGHT=0.5in * 72 = 36 */
export const DEFAULT_NODE_HT = 36;

/** @see lib/common/const.h:DEFAULT_NODEWIDTH / MIN_NODEWIDTH */
const DEFAULT_NODEWIDTH = 0.75;
const MIN_NODEWIDTH = 0.01;
/** @see lib/common/const.h:DEFAULT_NODEHEIGHT / MIN_NODEHEIGHT */
const DEFAULT_NODEHEIGHT = 0.5;
const MIN_NODEHEIGHT = 0.02;

/** Parse a double attr with default and minimum. @see lib/common/utils.c:late_double */
export function lateDouble(
  s: string | undefined,
  defaultValue: number,
  minimum: number,
): number {
  if (s === undefined || s === '') return defaultValue;
  const rv = parseFloat(s);
  if (Number.isNaN(rv)) return defaultValue;
  return rv < minimum ? minimum : rv;
}

/** Parse an int attr with default and minimum. @see lib/common/utils.c:late_int */
export function lateInt(
  s: string | undefined,
  defaultValue: number,
  minimum: number,
): number {
  if (s === undefined || s === '') return defaultValue;
  const rv = parseInt(s, 10);
  if (Number.isNaN(rv)) return defaultValue;
  return rv < minimum ? minimum : rv;
}

/** @see lib/common/utils.c:mapbool */
function mapbool(s: string | undefined): boolean {
  if (!s || s.toLowerCase() === 'false' || s.toLowerCase() === 'no') return false;
  if (s.toLowerCase() === 'true' || s.toLowerCase() === 'yes') return true;
  const n = parseInt(s, 10);
  return !Number.isNaN(n) && n !== 0;
}

/** The text measurer threaded through the GVC context, if any. */
export function layoutMeasurer(g: Graph): TextMeasurer | undefined {
  const gvc = g.root.info.gvc as { textMeasurer?: TextMeasurer } | undefined;
  return gvc?.textMeasurer;
}

/**
 * Resolve sides/skew/distortion: builtin descriptors win; shape=polygon
 * (sides == 0) reads the attrs. @see lib/common/shapes.c:poly_init
 */
function resolvePolyGeometry(
  n: Node,
  g: Graph,
  poly: PolygonT,
): { sides: number; skew: number; distortion: number } {
  if (poly.sides !== 0) {
    return { sides: poly.sides, skew: poly.skew, distortion: poly.distortion };
  }
  return {
    skew: lateDouble(nodeAttr(n, g, 'skew'), 0.0, -100.0),
    sides: lateInt(nodeAttr(n, g, 'sides'), 4, 0),
    distortion: lateDouble(nodeAttr(n, g, 'distortion'), 0.0, -100.0),
  };
}

/** User size in points: max of set width/height attrs, 0 when unset. @see shapes.c:userSize */
function userSizePts(n: Node, g: Graph): number {
  const uw = lateDouble(nodeAttr(n, g, 'width'), 0.0, MIN_NODEWIDTH);
  const uh = lateDouble(nodeAttr(n, g, 'height'), 0.0, MIN_NODEHEIGHT);
  return 72 * Math.max(uw, uh);
}

/** Size-related plain attrs read by poly_init. */
function sizeAttrs(
  n: Node,
  g: Graph,
): Pick<PolySizeParams, 'widthIn' | 'heightIn' | 'userSizePts' | 'margin' | 'fixedsize' | 'labelloc' | 'quantumIn'> {
  return {
    widthIn: lateDouble(nodeAttr(n, g, 'width'), DEFAULT_NODEWIDTH, MIN_NODEWIDTH),
    heightIn: lateDouble(nodeAttr(n, g, 'height'), DEFAULT_NODEHEIGHT, MIN_NODEHEIGHT),
    userSizePts: userSizePts(n, g),
    margin: nodeAttr(n, g, 'margin'),
    fixedsize: nodeAttr(n, g, 'fixedsize') ?? 'false',
    labelloc: nodeAttr(n, g, 'labelloc'),
    quantumIn: lateDouble(g.root.attrs.get('quantum'), 0.0, 0.0),
  };
}

/**
 * Resolve poly_init's sizing inputs from node attrs and the bound
 * polygon descriptor.
 * @see lib/common/shapes.c:poly_init (attribute resolution)
 */
export function polySizeParamsFromNode(
  n: Node,
  g: Graph,
  shape: ShapeDesc & { polygon: PolygonT },
  labelDimen: { x: number; y: number },
  flip: boolean,
): PolySizeParams {
  const poly = shape.polygon;
  return {
    labelDimen,
    ...resolvePolyGeometry(n, g, poly),
    ...sizeAttrs(n, g),
    peripheries: lateInt(nodeAttr(n, g, 'peripheries'), poly.peripheries, 0),
    orientation: poly.orientation + lateDouble(nodeAttr(n, g, 'orientation'), 0.0, -360.0),
    regular: poly.regular || mapbool(nodeAttr(n, g, 'regular')),
    isPlain: shape.name === 'plain',
    flip,
  };
}

/**
 * Create ND_xlabel when the xlabel attr is non-empty and set NODE_XLABEL.
 * @see lib/common/utils.c:443-447
 * @see lib/common/utils.c:447 — GD_has_labels scoped to agraphof(n) root
 */
function initNodeXLabel(n: Node, g: Graph, measurer: TextMeasurer): void {
  const str = nodeAttr(n, g, 'xlabel');
  if (!str || str.length === 0) return;
  const font = readFontAttrs(n, g);
  const isHtml = isHtmlValue(str);
  const content = isHtml ? htmlValueContent(str) : str;
  // utils.c:444 — make_label(n, str, aghtmlstr(str), false, ...)
  n.info.xlabel = makeAnyLabel(content, isHtml, font, measurer);
  g.root.info.has_labels = (g.root.info.has_labels ?? 0) | NODE_XLABEL;
}

/**
 * Build the label and size the node from it, mirroring
 * common_init_node + the shape initfn. Returns false when the shape
 * has no polygon descriptor to size against.
 * @see lib/common/utils.c:common_init_node
 */
function initNodeFromLabel(n: Node, g: Graph, measurer: TextMeasurer): boolean {
  const shape = bindShape(nodeAttr(n, g, 'shape') ?? 'ellipse');
  n.info.shape = shape;
  if (shape.kind === ShapeKind.SH_RECORD) {
    recordNodeInit(n, g, measurer); // sets lw/rw/ht from the field tree
    return true;
  }
  buildNodeLabel(n, g, measurer);
  initNodeXLabel(n, g, measurer);
  const poly = shape.polygon;
  if (poly === null) return false;
  const label = n.info.label as TextlabelT;
  const flip = g.root.info.flip === true;
  const params = polySizeParamsFromNode(n, g, { ...shape, polygon: poly }, label.dimen, flip);
  // Unflipped size first so width/height (inches) match C's ND_width/ND_height.
  storeNodeSize(n, polySize({ ...params, flip: false }), flip);
  // C poly_init installs the ATTR-RESOLVED polygon into ND_shape_info
  // (sides/orientation/skew/distortion/peripheries/regular); edge
  // clipping and rendering read it.
  assignShapeInfo(n, effectivePolygon(poly, params));
  return true;
}

/** The attr-resolved polygon poly_init stores. @see shapes.c:poly_init (poly->... assignments) */
function effectivePolygon(poly: PolygonT, p: PolySizeParams): PolygonT {
  let sides = p.sides;
  // ellipses with distortion/skew become 120-gons
  if (sides <= 2 && (p.distortion !== 0 || p.skew !== 0)) sides = 120;
  return {
    ...poly,
    regular: p.regular,
    peripheries: p.peripheries,
    sides,
    orientation: p.orientation,
    distortion: p.distortion,
    skew: p.skew,
  };
}

/** Write polySize results onto the node (gv_nodesize flip applied last). */
function storeNodeSize(n: Node, unflipped: PolySizeResult, flip: boolean): void {
  const widthPts = unflipped.lw + unflipped.rw;
  n.info.width = widthPts / 72;
  n.info.height = unflipped.ht / 72;
  n.info.outline_width = unflipped.outlineW / 72;
  n.info.outline_height = unflipped.outlineH / 72;
  const size = gvNodesize(widthPts, unflipped.ht, flip);
  n.info.lw = size.lw;
  n.info.rw = size.rw;
  n.info.ht = size.ht;
}

/** Pre-T1 fallback sizing from width/height attrs only (no measurer). */
function initNodeDefaults(n: Node, g: Graph): void {
  const widthIn = lateDouble(nodeAttr(n, g, 'width'), DEFAULT_NODEWIDTH, MIN_NODEWIDTH);
  const heightIn = lateDouble(nodeAttr(n, g, 'height'), DEFAULT_NODEHEIGHT, MIN_NODEHEIGHT);
  const flip = g.root.info.flip === true;
  const w = flip ? heightIn : widthIn;
  const h = flip ? widthIn : heightIn;
  if (!n.info.lw) n.info.lw = Math.max((w * 72) / 2, DEFAULT_NODE_LW);
  if (!n.info.rw) n.info.rw = Math.max((w * 72) / 2, DEFAULT_NODE_LW);
  if (!n.info.ht) n.info.ht = Math.max(h * 72, DEFAULT_NODE_HT);
}

/**
 * Initialise per-node geometry: shape-aware, label-driven sizing when a
 * text measurer is available; width/height attr defaults otherwise.
 * @see lib/common/utils.c:common_init_node
 * @see lib/common/utils.c:gv_nodesize
 */
export function commonInitNode(n: Node, g: Graph): void {
  const measurer = layoutMeasurer(g);
  if (measurer !== undefined && initNodeFromLabel(n, g, measurer)) return;
  initNodeDefaults(n, g);
}

/** Call commonInitNode for every node in the graph. */
export function commonInitNodeEdge(g: Graph): void {
  for (const n of g.nodes.values()) commonInitNode(n, g);
}
