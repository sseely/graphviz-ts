// SPDX-License-Identifier: EPL-2.0

/**
 * Circo circular layout engine — public entry point.
 *
 * Wires circoInitGraph, circoLayout, and cleanup into the LayoutEngine
 * interface and exports CIRCO_LAYOUT_ENGINE for registration with GvcContext.
 *
 * Ordering (matches C circo_layout):
 *   1. commonInitNodeEdge — set lw/rw/ht defaults for all nodes
 *   2. circoInitGraph  — allocate ndata
 *   3. circoLayout     — biconn + circle layout
 *   4. freeNData       — null alg on first node (shared ndata block GC'd)
 *   5. (spline routing — handled by caller / renderer)
 *   6. dotneato_postprocess — handled by caller / renderer
 *
 * @see lib/circogen/circularinit.c:circo_layout
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import { circoInitGraph, freeNData } from './init.js';
import { circoLayout } from './circular.js';
import { commonInitNodeEdge, layoutMeasurer } from '../../common/nodeinit.js';
import { initEdgeLabels } from '../../common/edge-label-init.js';
import { splineEdgesShifted } from '../neato/splines.js';
import { computeSubgraphBB } from '../pack/index.js';
import { placeGraphLabel } from '../dot/position-bbox.js';
import { gvPostprocess } from '../../common/postproc.js';

// Re-export key functions for consumers that need them individually.
export { circoInitGraph, freeNData } from './init.js';
export { circoLayout } from './circular.js';
export { circPos } from './position.js';
export { createBlocktree, freeBlocktree } from './blocktree.js';
export { layoutBlock } from './blockpath.js';

// ---------------------------------------------------------------------------
// LayoutEngine implementation
// ---------------------------------------------------------------------------

/** @see lib/circogen/circularinit.c:circo_layout */
export function circoLayoutFull(g: Graph): void {
  commonInitNodeEdge(g);
  // C circular_init_edge -> common_init_edge creates the edge label; addXLabels
  // (in gvPostprocess below) places it at the edge midpoint. @see circularinit.c:27
  const measurer = layoutMeasurer(g);
  if (measurer !== undefined) {
    for (const e of g.edges) initEdgeLabels(e, g, measurer);
  }
  circoInitGraph(g);
  circoLayout(g);
  // ORDERING: alg freed HERE, before spline routing (matches C source).
  freeNData(g);
  // C: spline_edges(g) shifts pos to the origin, syncs coord (x72), and routes.
  splineEdgesShifted(g);
  // Refresh the root bb (packing may have left a stale pre-shift box).
  g.info.bb = computeSubgraphBB(g, 0);
  // C: dotneato_postprocess(g) — cluster labels, then addXLabels (edge labels),
  // root graph label space + translate. @see circularinit.c:233 circo_layout
  placeGraphLabel(g);
  gvPostprocess(g);
}

/** @see lib/circogen/circularinit.c:circo_cleanup */
export function circoCleanup(g: Graph): void {
  // Derived graph was stored in g.info.alg during circoLayout; clear it.
  g.info.alg = undefined;
  g.info.neato_nlist = undefined;
}

/**
 * Registered layout engine for the 'circo' algorithm.
 *
 * @see lib/gvc/gvcext.h:gvlayout_engine_s
 * @see lib/circogen/circularinit.c (plugin wiring)
 */
export const CIRCO_LAYOUT_ENGINE: LayoutEngine = {
  type: 'circo',
  layout: circoLayoutFull,
  cleanup: circoCleanup,
};
