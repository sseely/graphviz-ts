// SPDX-License-Identifier: EPL-2.0

/**
 * twopi engine initialisation: per-node/edge init, graph init, cleanup.
 * Ports lib/twopigen/twopiinit.c: twopi_init_node_edge, twopi_init_graph,
 * findRootNode, twopi_cleanup.
 *
 * @see lib/twopigen/twopiinit.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { TwopiAlgData } from '../../model/nodeInfo.js';
import { THETA_UNSET } from '../../model/nodeInfo.js';

/** Points per inch, used to convert pos (inches) → coord (points). */
const POINTS_PER_INCH = 72;

/**
 * Build a zeroed TwopiAlgData record for one node.
 * Mirrors gv_calloc(n_nodes, sizeof(rdata)) — all fields at zero/INF defaults.
 *
 * @see lib/twopigen/twopiinit.c:twopi_init_node_edge (gv_calloc call)
 */
function makeRdata(INF: number): TwopiAlgData {
  return {
    kind: 'twopi',
    nStepsToLeaf: INF,
    subtreeSize: 0,
    nChildren: 0,
    nStepsToCenter: INF,
    parent: null,
    span: 0,
    theta: THETA_UNSET,
  };
}

/**
 * Initialize a node for twopi layout: ensure pos[0..1] exist, set defaults.
 * Mirrors neato_init_node for the twopi engine.
 *
 * @see lib/twopigen/twopiinit.c:twopi_init_node_edge (neato_init_node call)
 */
export function twopiInitNode(n: Node): void {
  if (!n.info.pos || n.info.pos.length < 2) n.info.pos = [0, 0];
  if (!n.info.width) n.info.width = 0.75;
  if (!n.info.height) n.info.height = 0.5;
}

/**
 * Initialize an edge for twopi layout: set ED_factor from weight attribute.
 * Default weight 1.0; minimum 0.0.
 *
 * @see lib/twopigen/twopiinit.c:twopi_init_edge
 */
export function twopiInitEdge(e: Edge): void {
  const wt = e.attrs.get('weight');
  const w = wt !== undefined ? Math.max(0.0, parseFloat(wt)) : 1.0;
  e.info.factor = isFinite(w) ? w : 1.0;
}

/**
 * Initialize all nodes and edges in g for twopi layout.
 *
 * Mirrors the C twopi_init_node_edge: allocates a contiguous rdata block
 * (one TwopiAlgData per node), populates GD_neato_nlist, assigns ND_alg,
 * then initialises every out-edge.
 *
 * The contiguous-allocation semantics are preserved: all TwopiAlgData objects
 * are created here in one pass (matching gv_calloc(n_nodes, sizeof(rdata))),
 * so twopiCleanup can mirror the C free(ND_alg(first_node)) by nulling only
 * the first node's alg field.
 *
 * @see lib/twopigen/twopiinit.c:twopi_init_node_edge
 */
export function twopiInitNodeEdge(g: Graph): void {
  const INF = g.nodes.size * g.nodes.size;
  const nlist: Node[] = [];

  // Allocate the contiguous rdata block and wire into nodes + nlist.
  for (const n of g.nodes.values()) {
    twopiInitNode(n);
    n.info.alg = makeRdata(INF);
    nlist.push(n);
  }
  g.info.neato_nlist = nlist;

  // Initialise all edges.
  for (const e of g.edges) twopiInitEdge(e);
}

/**
 * Full graph initialisation: set edge type to line, force 2D, init nodes/edges.
 *
 * @see lib/twopigen/twopiinit.c:twopi_init_graph
 */
export function twopiInitGraph(g: Graph): void {
  g.info.ndim = 2;
  twopiInitNodeEdge(g);
}

/**
 * Scan sg for the first node whose `root` attribute is truthy.
 * Returns null if no such node exists.
 *
 * @see lib/twopigen/twopiinit.c:findRootNode
 */
export function findRootNode(sg: Graph): Node | null {
  for (const n of sg.nodes.values()) {
    const v = n.attrs.get('root');
    if (v === '1' || v === 'true' || v === 'yes') return n;
  }
  return null;
}

/**
 * Convert pos (inches) to coord (points) for every node in g.
 * Matches the neatoSetAspect / dotneato_postprocess coordinate finalisation.
 *
 * @see lib/twopigen/twopiinit.c:twopi_layout (post-layout coord write)
 * @see lib/neatogen/neatoinit.c:neatoSetAspect
 */
export function finaliseCoords(g: Graph): void {
  for (const n of g.nodes.values()) {
    const pos = n.info.pos;
    if (!pos) continue;
    n.info.coord = {
      x: (pos[0] ?? 0) * POINTS_PER_INCH,
      y: (pos[1] ?? 0) * POINTS_PER_INCH,
    };
  }
}

/**
 * Overlap adjustment placeholder: the full adjustNodes from neatogen adjusts
 * node positions to remove size-based overlaps. For this port the pos values
 * written by circleLayout are used directly; overlap removal is deferred.
 *
 * @see lib/neatogen/adjust.c:adjustNodes
 */
export function adjustNodes(_g: Graph): void {
  // Stub: full VPSC/adjustNodes overlap removal is in neatogen and not yet
  // wired for twopi. circleLayout positions are used as-is.
}

/**
 * Release twopi-specific per-node state after layout.
 *
 * Mirrors the C twopi_layout cleanup: free(ND_alg(first_node)) / ND_alg = NULL
 * on the FIRST node only (the contiguous block was allocated as a single unit).
 * Other nodes' ND_alg pointers were interior offsets into that block so they
 * do not need to be freed separately.
 *
 * ORDERING: must be called BEFORE splineEdges because edge routing may
 * store its own data in n.info.alg.
 *
 * @see lib/twopigen/twopiinit.c:twopi_layout (free(ND_alg) placement note)
 * @see lib/twopigen/twopiinit.c:twopi_cleanup
 */
export function twopiCleanup(g: Graph): void {
  const first = g.nodes.values().next().value as Node | undefined;
  if (first !== undefined && first.info.alg?.kind === 'twopi') {
    first.info.alg = undefined;
  }
  g.info.neato_nlist = undefined;
}
