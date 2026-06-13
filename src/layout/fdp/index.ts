// SPDX-License-Identifier: EPL-2.0

/**
 * fdp layout engine entry point — the fdp_layout pipeline:
 * init (clusters, params, nodes/edges) → recursive layout →
 * aspect/coord sync → straight-line splines → label placement.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/layout.c:fdp_layout (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import { setEdgeType } from '../dot/index.js';
import { EDGETYPE_LINE, EDGETYPE_NONE, splineEdges } from '../neato/splines.js';
import { neatoSetAspect } from '../neato/init.js';
import { placeGraphLabel } from '../dot/position-bbox.js';
import { fdpInitParams } from './tlayout-parms.js';
import { fdpInitNodeEdge, fdpCleanup } from './init.js';
import { fdpLayout, mkClusters } from './layout.js';
import { gdata } from './fdp-model.js';

export { fdpLayout, mkClusters, evalPositions, setBB } from './layout.js';
export { fdpTLayout } from './tlayout.js';
export { fdpXLayout } from './xlayout.js';
export { findCComp } from './comp.js';
export { deriveGraph, type LayoutInfo } from './derive.js';
export { fdpInitNodeEdge, fdpCleanup } from './init.js';
export { fdpInitParams, fdpParms } from './tlayout-parms.js';

/**
 * Graph-level initialization: edge type, gdata, clusters, parameters,
 * nodes and edges. GD_ndim is fixed at 2 (the "dim" attribute's 3D+
 * modes are not ported — no supported input sets it).
 * @see lib/fdpgen/layout.c:fdp_init_graph
 */
export function fdpInitGraph(g: Graph): void {
  setEdgeType(g, EDGETYPE_LINE);
  gdata(g); // GD_alg(g) = gv_alloc(sizeof(gdata))
  mkClusters(g, null, g);
  fdpInitParams(g);
  fdpInitNodeEdge(g);
}

/**
 * Route edges by the resolved edge type. Compound (cluster) edges and
 * the HAS_CLUST_EDGE warning path are not ported — no supported input
 * has cluster-endpoint edges.
 * @see lib/fdpgen/layout.c:fdpSplines
 */
function fdpSplines(g: Graph): void {
  splineEdges(g); // spline_edges1(g, et) — straight lines + clipping
}

/**
 * The complete fdp pipeline.
 * @see lib/fdpgen/layout.c:fdp_layout
 */
export function fdpLayoutEngine(g: Graph): void {
  fdpInitGraph(g);
  if (fdpLayout(g) !== 0) {
    return;
  }
  neatoSetAspect(g); // C neato_set_aspect: pos (inches) → coord (points)

  const et = g.info.flags & 0xf;
  if (et !== EDGETYPE_NONE) fdpSplines(g);

  // C gv_postprocess: the drawing is already origin-based (finalCC);
  // place cluster labels for emission.
  placeGraphLabel(g);
}

/**
 * fdp LayoutEngine plugin for registration with GvcContext.
 * @see lib/gvc/gvplugin.h:gvlayout_engine_s
 */
export const fdpEngine: LayoutEngine = {
  type: 'fdp',
  layout(g: Graph): void { fdpLayoutEngine(g); },
  cleanup(g: Graph): void { fdpCleanup(g); },
};
