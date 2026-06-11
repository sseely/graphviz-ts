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
import type { TextMeasurer } from './textmeasure.js';
import { makeLabel, DEFAULT_FONTNAME, DEFAULT_COLOR, DEFAULT_FONTSIZE } from './make-label.js';
import { lateDouble } from '../common/nodeinit.js';
import { HEAD_LABEL, TAIL_LABEL } from '../layout/dot/rank.js';

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
// applyHeadLabel — @see lib/common/utils.c:533-538
// ---------------------------------------------------------------------------

/** Create head_label and set HEAD_LABEL bit when headlabel attr is non-empty. */
function applyHeadLabel(e: Edge, g: Graph, lfi: FontInfo, measurer: TextMeasurer): void {
  const str = e.attrs.get('headlabel');
  if (!str) return;
  e.info.head_label = makeLabel(str, lfi.fontname, lfi.fontsize, lfi.fontcolor, measurer);
  g.info.has_labels = (g.info.has_labels ?? 0) | HEAD_LABEL;
}

// ---------------------------------------------------------------------------
// applyTailLabel — @see lib/common/utils.c:539-545
// ---------------------------------------------------------------------------

/** Create tail_label and set TAIL_LABEL bit when taillabel attr is non-empty. */
function applyTailLabel(e: Edge, g: Graph, lfi: FontInfo, measurer: TextMeasurer): void {
  const str = e.attrs.get('taillabel');
  if (!str) return;
  e.info.tail_label = makeLabel(str, lfi.fontname, lfi.fontsize, lfi.fontcolor, measurer);
  g.info.has_labels = (g.info.has_labels ?? 0) | TAIL_LABEL;
}

// ---------------------------------------------------------------------------
// initEdgeLabels — head/tail label block of common_init_edge
// @see lib/common/utils.c:533-545
// ---------------------------------------------------------------------------

/**
 * Creates head_label and tail_label TextlabelT objects on the edge.
 * No-ops quickly when neither headlabel nor taillabel attrs are set.
 *
 * @see lib/common/utils.c:common_init_edge (lines 533-545)
 */
export function initEdgeLabels(e: Edge, g: Graph, measurer: TextMeasurer): void {
  const hasHead = !!e.attrs.get('headlabel');
  const hasTail = !!e.attrs.get('taillabel');
  if (!hasHead && !hasTail) return;

  const lfi = getLabelFontInfo(e);
  if (hasHead) applyHeadLabel(e, g, lfi, measurer);
  if (hasTail) applyTailLabel(e, g, lfi, measurer);
}
