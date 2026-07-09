// SPDX-License-Identifier: EPL-2.0

/**
 * twopi radial layout engine — public entry point.
 *
 * @see lib/twopigen/twopiinit.c:twopi_layout
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import { twopiInitGraph, twopiCleanup } from './init.js';
import { ccomps, normalizeGraphBB } from '../pack/index.js';
import { layoutSingle, layoutMulti, buildPackInfo } from './pipeline.js';
import { commonInitNodeEdge, layoutMeasurer } from '../../common/nodeinit.js';
import { initEdgeLabels } from '../../common/edge-label-init.js';
import { placeGraphLabel } from '../dot/position-bbox.js';
import { gvPostprocess } from '../../common/postproc.js';

export {
  twopiInitGraph,
  twopiCleanup,
  findRootNode,
  adjustNodes,
  finaliseCoords,
} from './init.js';
export { circleLayout, isLeaf, initLayout } from './circle.js';
export { THETA_UNSET } from '../../model/nodeInfo.js';

/**
 * Full twopi layout pipeline for a graph.
 *
 * @see lib/twopigen/twopiinit.c:twopi_layout
 */
export function twopiLayout(g: Graph): void {
  if (g.nodes.size === 0) return;
  commonInitNodeEdge(g);
  // C twopi_init_edge -> common_init_edge creates the edge label; addXLabels
  // (in gvPostprocess below) places it at the edge midpoint. @see twopiinit.c:28
  const measurer = layoutMeasurer(g);
  if (measurer !== undefined) {
    for (const e of g.edges) initEdgeLabels(e, g, measurer);
  }
  twopiInitGraph(g);
  const rootAttr = g.attrs.get('root');
  const setRoot = rootAttr !== undefined;
  const globalRoot = setRoot && rootAttr !== ''
    ? (g.nodes.get(rootAttr!) ?? null)
    : null;
  const comps = ccomps(g, '_twopi');
  if (comps.length === 1) {
    layoutSingle(g, comps, globalRoot, setRoot);
  } else {
    layoutMulti(g, comps, globalRoot, buildPackInfo(g));
  }
  normalizeGraphBB(g);
  // C: dotneato_postprocess(g) — cluster labels, edge labels (addXLabels), root
  // graph label space + translate. @see lib/twopigen/twopiinit.c:152
  placeGraphLabel(g);
  gvPostprocess(g);
}

/**
 * LayoutEngine descriptor for registration with GvcContext.
 *
 * @see lib/gvc/gvcext.h:gvlayout_engine_s
 * @see lib/twopigen/twopiinit.c (plugin wiring)
 */
export const TWOPI_LAYOUT_ENGINE: LayoutEngine = {
  type: 'twopi',
  layout: twopiLayout,
  cleanup: twopiCleanup,
};
