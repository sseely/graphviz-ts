// SPDX-License-Identifier: EPL-2.0

/**
 * sfdp layout engine entry point — the sfdp_layout pipeline:
 * init → prism0 control resolution → per-component multilevel
 * spring-electrical embedding → straight-line splines → component
 * packing → postprocess.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/sfdpgen/sfdpinit.c:sfdp_layout (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import { csrand } from '../../common/crand.js';
import { graphInit } from '../../common/graph-init.js';
import { setEdgeTypeFromAttr } from '../dot/index.js';
import { EDGETYPE_LINE, splineEdgesShifted } from '../neato/splines.js';
import { sepFactor, DFLT_MARGIN } from '../neato/sep-factor.js';
import {
  ccomps,
  computeSubgraphBB,
  getPackInfo,
  packSubgraphs,
  shiftOneGraph,
  PackMode,
  type PackInfo,
} from '../pack/index.js';
import { CL_OFFSET } from '../twopi/pipeline.js';
import { placeGraphLabel } from '../dot/position-bbox.js';
import { gvPostprocess } from '../../common/postproc.js';
import { aggetGraph } from '../fdp/fdp-model.js';
import { overlapPrismTries } from '../neato/fdp-adjust.js';
import { adjustNodesScale } from '../neato/sc-adjust.js';
import { lateDouble } from '../../common/nodeinit.js';
import {
  type SpringElectricalControl,
  springElectricalControlNew,
} from './spring-electrical.js';
import { multilevelSpringElectricalEmbedding } from './spring-driver.js';
import {
  sfdpInitGraph,
  sfdpCleanup,
  tuneControl,
  makeMatrix,
  getSizes,
  getPos,
} from './init.js';

export { sfdpInitGraph, sfdpCleanup, tuneControl, makeMatrix, getSizes, getPos };
export { multilevelSpringElectricalEmbedding };

/** GD_ndim is fixed at 2 — see sfdpInitGraph. */
const DIM = 2;

/**
 * Lay out one connected graph: adjacency matrix, label half-sizes,
 * starting positions, the multilevel embedding, ND_pos write-back.
 * @see lib/sfdpgen/sfdpinit.c:sfdpLayout (the static per-component fn)
 */
export function sfdpLayoutComponent(
  g: Graph, ctrl: SpringElectricalControl, pad: { x: number; y: number },
): void {
  const A = makeMatrix(g);
  // edge_labeling_scheme > 0 (|edgelabel| nodes) is not ported.
  const sizes = ctrl.overlap >= 0 ? getSizes(g, pad) : null;
  const pos = getPos(g, DIM);

  multilevelSpringElectricalEmbedding(DIM, A, ctrl, sizes, pos);

  for (const n of g.nodes.values()) {
    const i = n.info.id!;
    n.info.pos = [pos[i * DIM]!, pos[i * DIM + 1]!];
  }
}

/**
 * Resolve the tuned control, component padding, and whether a post-layout
 * overlap pass is needed. The reference binary is built with GTS, so
 * graphAdjustMode's default is "prism0" → AM_PRISM value 0 scaling −4.
 *
 * When the mode resolves to AM_PRISM (prism*, or the boolean/false fallback),
 * overlap removal runs inside sfdp: ctrl.overlap = value (0 for prism0, 1000
 * for prism/false), ctrl.initialScaling = overlap_scaling (default −4), and
 * doAdjust is false. Otherwise (scale family, AM_NONE, unported modes) sfdp's
 * in-layout removal is off (ctrl.overlap = −1) and doAdjust drives a
 * post-layout removeOverlapWith (adjustNodesScale).
 * @see lib/neatogen/adjust.c:graphAdjustMode / getAdjustMode (15.0.0)
 * @see lib/sfdpgen/sfdpinit.c:sfdp_layout (HAVE_GTS branch)
 */
function resolveControl(g: Graph): {
  ctrl: SpringElectricalControl; pad: { x: number; y: number }; doAdjust: boolean;
} {
  const ctrl = springElectricalControlNew();
  tuneControl(g, ctrl);
  const pad = { x: DFLT_MARGIN / 72, y: DFLT_MARGIN / 72 }; // PS2INCH

  // graphAdjustMode(g, &am, "prism0"): agget NULL (unset) → "prism0" default.
  const overlap = aggetGraph(g, 'overlap');
  const flag = overlap === undefined ? 'prism0' : overlap;
  const ntry = overlapPrismTries(flag);
  if (ntry !== null) {
    // AM_PRISM && doAdjust: overlap removal happens inside sfdp.
    ctrl.overlap = ntry;
    ctrl.initialScaling = lateDouble(
      g.root.attrs.get('overlap_scaling'), -4.0, -1.e10);
    const sep = sepFactor(g);
    if (sep.doAdd) {
      pad.x = sep.x / 72;
      pad.y = sep.y / 72;
    }
    return { ctrl, pad, doAdjust: false };
  }
  // Non-PRISM: turn off in-sfdp removal; run removeOverlapWith after layout.
  ctrl.overlap = -1;
  return { ctrl, pad, doAdjust: true };
}

/**
 * Disconnected graphs: embed and route each component (the rand()
 * stream threads across components — coarsening permutations draw from
 * wherever the previous component's srand(123) embedding left it),
 * then pack in l_node mode with spline-aware shifting.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_layout (ncc > 1 branch)
 */
function layoutComponents(
  g: Graph, comps: Graph[],
  ctrl: SpringElectricalControl, pad: { x: number; y: number },
  doAdjust: boolean,
): void {
  const pinfo: PackInfo = {
    aspect: 1, sz: 0, margin: CL_OFFSET, doSplines: false,
    mode: PackMode.Node, fixed: null, vals: null, flags: 0,
  };
  getPackInfo(g, PackMode.Node, CL_OFFSET, pinfo);
  pinfo.doSplines = true; // C sets it after getPackInfo

  for (const sg of comps) {
    // ccomps already node-induces edges (graphviz_node_induce).
    sfdpLayoutComponent(sg, ctrl, pad);
    if (doAdjust) adjustNodesScale(sg); // removeOverlapWith (non-PRISM modes)
    // @see lib/sfdpgen/sfdpinit.c:284 (setEdgeType FUNCTION, per component)
    setEdgeTypeFromAttr(sg, EDGETYPE_LINE);
    splineEdgesShifted(sg);
  }
  packSubgraphs(comps.length, comps, g, pinfo);
}

/**
 * dotneato_postprocess equivalent: translate the drawing to the
 * origin, set the root bb, place the graph label.
 * @see lib/common/postproc.c:gv_postprocess
 */
function postprocess(g: Graph, singleComponent: boolean): void {
  // Single-component: native never re-runs compute_bb after routing, so the
  // graph bb is the curve-refined box (update_bb_bz). Multi-component: pack
  // re-runs compute_bb post-routing over raw control points (hull). Mirror both.
  const bb = computeSubgraphBB(g, 0, singleComponent);
  if (bb.ll.x !== 0 || bb.ll.y !== 0) shiftOneGraph(g, -bb.ll.x, -bb.ll.y);
  g.info.bb = computeSubgraphBB(g, 0, singleComponent);
  // C sfdp_layout ends with dotneato_postprocess(g) = gv_postprocess(g, 1):
  // place_graph_label, then addXLabels — the pass that positions the *edge*
  // labels (sfdp never sets ED_label(e)->pos during routing).
  // @see lib/sfdpgen/sfdpinit.c:295
  placeGraphLabel(g);
  gvPostprocess(g);
}

/**
 * The complete sfdp pipeline.
 *
 * The C libc rand() stream is process-global and each reference SVG
 * was produced by a fresh process; reset the modeled stream to its
 * process-start state (srand(1)) per layout so repeated renders in one
 * JS process reproduce the C binary.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_layout
 */
export function sfdpLayout(g: Graph): void {
  // C: gvLayoutJobs runs graph_init(g, LAYOUT_USES_RANKDIR) before sfdp_layout.
  // sfdp does not set the flag → useRankdir=false. This is also the ONLY place
  // sfdp gets a rankdir at all: it previously never ran SET_RANKDIR, so
  // GD_realrankdir stayed TB even for rankdir=LR graphs (record shapes read it).
  // @see lib/common/input.c:600, lib/gvc/gvlayout.c:81
  graphInit(g, false);
  sfdpInitGraph(g);
  csrand(1); // process-start rand() state on the reference platform

  // Single-component graphs never reach pack, so their final bb keeps the
  // curve-refined box grown during routing; multi-component graphs are packed,
  // and pack re-runs compute_bb (control-point hull). @see postprocess.
  let singleComponent = true;
  if (g.nodes.size > 0) {
    const { ctrl, pad, doAdjust } = resolveControl(g);
    const comps = ccomps(g, '_sfdp_cc');
    singleComponent = comps.length === 1;
    if (singleComponent) {
      sfdpLayoutComponent(g, ctrl, pad);
      if (doAdjust) adjustNodesScale(g); // removeOverlapWith (non-PRISM modes)
      splineEdgesShifted(g); // C spline_edges: shift + coord sync + route
    } else {
      layoutComponents(g, comps, ctrl, pad, doAdjust);
    }
  }

  postprocess(g, singleComponent);
}

/** @see lib/gvc/gvplugin.h:gvlayout_engine_s */
export const SFDP_LAYOUT_ENGINE: LayoutEngine = {
  type: 'sfdp',
  layout: sfdpLayout,
  cleanup: sfdpCleanup,
};
