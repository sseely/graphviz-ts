// SPDX-License-Identifier: EPL-2.0

/**
 * Per-node ndata type and graph initialisation for the circo engine.
 *
 * Ports the ndata struct from lib/circogen/circular.h and the
 * circo_init_graph / circular_init_node_edge functions from
 * lib/circogen/circularinit.c.
 *
 * Note: CircoCData (cdata) lives in blocks.ts alongside DerivedNode to
 * avoid a circular import — cdata holds a back-reference to DerivedNode.
 *
 * @see lib/circogen/circular.h:ndata
 * @see lib/circogen/circularinit.c:circo_init_graph
 */

import type { Graph } from '../../model/graph.js';
import { setEdgeTypeFromAttr } from '../dot/index.js';
import { EDGETYPE_LINE } from '../neato/splines.js';
import type { Node } from '../../model/node.js';

// ---------------------------------------------------------------------------
// ndata — lightweight wrapper stored during Pass 0 (original graph nodes)
// @see lib/circogen/circular.h:ndata
// ---------------------------------------------------------------------------

/**
 * Algorithm data stored in ND_alg on original-graph nodes during init.
 * Maps each original node to its counterpart in the derived graph.
 *
 * MEMORY: In C all ndata objects are allocated as one contiguous array;
 * only the first node's alg reference is nulled in cleanup
 * (matches C single-free pattern).
 *
 * @see lib/circogen/circular.h:ndata
 */
export interface CircoNData {
  readonly kind: 'circo-ndata';
  /** Pointer to this node's counterpart in the derived graph. */
  dnode: Node | null;
}

// ---------------------------------------------------------------------------
// Graph init
// @see lib/circogen/circularinit.c:circo_init_graph
// ---------------------------------------------------------------------------

/**
 * Initialise all nodes in g for the circo layout pass.
 *
 * Allocates a CircoNData per node, sets 2-D position arrays, and builds
 * the neato_nlist — matching circular_init_node_edge in the C source.
 *
 * ORDERING: alg must be freed (via freeNData) before spline routing.
 *
 * @see lib/circogen/circularinit.c:circo_init_graph
 * @see lib/circogen/circularinit.c:circular_init_node_edge
 */
export function circoInitGraph(g: Graph): void {
  // C: setEdgeType(g, EDGETYPE_LINE) — the C setEdgeType FUNCTION reads the
  // graph's `splines` attr first; EDGETYPE_LINE is only the fallback default.
  // @see lib/common/utils.c:1423 setEdgeType
  setEdgeTypeFromAttr(g, EDGETYPE_LINE);
  g.info.ndim = 2;
  const nlist: Node[] = [];
  for (const n of g.nodes.values()) {
    const ndata: CircoNData = { kind: 'circo-ndata', dnode: null };
    n.info.alg = ndata;
    n.info.pos = [0, 0];
    nlist.push(n);
  }
  g.info.neato_nlist = nlist;
}

/**
 * Release ndata from the first node (frees the shared contiguous block in C).
 * Must be called before spline routing.
 *
 * @see lib/circogen/circularinit.c:circo_layout (free ND_alg line)
 */
export function freeNData(g: Graph): void {
  const first = g.info.neato_nlist?.[0];
  if (first) first.info.alg = undefined;
}
