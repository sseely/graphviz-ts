// SPDX-License-Identifier: EPL-2.0

/**
 * Head/tail edge-label creation: port of the initFontLabelEdgeAttr +
 * head/tail-label blocks inside common_init_edge (lib/common/utils.c:533-545).
 *
 * Called from dotInitNodeEdge after the regular edge-weight fields are set,
 * mirroring the C call order in dot_init_node_edge → common_init_edge.
 *
 * @see lib/common/utils.c:common_init_edge
 * @see lib/common/utils.c:initFontEdgeAttr
 * @see lib/common/utils.c:initFontLabelEdgeAttr
 */

import type { Edge } from '../model/edge.js';
import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Port } from '../model/geom.js';
import { makePort } from '../model/edgeInfo.js';
import type { TextMeasurer } from './textmeasure.js';
import { makeAnyLabel, DEFAULT_FONTNAME, DEFAULT_COLOR, DEFAULT_FONTSIZE } from './make-label.js';
import { isHtmlValue, htmlValueContent } from './html-string.js';
import { lateDouble } from '../common/nodeinit.js';
import { EDGE_LABEL, EDGE_XLABEL, HEAD_LABEL, TAIL_LABEL } from '../layout/dot/rank.js';

// ---------------------------------------------------------------------------
// Constants — @see lib/common/const.h
// ---------------------------------------------------------------------------

/** Default fontsize for head/tail labels. @see lib/common/const.h:DEFAULT_LABEL_FONTSIZE */
export const DEFAULT_LABEL_FONTSIZE = 11.0;

/** Minimum fontsize (shared across all label types). @see lib/common/const.h:MIN_FONTSIZE */
export const MIN_FONTSIZE = 1.0;

// ---------------------------------------------------------------------------
// FontInfo — mirrors C's struct fontinfo in utils.c
// ---------------------------------------------------------------------------

interface FontInfo {
  fontsize: number;
  fontname: string;
  fontcolor: string;
}

// ---------------------------------------------------------------------------
// mapbool — @see lib/common/utils.c:mapbool
// ---------------------------------------------------------------------------

/**
 * Maps a string attribute value to boolean, mirroring mapbool() in utils.c.
 * "false"/"no"/empty → false; "true"/"yes"/non-zero integer → true.
 *
 * @see lib/common/utils.c:mapbool
 */
function mapbool(s: string | undefined): boolean {
  if (!s || s.toLowerCase() === 'false' || s.toLowerCase() === 'no') return false;
  if (s.toLowerCase() === 'true' || s.toLowerCase() === 'yes') return true;
  const n = parseInt(s, 10);
  return !Number.isNaN(n) && n !== 0;
}

// ---------------------------------------------------------------------------
// initFontEdgeAttr — @see lib/common/utils.c:456-461
// ---------------------------------------------------------------------------

/**
 * Reads the per-edge font attrs (fontname/fontsize/fontcolor) with fallback
 * to the global defaults.  Mirrors initFontEdgeAttr in utils.c.
 *
 * @see lib/common/utils.c:initFontEdgeAttr
 */
export function initFontEdgeAttr(e: Edge): FontInfo {
  return {
    fontsize:  lateDouble(e.attrs.get('fontsize'),  DEFAULT_FONTSIZE,  MIN_FONTSIZE),
    fontname:  e.attrs.get('fontname')  || DEFAULT_FONTNAME,
    fontcolor: e.attrs.get('fontcolor') || DEFAULT_COLOR,
  };
}

// ---------------------------------------------------------------------------
// initFontLabelEdgeAttr — @see lib/common/utils.c:463-471
// ---------------------------------------------------------------------------

/**
 * Reads labelfontname / labelfontsize / labelfontcolor with fallback to fi
 * (the regular edge font attrs).  Mirrors initFontLabelEdgeAttr in utils.c.
 *
 * The fallback chain for each attribute:
 *   labelfontsize  → fi.fontsize  → DEFAULT_FONTSIZE
 *   labelfontname  → fi.fontname  → DEFAULT_FONTNAME
 *   labelfontcolor → fi.fontcolor → DEFAULT_COLOR
 *
 * @see lib/common/utils.c:initFontLabelEdgeAttr
 */
export function initFontLabelEdgeAttr(e: Edge, fi: FontInfo): FontInfo {
  return {
    fontsize:  lateDouble(e.attrs.get('labelfontsize'),  fi.fontsize,  MIN_FONTSIZE),
    fontname:  e.attrs.get('labelfontname')  || fi.fontname,
    fontcolor: e.attrs.get('labelfontcolor') || fi.fontcolor,
  };
}

// ---------------------------------------------------------------------------
// getLabelFontInfo — lazy FontInfo pair computation
// ---------------------------------------------------------------------------

/**
 * Lazily compute (fi, lfi) the first time either is needed, mirroring the
 * C NULL-guard pattern: fi.fontname starts NULL, lfi.fontname starts NULL.
 *
 * @see lib/common/utils.c:common_init_edge (fi/lfi NULL guards at 534, 541)
 */
function getLabelFontInfo(e: Edge): FontInfo {
  const fi = initFontEdgeAttr(e);
  return initFontLabelEdgeAttr(e, fi);
}

// ---------------------------------------------------------------------------
// applyLabel — @see lib/common/utils.c:517-523
// ---------------------------------------------------------------------------

/**
 * Create center edge label and set EDGE_LABEL bit when label attr is non-empty.
 *
 * @see lib/common/utils.c:common_init_edge (lines 517-523)
 * @see lib/common/utils.c:519 — make_label(e, str, aghtmlstr(str), false, ...)
 */
function applyLabel(e: Edge, g: Graph, fi: FontInfo, measurer: TextMeasurer): void {
  const str = e.attrs.get('label');
  if (!str) return;
  const isHtml = isHtmlValue(str);
  const content = isHtml ? htmlValueContent(str) : str;
  e.info.label = makeAnyLabel(content, isHtml, fi, measurer, e);
  g.info.has_labels |= EDGE_LABEL;
  // ED_label_ontop: mapbool(late_string(e, E_label_float, "false"))
  // @see lib/common/utils.c:522
  e.info.label_ontop = mapbool(e.attrs.get('label_float')) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// applyXLabel — @see lib/common/utils.c:525-531
// ---------------------------------------------------------------------------

/**
 * Create external edge label and set EDGE_XLABEL bit when xlabel attr is
 * non-empty. Reuses fi if already initialized by applyLabel (C laziness).
 *
 * @see lib/common/utils.c:common_init_edge (lines 525-531)
 * @see lib/common/utils.c:528 — make_label(e, str, aghtmlstr(str), false, ...)
 */
function applyXLabel(e: Edge, g: Graph, fi: FontInfo, measurer: TextMeasurer): void {
  const str = e.attrs.get('xlabel');
  if (!str) return;
  const isHtml = isHtmlValue(str);
  const content = isHtml ? htmlValueContent(str) : str;
  e.info.xlabel = makeAnyLabel(content, isHtml, fi, measurer, e);
  g.info.has_labels |= EDGE_XLABEL;
}

// ---------------------------------------------------------------------------
// applyHeadLabel — @see lib/common/utils.c:533-538
// ---------------------------------------------------------------------------

/**
 * Create head_label and set HEAD_LABEL bit when headlabel attr is non-empty.
 * @see lib/common/utils.c:533-538
 * @see lib/common/utils.c:535 — make_label(e, str, aghtmlstr(str), false, ...)
 */
function applyHeadLabel(e: Edge, g: Graph, lfi: FontInfo, measurer: TextMeasurer): void {
  const str = e.attrs.get('headlabel');
  if (!str) return;
  const isHtml = isHtmlValue(str);
  const content = isHtml ? htmlValueContent(str) : str;
  e.info.head_label = makeAnyLabel(content, isHtml, lfi, measurer, e);
  g.info.has_labels = (g.info.has_labels ?? 0) | HEAD_LABEL;
}

// ---------------------------------------------------------------------------
// applyTailLabel — @see lib/common/utils.c:539-545
// ---------------------------------------------------------------------------

/**
 * Create tail_label and set TAIL_LABEL bit when taillabel attr is non-empty.
 * @see lib/common/utils.c:539-545
 * @see lib/common/utils.c:542 — make_label(e, str, aghtmlstr(str), false, ...)
 */
function applyTailLabel(e: Edge, g: Graph, lfi: FontInfo, measurer: TextMeasurer): void {
  const str = e.attrs.get('taillabel');
  if (!str) return;
  const isHtml = isHtmlValue(str);
  const content = isHtml ? htmlValueContent(str) : str;
  e.info.tail_label = makeAnyLabel(content, isHtml, lfi, measurer, e);
  g.info.has_labels = (g.info.has_labels ?? 0) | TAIL_LABEL;
}

// ---------------------------------------------------------------------------
// initEdgeLabels — full label block of common_init_edge
// @see lib/common/utils.c:509-545
// ---------------------------------------------------------------------------

/**
 * Apply label and xlabel with lazy fi init mirroring C's NULL-guard pattern.
 * fi is initialized at most once and reused for xlabel.
 * @see lib/common/utils.c:common_init_edge (lines 515-531)
 */
function applyMainLabels(e: Edge, g: Graph, measurer: TextMeasurer): void {
  // C: fi.fontname = NULL; init on first need, reuse for xlabel.
  let fi: FontInfo | null = null;
  const labelStr = e.attrs.get('label');
  if (labelStr) {
    fi = initFontEdgeAttr(e);
    applyLabel(e, g, fi, measurer);
  }
  const xlabelStr = e.attrs.get('xlabel');
  if (xlabelStr) {
    applyXLabel(e, g, fi ?? initFontEdgeAttr(e), measurer);
  }
}

/**
 * Apply headlabel and taillabel using the labelfont* chain.
 * @see lib/common/utils.c:common_init_edge (lines 533-545)
 */
function applyEndLabels(e: Edge, g: Graph, measurer: TextMeasurer): void {
  const lfi = getLabelFontInfo(e);
  applyHeadLabel(e, g, lfi, measurer);
  applyTailLabel(e, g, lfi, measurer);
}

/**
 * Creates label, xlabel, head_label, and tail_label TextlabelT objects on the
 * edge, mirroring common_init_edge in C. C statement order is preserved:
 * label → xlabel → headlabel → taillabel.
 *
 * @see lib/common/utils.c:common_init_edge (lines 509-545)
 */
/** Shape portfn: aiming point + slope for a named/compass port. */
type PortFn = (n: unknown, portname: string, compass: string) => Port;

/**
 * Resolve a "name" or "name:compass" port string. pt.name is the compass
 * suffix (or the whole string when there is no colon). A null portfn (the
 * default for shapes without one) yields a zero-init Center port. C passes
 * the no-colon compass as NULL; the TS portfn type is `string`, so we pass
 * "" — compassPort treats "" and NULL alike.
 * @see lib/common/utils.c:489 chkPort
 */
function chkPort(pf: PortFn | null, n: Node, s: string): Port {
  const cp = s.indexOf(':');
  if (cp >= 0) {
    const compass = s.slice(cp + 1);
    const pt = pf ? pf(n, s.slice(0, cp), compass) : makePort();
    pt.name = compass;
    return pt;
  }
  const pt = pf ? pf(n, s, '') : makePort();
  pt.name = s;
  return pt;
}

/** A clip attr explicitly set false (C noClip / !late_bool(...,true)). */
function isClipDisabled(v: string | undefined): boolean {
  return v !== undefined && /^(false|no|0)$/i.test(v.trim());
}

/** The node shape's portfn, or null. @see lib/common/types.h:shape_functions.portfn */
function portfnOf(n: Node): PortFn | null {
  const shape = n.info.shape as { fns?: { portfn?: PortFn | null } } | undefined;
  return shape?.fns?.portfn ?? null;
}

/**
 * Port block of common_init_edge: populate tail_port/head_port from the
 * tailport/headport attrs (DOT syntax or explicit), honoring tail/headclip.
 * @see lib/common/utils.c:548-566
 */
export function initEdgePorts(e: Edge): void {
  const tailStr = e.attrs.get('tailport') ?? '';
  if (tailStr.length > 0) e.tail.info.has_port = true;
  e.info.tail_port = chkPort(portfnOf(e.tail), e.tail, tailStr);
  if (isClipDisabled(e.attrs.get('tailclip'))) e.info.tail_port.clip = false;
  const headStr = e.attrs.get('headport') ?? '';
  if (headStr.length > 0) e.head.info.has_port = true;
  e.info.head_port = chkPort(portfnOf(e.head), e.head, headStr);
  if (isClipDisabled(e.attrs.get('headclip'))) e.info.head_port.clip = false;
}

export function initEdgeLabels(e: Edge, g: Graph, measurer: TextMeasurer): void {
  initEdgePorts(e); // port block runs for every edge, before the label short-circuit
  const hasMain = e.attrs.has('label') || e.attrs.has('xlabel');
  const hasEnd  = e.attrs.has('headlabel') || e.attrs.has('taillabel');
  if (!hasMain && !hasEnd) return;
  if (hasMain) applyMainLabels(e, g, measurer);
  if (hasEnd)  applyEndLabels(e, g, measurer);
}
