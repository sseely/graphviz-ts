// SPDX-License-Identifier: EPL-2.0

/**
 * Dot layout engine entry point.
 *
 * Wires together the full dot layout pipeline:
 *   setAspect → dotInitSubg → dotInitNodeEdge →
 *   dotRank → dotMincross → dotPosition →
 *   removeFill → dotSameports → dotSplines → dotCompoundEdges
 *
 * Also exports DOT_LAYOUT_ENGINE, the LayoutEngine registration object
 * used by GvcContext.
 *
 * @see lib/dotgen/dotinit.c:dot_layout
 * @see lib/dotgen/dotinit.c:dotLayout (static)
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import { setAspect } from './aspect.js';
import { dotRank } from './rank.js';
import { dotMincross } from './mincross.js';
import { dotPosition } from './position.js';
import { dotSameports } from './sameport.js';
import { dotSplines } from './splines.js';
import { dotCompoundEdges } from './compound.js';
import { EDGETYPE_SPLINE, EDGETYPE_NONE, edgeTypeFromString } from './splines.js';
import {
  dotInitSubg,
  dotInitNodeEdge,
  removeFill,
  dotCleanup,
  dotGraphInit,
} from './init.js';
import { gvPostprocess } from '../../common/postproc.js';

// Re-export init helpers for external consumers.
export {
  CL_CROSS,
  dotInitNode,
  dotInitEdge,
  dotInitSubg,
  dotInitNodeEdge,
  removeFill,
  dotCleanup,
  dotGraphInit,
  RANKDIR_TB,
  RANKDIR_LR,
  RANKDIR_BT,
  RANKDIR_RL,
} from './init.js';

// ---------------------------------------------------------------------------
// setEdgeType — writes EDGETYPE into the low nibble of GD_flags
// @see lib/common/const.h:setEdgeType
// ---------------------------------------------------------------------------

/**
 * Stores the edge-type flag in the low 4 bits of g.info.flags.
 * Mirrors the C macro setEdgeType(g, t).
 *
 * @see lib/common/const.h:setEdgeType
 */
export function setEdgeType(g: Graph, t: number): void {
  g.info.flags = (g.info.flags & ~0xf) | (t & 0xf);
}

/**
 * Set the edge type from the graph's `splines` attribute: unset → defaultValue,
 * empty string → NONE, otherwise the parsed value. Mirrors C's setEdgeType
 * (which reads `agget(g, "splines")`). @see lib/common/utils.c:setEdgeType
 */
export function setEdgeTypeFromAttr(g: Graph, defaultValue: number): void {
  const s = g.attrs.get('splines');
  let et: number;
  if (s === undefined) et = defaultValue;
  else if (s === '') et = EDGETYPE_NONE;
  else et = edgeTypeFromString(s, defaultValue);
  setEdgeType(g, et);
}

// ---------------------------------------------------------------------------
// getAttrInt — attribute reading helper
// ---------------------------------------------------------------------------

/**
 * Reads an integer graph attribute, returning defaultVal if not set.
 * Mirrors late_int() from lib/common/utils.c for graph-level reads.
 *
 * @see lib/common/utils.c:late_int
 */
export function getAttrInt(g: Graph, key: string, defaultVal: number): number {
  const v = g.attrs.get(key);
  if (v === undefined || v === '') return defaultVal;
  const n = parseInt(v, 10);
  return isNaN(n) ? defaultVal : n;
}

// ---------------------------------------------------------------------------
// Pipeline phase helpers — each phase is its own function so that
// dotLayoutPipeline stays within the 30-line body limit.
// ---------------------------------------------------------------------------

/**
 * Phase 0: parse rankdir, set edge type, and run aspect + init passes.
 * dotGraphInit must run first so g.info.flip is set before nodeinit uses it.
 * @see lib/common/input.c:600-663 graph_init
 * @see lib/dotgen/dotinit.c:dotLayout (static)
 */
export function dotPhaseInit(g: Graph): void {
  dotGraphInit(g);
  setEdgeTypeFromAttr(g, EDGETYPE_SPLINE);
  setAspect(g);
  dotInitSubg(g);
  dotInitNodeEdge(g);
}

/**
 * Phase 4: post-position passes — removeFill, sameports, splines, compound,
 * then gvPostprocess to rotate/translate coordinates per rankdir.
 * @see lib/dotgen/dotinit.c:dotLayout (static)
 * @see lib/common/postproc.c:dotneato_postprocess
 */
export function dotPhasePost(g: Graph): void {
  removeFill(g);
  dotSameports(g);
  dotSplines(g);
  if (g.info.compound) dotCompoundEdges(g);
  gvPostprocess(g);
}

// ---------------------------------------------------------------------------
// dotLayoutPipeline — the static dotLayout function from dotinit.c
// ---------------------------------------------------------------------------

/**
 * Runs the full dot layout pipeline on graph g.
 *
 * The optional `maxphase` attribute (read from g.attrs) controls how many
 * phases run (1=rank only, 2=+mincross, 3=+position, ≥4 or absent=all).
 *
 * @see lib/dotgen/dotinit.c:dotLayout (static)
 */
export function dotLayoutPipeline(g: Graph): void {
  const maxphase = getAttrInt(g, 'maxphase', -1);
  dotPhaseInit(g);
  dotRank(g);
  if (maxphase === 1) return;
  dotMincross(g);
  if (maxphase === 2) return;
  dotPosition(g);
  if (maxphase === 3) return;
  dotPhasePost(g);
}

// ---------------------------------------------------------------------------
// dotLayoutEntry — the public LayoutEngine.layout function
// ---------------------------------------------------------------------------

/**
 * LayoutEngine.layout implementation for the dot engine.
 * Skips empty graphs (matching C's agnnodes(g) guard).
 *
 * @see lib/dotgen/dotinit.c:dot_layout
 */
export function dotLayoutEntry(g: Graph): void {
  if (g.nodes.size === 0) return;
  dotLayoutPipeline(g);
}

// ---------------------------------------------------------------------------
// DOT_LAYOUT_ENGINE — registration object
// ---------------------------------------------------------------------------

/**
 * The dot layout engine registration object.
 * Register with GvcContext.register(DOT_LAYOUT_ENGINE).
 *
 * @see lib/gvc/gvplugin.h:gvlayout_engine_s
 * @see lib/dotgen/dotinit.c:dot_layout
 */
export const DOT_LAYOUT_ENGINE: LayoutEngine = {
  type: 'dot',
  layout: dotLayoutEntry,
  cleanup: dotCleanup,
};
