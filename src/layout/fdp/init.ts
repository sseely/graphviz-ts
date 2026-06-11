// SPDX-License-Identifier: EPL-2.0

/**
 * fdp node/edge initialization and cleanup.
 *
 * processClusterEdges (cluster-endpoint/compound edges) is not ported:
 * no supported input has edges whose endpoint is a cluster, and
 * setClustNodes guards the gap.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/fdpinit.c (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { commonInitNodeEdge, lateDouble } from '../../common/nodeinit.js';
import { fdpParms } from './tlayout-parms.js';
import { fdpData, P_SET, P_PIN } from './fdp-model.js';

/**
 * Read user-supplied positions from the pos attribute (P_SET; P_PIN
 * with a "!" suffix or pin=true). PSinputscale (inputscale) is not
 * ported — no supported input sets it.
 * @see lib/fdpgen/fdpinit.c:initialPositions
 */
function initialPositions(g: Graph): void {
  for (const np of g.nodes.values()) {
    const p = np.attrs.get('pos');
    if (p === undefined || p === '') continue;
    applyPosAttr(np, p);
  }
}

/** Parse one "x,y[!]" pos value onto np. @see fdpinit.c:47-66 */
function applyPosAttr(np: Node, p: string): void {
  const m = /^(-?[\d.]+),(-?[\d.]+)\s*(!)?/.exec(p);
  if (m === null) return; // C warns "expected two floats"
  np.info.pos![0] = parseFloat(m[1]!);
  np.info.pos![1] = parseFloat(m[2]!);
  const pinAttr = np.attrs.get('pin');
  const pinned = m[3] === '!' ||
    (pinAttr !== undefined && /^(true|yes|1)$/i.test(pinAttr));
  fdpData(np).pinned = pinned ? P_PIN : P_SET;
}

/** Per-edge weight/length resolution. @see lib/fdpgen/fdpinit.c:init_edge */
function initEdge(e: Edge): void {
  e.info.factor = lateDouble(e.attrs.get('weight'), 1.0, 0.0);
  e.info.dist = lateDouble(e.attrs.get('len'), fdpParms.K, 0.0);
}

/** Per-node init: geometry + pos allocation. @see fdpinit.c:init_node */
function initNode(n: Node, id: number): void {
  n.info.pos = [0, 0];
  n.info.id = id;
  fdpData(n); // bind the fdp alg record (agbindrec)
  // C gv_nodesize always sets ND_width/height; the measurer-less
  // commonInitNode fallback only sizes lw/rw/ht (M1 convention, as in
  // neatoInitNode). @see lib/common/utils.c:gv_nodesize
  if (!n.info.width) n.info.width = 0.75;
  if (!n.info.height) n.info.height = 0.5;
}

/**
 * Initialize all nodes and edges of g for fdp layout. Node sizing
 * (common_init_node + gv_nodesize) runs via commonInitNodeEdge.
 * @see lib/fdpgen/fdpinit.c:fdp_init_node_edge
 */
export function fdpInitNodeEdge(g: Graph): void {
  commonInitNodeEdge(g);

  let i = 0;
  for (const n of g.nodes.values()) {
    initNode(n, i++);
  }
  for (const n of g.nodes.values()) {
    for (const e of n.outEdges(g)) {
      initEdge(e);
    }
  }
  initialPositions(g);
}

/**
 * Release fdp layout state (gv_cleanup analogue; the render pipeline
 * runs before cleanup per the M2 ordering fix).
 * @see lib/fdpgen/fdpinit.c:fdp_cleanup
 */
export function fdpCleanup(g: Graph): void {
  for (const n of g.nodes.values()) {
    n.info.alg = undefined;
    n.info.pos = undefined;
    n.info.pinned = undefined;
  }
  for (const e of g.edges) {
    e.info.alg = undefined;
  }
  g.info.alg = undefined;
}
