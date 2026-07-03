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
import { mapbool } from './rank.js';
import { EDGETYPE_SPLINE, EDGETYPE_NONE, edgeTypeFromString } from './splines.js';
import {
  dotInitSubg,
  dotInitNodeEdge,
  removeFill,
  dotCleanup,
  dotGraphInit,
} from './init.js';
import { gvPostprocess } from '../../common/postproc.js';
import {
  getPack, getPackModeInfo, getPackInfo, PackMode,
} from '../pack/index.js';
import type { PackInfo } from '../pack/index.js';
import { ratioIsNone, layoutAndPack, cccompsWithClusters } from './pack-components.js';

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
 * Phase 4a: post-position passes WITHOUT the final gvPostprocess —
 * removeFill, sameports, splines, compound. This is C's static `dotLayout`
 * tail; the per-component pack branch runs exactly this (gvPostprocess is run
 * once on the root afterwards, not per component).
 * @see lib/dotgen/dotinit.c:dotLayout (static)
 */
export function dotPhasePostNoFinish(g: Graph): void {
  removeFill(g);
  dotSameports(g);
  dotSplines(g);
  // C: if (mapbool(agget(g, "compound"))) dot_compoundEdges(g);
  // @see lib/dotgen/dotinit.c:338
  if (mapbool(g.attrs.get('compound'))) dotCompoundEdges(g);
}

/**
 * Phase 4: post-position passes — the no-finish tail plus gvPostprocess to
 * rotate/translate coordinates per rankdir.
 * @see lib/dotgen/dotinit.c:dotLayout (static)
 * @see lib/common/postproc.c:dotneato_postprocess
 */
export function dotPhasePost(g: Graph): void {
  dotPhasePostNoFinish(g);
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
 * C's `dotLayout` checks `dot_mincross`'s return code and returns immediately
 * on failure, skipping `dot_position` (phase 3) and `dotneato_postprocess`
 * entirely — `dot_position` is never reached with a rank/cluster-window state
 * that `dot_mincross` has already given up on (e.g. a cluster's rank window
 * outliving root's rank-array allocation after malformed-input rankset
 * recovery deletes cluster members but leaves the window unshrunk). The port
 * previously discarded `dotMincross`'s return value and always ran
 * `dotPosition` regardless, so `dotPosition` could observe exactly that
 * unreachable-in-C state and crash (e.g. `position-ycoords.ts:clustHt`
 * indexing the root rank array one past its allocated length).
 * @see lib/dotgen/dotinit.c:dotLayout (static) — `if (rc != 0) return rc;`
 *   after `dot_mincross`, propagated through `doDot`/`dot_layout` to also
 *   skip `dotneato_postprocess`.
 */
export function dotLayoutPipeline(g: Graph): void {
  const maxphase = getAttrInt(g, 'maxphase', -1);
  dotPhaseInit(g);
  dotRank(g);
  if (maxphase === 1) return;
  const rc = dotMincross(g);
  if (rc !== 0) return;
  if (maxphase === 2) return;
  dotPosition(g);
  if (maxphase === 3) return;
  dotPhasePost(g);
}

// ---------------------------------------------------------------------------
// doDot — the pack-aware layout dispatcher
// @see lib/dotgen/dotinit.c:doDot
// ---------------------------------------------------------------------------

/** Offset/margin default for packing, in points. @see lib/pack/pack.h:CL_OFFSET */
const CL_OFFSET = 8;

/** A zeroed PackInfo the getPack* readers fill in. @see lib/pack/pack.h:pack_info */
function newPackInfo(): PackInfo {
  return {
    aspect: 1, sz: 0, margin: CL_OFFSET, doSplines: false,
    mode: PackMode.Node, fixed: null, vals: null, flags: 0,
  };
}

/**
 * Port of C's `doDot`: when `pack`/`packmode` is set, decompose the graph into
 * connected components, lay out each one, and polyomino-pack them; otherwise
 * (and for a single component, or a non-R_NONE ratio) fall back to whole-graph
 * `dotLayoutPipeline`. The thin component loop + cluster carry live in
 * pack-components.ts (ADR-1). `dotLayoutPipeline` already includes the root
 * `gvPostprocess`, so the simple arms map exactly to C's `dotLayout(g)` +
 * `dotneato_postprocess(g)`; the pack arm runs `gvPostprocess` once inside
 * `layoutAndPack`.
 *
 * @see lib/dotgen/dotinit.c:doDot
 */
export function doDot(g: Graph): void {
  const pinfo = newPackInfo();
  const Pack = getPack(g, -1, CL_OFFSET);
  const mode = getPackModeInfo(g, PackMode.Undef, pinfo);
  getPackInfo(g, PackMode.Node, CL_OFFSET, pinfo);
  // No pack information: old dot with components handled during layout.
  if (mode === PackMode.Undef && Pack < 0) {
    dotLayoutPipeline(g);
    return;
  }
  // Fill in default values (C doDot: l_undef → l_graph; Pack<0 → CL_OFFSET).
  let pack = Pack;
  if (mode === PackMode.Undef) pinfo.mode = PackMode.Graph;
  else if (pack < 0) pack = CL_OFFSET;
  pinfo.margin = pack; // pack >= 0 here
  pinfo.fixed = null;
  // Cluster-aware decomposition: cluster members stay in one component, and each
  // component carries a clone of its clusters/same-rank sets (C's cccomps).
  const { comps, origOf } = cccompsWithClusters(g);
  if (comps.length === 1) {
    dotLayoutPipeline(g);
  } else if (ratioIsNone(g)) {
    pinfo.doSplines = true;
    layoutAndPack(g, comps, pinfo, origOf);
  } else {
    // Non-trivial ratio with multiple components: C lays out the whole graph.
    dotLayoutPipeline(g);
  }
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
  doDot(g);
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
