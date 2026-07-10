// SPDX-License-Identifier: EPL-2.0
/**
 * Neato layout engine entry point.
 *
 * Wires together neatoInitNode, setSeed, solveModel, removeOverlap,
 * splineEdges, neatoTranslate, and neatoSetAspect into the full neato
 * layout pipeline, and exports NEATO_LAYOUT_ENGINE for registration with
 * GvcContext.
 *
 * @see lib/neatogen/neatoinit.c:neato_layout
 * @see lib/neatogen/neatoprocs.h
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import {
  neatoInitNode,
  setSeed,
  solveModel,
  neatoTranslate,
  neatoSetAspect,
  neatoCleanup,
  MODE_KK,
  MODE_MAJOR,
  MODE_HIER,
  MODE_IPSEP,
  MODE_SGD,
  MODEL_SHORTPATH,
  MODEL_CIRCUIT,
  MODEL_SUBSET,
  MODEL_MDS,
} from './init.js';
import { removeOverlap } from './overlap.js';
import { splineEdgesShifted, EDGETYPE_LINE } from './splines.js';
import { setEdgeType } from '../dot/index.js';
import {
  ccomps,
  computeSubgraphBB,
  getPackInfo,
  packGraphs,
  shiftOneGraph,
  PackMode,
  type PackInfo,
} from '../pack/index.js';
import { CL_OFFSET } from '../twopi/pipeline.js';
import { isACluster } from '../dot/rank.js';
import { doGraphLabel } from '../dot/graph-label.js';
import { neutralGraphRankdir } from '../dot/init.js';
import { placeGraphLabel } from '../dot/position-bbox.js';
import { layoutMeasurer } from '../../common/nodeinit.js';
import { commonInitNodeEdge } from '../../common/nodeinit.js';

// Re-export constants for downstream consumers
export {
  MODE_KK, MODE_MAJOR, MODE_HIER, MODE_IPSEP, MODE_SGD,
  MODEL_SHORTPATH, MODEL_CIRCUIT, MODEL_SUBSET, MODEL_MDS,
  neatoInitNode, setSeed, solveModel,
  neatoTranslate, neatoSetAspect, neatoCleanup,
} from './init.js';

// ---------------------------------------------------------------------------
// Mode parsing
// ---------------------------------------------------------------------------

/** Map from mode string to numeric constant. @see lib/neatogen/neato.h */
const MODE_MAP: Record<string, number> = {
  KK: MODE_KK,
  major: MODE_MAJOR,
  hier: MODE_HIER,
  ipsep: MODE_IPSEP,
  sgd: MODE_SGD,
};

/**
 * Parse `g.info.mode` string into a numeric mode constant.
 * Defaults to MODE_MAJOR when unset or unrecognised.
 *
 * @see lib/neatogen/neato.h:neatoMode
 */
export function parseMode(g: Graph): number {
  const s = g.info.mode;
  if (!s) return MODE_MAJOR;
  return MODE_MAP[s] ?? MODE_MAJOR;
}

// ---------------------------------------------------------------------------
// Model parsing
// ---------------------------------------------------------------------------

/** Map from model string to numeric constant. @see lib/neatogen/defs.h */
const MODEL_MAP: Record<string, number> = {
  shortpath: MODEL_SHORTPATH,
  circuit: MODEL_CIRCUIT,
  subset: MODEL_SUBSET,
  mds: MODEL_MDS,
};

/**
 * Parse `g.info.model` string into a numeric model constant.
 * Defaults to MODEL_SHORTPATH when unset or unrecognised.
 *
 * @see lib/neatogen/neato.h:neatoModel
 */
export function parseModel(g: Graph): number {
  // model is not a GraphInfo field yet; read via attrs map as fallback
  const s = g.attrs.get('model');
  if (!s) return MODEL_SHORTPATH;
  return MODEL_MAP[s] ?? MODEL_SHORTPATH;
}

// ---------------------------------------------------------------------------
// Overlap removal
// ---------------------------------------------------------------------------

/**
 * Apply VPSC overlap removal unless `g.info.overlap === 'false'`.
 *
 * @see lib/neatogen/neatoinit.c:neato_layout (removeOverlapWith call)
 */
export function maybeRemoveOverlap(g: Graph): void {
  // C: graphAdjustMode defaults to AM_NONE — no overlap attr means no
  // overlap removal ("overlap: none"). VPSC runs only on request.
  const overlap = g.attrs.get('overlap');
  if (overlap === undefined || overlap === 'true') return;
  const nodes = Array.from(g.nodes.values());
  const nodesep = (g.info.nodesep ?? 18) / 72; // points → inches
  removeOverlap(nodes, { x: nodesep / 2, y: nodesep / 2 });
}

// ---------------------------------------------------------------------------
// neatoLayout
// ---------------------------------------------------------------------------

/**
 * Full neato layout pipeline for a single graph.
 *
 * Pipeline (matches neato_layout in C):
 * 1. Init common node geometry (lw, rw, ht defaults)
 * 2. Init each node (pos, UF_size, default width/height)
 * 3. Parse mode and seed from graph attributes
 * 4. Solve the layout (SGD, stress majorization, or KK)
 * 5. Optionally remove overlaps via VPSC
 * 6. Route edges as splines
 * 7. Translate so minimum position is (0,0)
 * 8. Convert inches → points into coord
 *
 * @see lib/neatogen/neatoinit.c:neato_layout
 */
export function neatoLayout(g: Graph): void {
  neutralGraphRankdir(g);
  // C: neato_init_graph sets EDGETYPE_LINE before node/edge init.
  setEdgeType(g, EDGETYPE_LINE);
  commonInitNodeEdge(g);
  for (const [, n] of g.nodes) neatoInitNode(n);

  const mode = parseMode(g);
  const model = parseModel(g);

  const comps = ccomps(g, '_neato_cc');
  if (comps.length > 1) {
    layoutComponents(g, comps, mode, model);
  } else {
    solveModel(g, mode, model); // srand48 happens inside (C checkStart)
    maybeRemoveOverlap(g);
    // C: spline_edges shifts pos to the origin, syncs coord, routes.
    splineEdgesShifted(g);
  }
  // C: addCluster registers top-level clusters (label + compute_bb)
  // after layout; gv_postprocess then places the cluster labels.
  addClusters(g);
  g.info.bb = computeSubgraphBB(g, 0);
  placeGraphLabel(g);
}

/**
 * Register direct cluster subgraphs: build their labels and tight
 * member bounding boxes for emission.
 * @see lib/neatogen/neatoinit.c:addCluster
 */
function addClusters(g: Graph): void {
  const clusters: Graph[] = [];
  for (const subg of g.subgraphs.values()) {
    if (!isACluster(subg) || subg === g.root) continue;
    doGraphLabel(subg, layoutMeasurer(g));
    subg.info.bb = computeSubgraphBB(subg, 0);
    clusters.push(subg);
  }
  if (clusters.length === 0) return;
  g.info.clust = clusters;
  g.info.n_cluster = clusters.length;
}

/**
 * Disconnected graphs: stress-solve each component (the RNG is
 * reseeded per component, as C's checkStart runs inside majorization),
 * route its edges, then pack the components in l_node mode with
 * spline-aware translation, and translate the whole drawing to the
 * origin.
 * @see lib/neatogen/neatoinit.c:neato_layout (Pack >= 0 branch)
 */
function layoutComponents(g: Graph, comps: Graph[], mode: number, model: number): void {
  for (const gc of comps) {
    setEdgeType(gc, EDGETYPE_LINE);
    solveModel(gc, mode, model);
    maybeRemoveOverlap(gc);
    splineEdgesShifted(gc);
  }
  const pinfo: PackInfo = {
    aspect: 1, sz: 0, margin: CL_OFFSET, doSplines: true,
    mode: PackMode.Node, fixed: null, vals: null, flags: 0,
  };
  getPackInfo(g, PackMode.Node, CL_OFFSET, pinfo);
  packGraphs(comps.length, comps, g, pinfo);
  // C: compute_bb + gv_postprocess translate the packed drawing.
  const bb = computeSubgraphBB(g, 0);
  if (bb.ll.x !== 0 || bb.ll.y !== 0) shiftOneGraph(g, -bb.ll.x, -bb.ll.y);
}

// ---------------------------------------------------------------------------
// NEATO_LAYOUT_ENGINE
// ---------------------------------------------------------------------------

/**
 * LayoutEngine descriptor for registration with GvcContext.
 *
 * @see lib/gvc/gvplugin.h:gvlayout_engine_s
 * @see lib/neatogen/neatoprocs.h
 */
export const NEATO_LAYOUT_ENGINE: LayoutEngine = {
  type: 'neato',
  layout: neatoLayout,
  cleanup: neatoCleanup,
};
