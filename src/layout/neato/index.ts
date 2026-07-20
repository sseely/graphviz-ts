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
  userPos,
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
import { adjustNodesFull } from './fdp-adjust.js';
import { splineEdgesShifted, EDGETYPE_LINE } from './splines.js';
import { setEdgeTypeFromAttr } from '../dot/index.js';
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
import { graphInit, DEFAULT_NODESEP_POINTS } from '../../common/graph-init.js';
import { placeGraphLabel } from '../dot/position-bbox.js';
import { gvPostprocess } from '../../common/postproc.js';
import { layoutMeasurer } from '../../common/nodeinit.js';
import { commonInitNodeEdge } from '../../common/nodeinit.js';
import { initEdgeLabels } from '../../common/edge-label-init.js';

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
  // C removeOverlapWith dispatches by adjust mode. `overlap=false` resolves to
  // AM_PRISM (getAdjustMode's boolean fallback lands on adjustMode[1] on a
  // GTS+SFDP build), `overlap=scale/scalexy/compress` to the scale family, only
  // `overlap=vpsc` to VPSC. Previously neato hardcoded VPSC for ALL of these,
  // under-scaling every overlap=false graph (bb ~0.4-0.8x the oracle) and
  // scaling scale-mode graphs wrong. adjustNodesFull is the ported
  // removeOverlapWith body (PRISM via fdpAdjust + scale via scAdjust); VPSC is
  // the one mode it does not cover. @see lib/neatogen/adjust.c:removeOverlapWith
  if (overlap !== 'vpsc') {
    adjustNodesFull(g);
    return;
  }
  const nodes = Array.from(g.nodes.values());
  // Separation is DELIBERATELY the *default* nodesep, not GD_nodesep(g). C's
  // overlap removal derives its padding from `sep`/DFLT_MARGIN (adjust.c:591-600
  // sepFactor) and never reads GD_nodesep — that field is used only by
  // makeSelfArcs (neatosplines.c:673) and routespl.c:1006. Before graph_init was
  // consolidated, GD_nodesep was unset under neato at this point, so this site
  // always saw the 18pt default; now that graphInit parses `nodesep` for every
  // engine (as C does), reading it here would silently change the VPSC
  // separation on graphs that set both `nodesep` and `overlap` (corpus: 1554,
  // 2242) — a divergence C does not have. Pinned to the default it always used.
  const nodesep = DEFAULT_NODESEP_POINTS / 72; // points → inches
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
  // C runs graph_init(g, LAYOUT_USES_RANKDIR) for EVERY engine from
  // gvLayoutJobs (gvlayout.c:81) before the engine's layout(). neato does not
  // set LAYOUT_USES_RANKDIR, so useRankdir=false: the real rankdir lands in
  // bits 2-3 and the effective rankdir stays TB. graph_init also creates the
  // ROOT graph label (do_graph_label) — without it GD_label(g) is NULL and
  // gv_postprocess's `GD_label(g) && !set` gate skips BOTH the bb expansion and
  // place_root_label. @see lib/common/input.c:600 graph_init
  graphInit(g, false);
  // C: neato_init_graph calls setEdgeType(g, EDGETYPE_LINE) — the FUNCTION
  // (utils.c:1423), which reads the `splines` attr and uses EDGETYPE_LINE only
  // as the DEFAULT. The bare macro would pin LINE and ignore `splines=`.
  // @see lib/neatogen/neatoinit.c:598
  setEdgeTypeFromAttr(g, EDGETYPE_LINE);
  commonInitNodeEdge(g);
  // C neato_init_node_edge: neato_init_node then user_pos, per node. user_pos
  // seeds a `pos=` input into the initial layout (P_SET/hasPos) so majorization
  // starts from it instead of a random init. @see neatoinit.c:139-141
  for (const [, n] of g.nodes) {
    neatoInitNode(n);
    userPos(n);
  }
  // C neato_init_node_edge runs a SECOND loop calling neato_init_edge ->
  // common_init_edge, which creates ED_label(e) and ORs GD_has_labels with
  // EDGE_LABEL. Without it the edge label object never exists and addXLabels'
  // gate (has_labels & EDGE_LABEL) is dead.
  // @see lib/neatogen/neatoinit.c:142 neato_init_node_edge (edge loop)
  // @see lib/neatogen/neatoinit.c:68 neato_init_edge -> common_init_edge
  const measurer = layoutMeasurer(g);
  if (measurer !== undefined) {
    for (const e of g.edges) initEdgeLabels(e, g, measurer);
  }

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
  // C: gv_postprocess(g, !noTranslate) — place_graph_label (cluster labels),
  // then addXLabels, which is what positions the *edge* labels under neato:
  // neato never sets ED_label(e)->pos during routing (unlike dot's
  // dot_position), so the label arrives here unset and is placed by the
  // xlabel map placement pass. @see lib/neatogen/neatoinit.c:1440
  placeGraphLabel(g);
  gvPostprocess(g);
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
    // @see lib/neatogen/neatoinit.c:1398 (setEdgeType FUNCTION, per component)
    setEdgeTypeFromAttr(gc, EDGETYPE_LINE);
    solveModel(gc, mode, model);
    maybeRemoveOverlap(gc);
    splineEdgesShifted(gc);
  }
  const pinfo: PackInfo = {
    aspect: 1, sz: 0, margin: CL_OFFSET, doSplines: false,
    mode: PackMode.Node, fixed: null, vals: null, flags: 0,
  };
  getPackInfo(g, PackMode.Node, CL_OFFSET, pinfo);
  // C sets pinfo.doSplines = true AFTER getPackModeInfo, right before
  // packGraphs — so the packer follows each component's routed splines
  // (self-loops/curves bulge past the chord). getPackInfo resets it to
  // false, so this must come last. @see lib/neatogen/neatoinit.c:1409
  pinfo.doSplines = true;
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
