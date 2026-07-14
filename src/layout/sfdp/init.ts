// SPDX-License-Identifier: EPL-2.0

/**
 * sfdp graph/node initialization and the adjust.c matrix/size helpers
 * the sfdp pipeline feeds to the embedding.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/sfdpgen/sfdpinit.c (15.0.0)
 * @see lib/neatogen/adjust.c:makeMatrix / getSizes (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import { setEdgeTypeFromAttr } from '../dot/index.js';
import { EDGETYPE_LINE } from '../neato/splines.js';
import { neatoInitNode } from '../neato/init.js';
import {
  commonInitNodeEdge, lateDouble, lateInt, layoutMeasurer,
} from '../../common/nodeinit.js';
import { initEdgeLabels } from '../../common/edge-label-init.js';
import { aggetGraph } from '../fdp/fdp-model.js';
import {
  type SpMatrix,
  smFromCoordinateArrays,
  MATRIX_TYPE_REAL,
} from './sparse-matrix.js';
import {
  type SpringElectricalControl,
  AUTOP,
  QUAD_TREE_NONE,
  QUAD_TREE_NORMAL,
  QUAD_TREE_FAST,
} from './spring-electrical.js';

/** @see lib/sfdpgen/PriorityQueue.h via spring_electrical.h:SMOOTHING_NONE */
export const SMOOTHING_NONE = 0;

const INT_MAX = 2147483647;

/**
 * Graph-level init: line edges, 2-D, per-node neato init.
 * GD_ndim handling is fixed at 2 — the "dim"/"dimen" 3D+ modes are not
 * ported (no supported input sets them).
 * @see lib/sfdpgen/sfdpinit.c:sfdp_init_graph
 * @see lib/sfdpgen/sfdpinit.c:sfdp_init_node_edge
 */
export function sfdpInitGraph(g: Graph): void {
  // The root graph label is created by the shared graphInit (do_graph_label),
  // called once from sfdpLayout — C's graph_init runs before sfdp_layout.
  // setEdgeType FUNCTION (utils.c:1423): reads `splines`, LINE is the default.
  // @see lib/sfdpgen/sfdpinit.c:54
  setEdgeTypeFromAttr(g, EDGETYPE_LINE);
  commonInitNodeEdge(g); // common_init_node inside neato_init_node
  for (const n of g.nodes.values()) neatoInitNode(n);
  // C sfdp_init_node_edge runs a second loop over out-edges calling
  // sfdp_init_edge -> common_init_edge: it creates ED_label(e) and ORs
  // GD_has_labels with EDGE_LABEL, which is what lets addXLabels (in
  // dotneato_postprocess) position the edge label.
  // @see lib/sfdpgen/sfdpinit.c:30 sfdp_init_edge
  // @see lib/sfdpgen/sfdpinit.c:44 sfdp_init_node_edge (edge loop)
  const measurer = layoutMeasurer(g);
  if (measurer !== undefined) {
    for (const n of g.nodes.values()) {
      for (const e of n.outEdges(g)) initEdgeLabels(e, g, measurer);
    }
  }
}

/** @see lib/common/utils.c:mapbool */
function mapBool(s: string | undefined, dflt: boolean): boolean {
  if (s === undefined || s === '') return dflt;
  const l = s.toLowerCase();
  if (l === 'false' || l === 'no') return false;
  if (l === 'true' || l === 'yes') return true;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? dflt : n !== 0;
}

/** Keyword → scheme map. @see lib/sfdpgen/sfdpinit.c:late_quadtree_scheme */
const QT_SCHEME_KEYWORDS: Record<string, number> = {
  none: QUAD_TREE_NONE, false: QUAD_TREE_NONE,
  normal: QUAD_TREE_NORMAL, true: QUAD_TREE_NORMAL, yes: QUAD_TREE_NORMAL,
  fast: QUAD_TREE_FAST,
};

/** @see lib/sfdpgen/sfdpinit.c:late_quadtree_scheme */
function lateQuadtreeScheme(s: string | undefined, dflt: number): number {
  if (s === undefined || s === '') return dflt;
  const c = s.charCodeAt(0);
  if (c >= 48 && c <= 57) {
    const v = parseInt(s, 10);
    return v >= QUAD_TREE_NONE && v <= QUAD_TREE_FAST ? v : dflt;
  }
  return QT_SCHEME_KEYWORDS[s.toLowerCase()] ?? dflt;
}

/**
 * Resolve the seed from the "start" attribute, per the C semantics:
 * the seed is only OVERWRITTEN for a digit string or a "random<N>"
 * keyword — otherwise ctrl.randomSeed keeps its default (123). The
 * non-random init modes draw an sfdp warning in C and change nothing.
 * @see lib/neatogen/neatoinit.c:setSeed
 * @see lib/sfdpgen/sfdpinit.c:tuneControl (seed block)
 */
function resolveSeed(g: Graph, dflt: number): number {
  const p = aggetGraph(g, 'start');
  if (p === undefined || p === '') return dflt;
  const c = p.charCodeAt(0);
  if (c >= 48 && c <= 57) {
    const v = parseInt(p, 10);
    return Number.isNaN(v) ? dflt : v;
  }
  if (p.startsWith('random')) {
    const v = parseInt(p.slice('random'.length), 10);
    return Number.isNaN(v) ? dflt : v;
  }
  return dflt;
}

/**
 * Reset control fields from graph attributes.
 * Unported control surfaces (smoothing != none, beautify) throw when an
 * input selects them rather than silently approximating.
 * @see lib/sfdpgen/sfdpinit.c:tuneControl
 */
export function tuneControl(g: Graph, ctrl: SpringElectricalControl): void {
  ctrl.randomSeed = resolveSeed(g, ctrl.randomSeed);
  ctrl.K = lateDouble(aggetGraph(g, 'K'), -1.0, 0.0);
  ctrl.p = -1.0 * lateDouble(aggetGraph(g, 'repulsiveforce'), -AUTOP, 0.0);
  ctrl.multilevels = lateInt(aggetGraph(g, 'levels'), INT_MAX, 0);
  const smoothing = aggetGraph(g, 'smoothing');
  if (smoothing !== undefined && smoothing.toLowerCase() !== 'none' &&
      smoothing !== String(SMOOTHING_NONE)) {
    throw new Error(
      `sfdp smoothing="${smoothing}": post_process_smoothing is not ` +
      'ported (unreachable at sfdp defaults); see mission 8 journal');
  }
  ctrl.smoothing = SMOOTHING_NONE;
  ctrl.tscheme = lateQuadtreeScheme(aggetGraph(g, 'quadtree'), QUAD_TREE_NORMAL);
  ctrl.beautifyLeaves = mapBool(aggetGraph(g, 'beautify'), false);
  ctrl.doShrinking = mapBool(aggetGraph(g, 'overlap_shrink'), true);
  ctrl.rotation = lateDouble(aggetGraph(g, 'rotation'), 0.0, -Number.MAX_VALUE);
  ctrl.edgeLabelingScheme = lateInt(aggetGraph(g, 'label_scheme'), 0, 0);
  if (ctrl.edgeLabelingScheme > 4) ctrl.edgeLabelingScheme = 0;
}

/**
 * Build the weighted adjacency matrix from per-node out-edges,
 * assigning sequential ND_id (n.info.id) in node order first.
 * Out-edge iteration is head-seq ordered (cgraph agfstout semantics —
 * see Node.outEdges).
 * @see lib/neatogen/adjust.c:makeMatrix (15.0.0)
 */
export function makeMatrix(g: Graph): SpMatrix {
  const nodes = [...g.nodes.values()];
  let i = 0;
  for (const n of nodes) n.info.id = i++;

  const irn: number[] = [];
  const jcn: number[] = [];
  const val: number[] = [];
  for (const n of nodes) {
    const row = n.info.id!;
    for (const e of n.outEdges(g)) {
      irn.push(row);
      jcn.push(e.head.info.id!);
      const w = parseFloat(e.attrs.get('weight') ?? '');
      val.push(Number.isNaN(w) ? 1 : w);
    }
  }
  return smFromCoordinateArrays(
    irn.length, nodes.length, nodes.length, { irn, jcn, val }, MATRIX_TYPE_REAL);
}

/**
 * Half node sizes plus padding, in inches, indexed by ND_id.
 * The |edgelabel| branch (edge_labeling_scheme > 0) is not ported —
 * no supported input sets label_scheme.
 * @see lib/neatogen/adjust.c:getSizes (15.0.0)
 */
export function getSizes(g: Graph, pad: { x: number; y: number }): number[] {
  const sizes = new Array<number>(2 * g.nodes.size).fill(0);
  for (const n of g.nodes.values()) {
    const i = n.info.id!;
    sizes[i * 2] = (n.info.width ?? 0) * 0.5 + pad.x;
    sizes[i * 2 + 1] = (n.info.height ?? 0) * 0.5 + pad.y;
  }
  return sizes;
}

/**
 * Starting coordinates by ND_id: all zeros unless some node carries a
 * "pos" attribute (C checks the attr DECLARATION via agfindnodeattr;
 * we scan per node — equivalent for parser-built graphs, where an attr
 * exists only where set).
 * @see lib/sfdpgen/sfdpinit.c:getPos
 */
export function getPos(g: Graph, dim: number): number[] {
  const pos = new Array<number>(dim * g.nodes.size).fill(0);
  let hasPosAttr = false;
  for (const n of g.nodes.values()) {
    if (n.attrs.get('pos') !== undefined) { hasPosAttr = true; break; }
  }
  if (!hasPosAttr) return pos;
  for (const n of g.nodes.values()) {
    const i = n.info.id!;
    const np = n.info.pos;
    if (np !== undefined) {
      for (let k = 0; k < dim; k++) pos[i * dim + k] = np[k] ?? 0;
    }
  }
  return pos;
}

/**
 * Release per-node layout state.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_cleanup
 */
export function sfdpCleanup(g: Graph): void {
  for (const n of g.nodes.values()) {
    n.info.pos = undefined;
    n.info.id = undefined;
  }
}
