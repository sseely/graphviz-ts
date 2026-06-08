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
import { commonInitNodeEdge } from '../../common/nodeinit.js';
import { normalizeGraphBB } from '../pack/index.js';

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
  circoInitGraph(g);
  circoLayout(g);
  // ORDERING: alg freed HERE, before spline routing (matches C source).
  freeNData(g);
  // splineEdges and dotneato_postprocess are renderer concerns in this port.
  normalizeGraphBB(g);
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
