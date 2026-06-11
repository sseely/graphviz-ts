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
import { setEdgeType } from '../dot/index.js';
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
import { aggetGraph } from '../fdp/fdp-model.js';
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
 * Resolve the overlap mode. The reference binary is built with GTS, so
 * the default is "prism0" → AM_PRISM with value 0 (zero smoother
 * iterations) and scaling −4. An explicit "overlap" attribute selects
 * adjust modes that are not ported — throw rather than approximate.
 * @see lib/neatogen/adjust.c:graphAdjustMode (15.0.0)
 * @see lib/sfdpgen/sfdpinit.c:sfdp_layout (HAVE_GTS branch)
 */
function resolveAdjustPrism0(g: Graph): { value: number; scaling: number } {
  const overlap = aggetGraph(g, 'overlap');
  if (overlap !== undefined && overlap !== 'prism0' && overlap !== 'prism') {
    throw new Error(
      `sfdp overlap="${overlap}": only the default prism0 adjust mode is ` +
      'ported; see mission 8 journal');
  }
  if (overlap === 'prism') {
    throw new Error(
      'sfdp overlap="prism": the prism OverlapSmoother (ntry=1000) is not ' +
      'ported (unreachable at sfdp defaults); see mission 8 journal');
  }
  return { value: 0, scaling: -4 };
}

/**
 * Resolve the tuned control and component padding: prism0 overlap
 * (value 0, scaling −4) plus sepFactor-derived pad in inches.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_layout (control/pad setup)
 */
function resolveControl(g: Graph): {
  ctrl: SpringElectricalControl; pad: { x: number; y: number };
} {
  const ctrl = springElectricalControlNew();
  tuneControl(g, ctrl);
  const am = resolveAdjustPrism0(g);
  // AM_PRISM && doAdjust: overlap removal happens inside sfdp.
  ctrl.overlap = am.value;
  ctrl.initialScaling = am.scaling;
  const pad = { x: DFLT_MARGIN / 72, y: DFLT_MARGIN / 72 }; // PS2INCH
  const sep = sepFactor(g);
  if (sep.doAdd) {
    pad.x = sep.x / 72;
    pad.y = sep.y / 72;
  }
  return { ctrl, pad };
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
    setEdgeType(sg, EDGETYPE_LINE);
    splineEdgesShifted(sg);
  }
  packSubgraphs(comps.length, comps, g, pinfo);
}

/**
 * dotneato_postprocess equivalent: translate the drawing to the
 * origin, set the root bb, place the graph label.
 * @see lib/common/postproc.c:gv_postprocess
 */
function postprocess(g: Graph): void {
  const bb = computeSubgraphBB(g, 0);
  if (bb.ll.x !== 0 || bb.ll.y !== 0) shiftOneGraph(g, -bb.ll.x, -bb.ll.y);
  g.info.bb = computeSubgraphBB(g, 0);
  placeGraphLabel(g);
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
  sfdpInitGraph(g);
  csrand(1); // process-start rand() state on the reference platform

  if (g.nodes.size > 0) {
    const { ctrl, pad } = resolveControl(g);
    const comps = ccomps(g, '_sfdp_cc');
    if (comps.length === 1) {
      sfdpLayoutComponent(g, ctrl, pad);
      splineEdgesShifted(g); // C spline_edges: shift + coord sync + route
    } else {
      layoutComponents(g, comps, ctrl, pad);
    }
  }

  postprocess(g);
}

/** @see lib/gvc/gvplugin.h:gvlayout_engine_s */
export const SFDP_LAYOUT_ENGINE: LayoutEngine = {
  type: 'sfdp',
  layout: sfdpLayout,
  cleanup: sfdpCleanup,
};
