// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/dotinit.c — initialisation helpers for
 * the dot layout pipeline (dot_init_node, dot_init_edge, dot_init_subg,
 * dot_init_node_edge, removeFill, dot_cleanup).
 *
 * @see lib/dotgen/dotinit.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { commonInitNode, lateInt } from '../../common/nodeinit.js';
import { nonconstraintEdge } from './classify.js';
import { NORMAL } from './fastgr.js';
import { mapbool } from './rank.js';
import { initEdgeLabels } from '../../common/edge-label-init.js';
import type { TextMeasurer } from '../../common/textmeasure.js';

// ---------------------------------------------------------------------------
// RANKDIR constants
// @see lib/common/const.h RANKDIR_TB/LR/BT/RL
// ---------------------------------------------------------------------------

/** @see lib/common/const.h:RANKDIR_TB */
export const RANKDIR_TB = 0;
/** @see lib/common/const.h:RANKDIR_LR */
export const RANKDIR_LR = 1;
/** @see lib/common/const.h:RANKDIR_BT */
export const RANKDIR_BT = 2;
/** @see lib/common/const.h:RANKDIR_RL */
export const RANKDIR_RL = 3;

// ---------------------------------------------------------------------------
// dotGraphInit — parse rankdir and propagate to subgraphs (graph_init semantics)
// @see lib/common/input.c:600-663 graph_init
// @see lib/dotgen/dotinit.c:352 initSubg (GD_rankdir2 propagation)
// ---------------------------------------------------------------------------

/**
 * Parse the `rankdir` graph attribute and store the encoded value on g.info.rankdir.
 * Mirrors C's graph_init SET_RANKDIR with use_rankdir=true for the dot engine:
 *   SET_RANKDIR(g, (rankdir << 2) | rankdir)
 * Also sets g.info.flip = (rankdir & 1) == 1 (true for LR and RL).
 *
 * @see lib/common/input.c:600-663 graph_init
 * @see lib/common/types.h:GD_rankdir2
 */
export function dotGraphInit(g: Graph): void {
  let rankdir = RANKDIR_TB;
  const p = g.attrs.get('rankdir');
  if (p === 'LR') rankdir = RANKDIR_LR;
  else if (p === 'BT') rankdir = RANKDIR_BT;
  else if (p === 'RL') rankdir = RANKDIR_RL;
  // SET_RANKDIR: effective rankdir in bits 0-1, real rankdir in bits 2-3
  g.info.rankdir = (rankdir << 2) | rankdir;
  // GD_flip: bit 0 of effective rankdir
  g.info.flip = (rankdir & 1) === 1;
  // Propagate to subgraphs (dotinit.c:352: GD_rankdir2(sg) = GD_rankdir2(g))
  initSubgraphRankdir(g);
}

/**
 * Recursively propagate the root graph's rankdir2 to all subgraphs.
 * @see lib/dotgen/dotinit.c:352
 */
function initSubgraphRankdir(g: Graph): void {
  const nc = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  for (let c = 1; c <= nc; c++) {
    if (clust && clust[c - 1]) {
      const sg = clust[c - 1];
      sg.info.rankdir = g.info.rankdir;
      sg.info.flip = g.info.flip;
      initSubgraphRankdir(sg);
    }
  }
}

// ---------------------------------------------------------------------------
// CL_CROSS — cost of cluster skeleton edge crossing
// @see lib/common/const.h:CL_CROSS
// ---------------------------------------------------------------------------

/**
 * Crossing penalty for edges within the same group on a self-loop.
 * Uses the 16-bit-safe value.
 * @see lib/common/const.h:CL_CROSS
 */
export const CL_CROSS = 100;

// ---------------------------------------------------------------------------
// dotInitNode
// ---------------------------------------------------------------------------

/**
 * Initialises per-node layout data for the dot engine.
 * Mirrors dot_init_node: binds Agnodeinfo_t and allocates edge lists.
 *
 * @see lib/dotgen/dotinit.c:dot_init_node
 */
export function dotInitNode(n: Node): void {
  n.info.UF_size = 1;
  if (!n.info.in)       n.info.in       = { list: [], size: 0 };
  if (!n.info.out)      n.info.out      = { list: [], size: 0 };
  if (!n.info.flat_in)  n.info.flat_in  = { list: [], size: 0 };
  if (!n.info.flat_out) n.info.flat_out = { list: [], size: 0 };
  if (!n.info.other)    n.info.other    = { list: [], size: 0 };
  // Default lw = rw = 0.75in/2 × 72 = 27 pts; ht = 0.5in × 72 = 36 pts
  if (!n.info.lw) n.info.lw = 27;
  if (!n.info.rw) n.info.rw = 27;
  if (!n.info.ht) n.info.ht = 36;
  // Mark as a real (NORMAL) node so firstNormalNode() can find it.
  n.info.node_type = NORMAL;
}

// ---------------------------------------------------------------------------
// dotInitEdge
// ---------------------------------------------------------------------------

/**
 * Detects self-loops for the purpose of group-penalty logic.
 * A self-loop has the same tail and head node.
 * @see lib/dotgen/dotinit.c:dot_init_edge (tailgroup/headgroup check)
 */
export function isSelfLoop(e: Edge): boolean {
  return e.tail === e.head;
}

/**
 * Reads the `constraint` edge attr and stores the parsed boolean on e.info.
 * Absent or empty attr leaves e.info.constraint unchanged (C: constr[0] guard).
 * @see lib/dotgen/rank.c:is_nonconstraint
 * @see lib/common/utils.c:mapbool
 */
function initEdgeConstraint(e: Edge): void {
  const s = e.attrs.get('constraint');
  if (s !== undefined && s !== '') e.info.constraint = mapbool(s);
}

/**
 * Applies the self-loop group-penalty to xpenalty and weight.
 * @see lib/dotgen/dotinit.c:dot_init_edge (tailgroup/headgroup block)
 */
function applyGroupPenalty(e: Edge): void {
  if (!isSelfLoop(e)) return;
  e.info.xpenalty = CL_CROSS;
  e.info.weight = (e.info.weight ?? 1) * 100;
}

/**
 * Zeroes xpenalty and weight when the edge is a non-constraint edge.
 * @see lib/dotgen/dotinit.c:dot_init_edge:73-76
 */
function applyNonconstraintZero(e: Edge): void {
  if (!nonconstraintEdge(e)) return;
  e.info.xpenalty = 0;
  e.info.weight = 0;
}

/**
 * Initialises per-edge layout data for the dot engine.
 * Mirrors dot_init_edge: sets weight, count, xpenalty, minlen.
 *
 * @see lib/dotgen/dotinit.c:dot_init_edge
 */
export function dotInitEdge(e: Edge): void {
  initEdgeConstraint(e);
  e.info.weight = e.info.weight ?? 1;
  e.info.count = 1;
  e.info.xpenalty = 1;
  applyGroupPenalty(e);
  applyNonconstraintZero(e);
  // late_int semantics: default 1, minimum 0.
  // @see lib/dotgen/dotinit.c:85  ED_minlen(e) = late_int(e, E_minlen, 1, 0)
  e.info.minlen = lateInt(e.attrs.get('minlen'), 1, 0);
}

// ---------------------------------------------------------------------------
// dotInitSubg
// ---------------------------------------------------------------------------

/**
 * Recursively initialises subgraph-level attributes with defaults.
 * Mirrors dot_init_subg: binds Agraphinfo_t and propagates params.
 *
 * nodesep defaults: 0.25 in × 72 = 18 pts; ranksep: 0.5 in × 72 = 36 pts.
 *
 * @see lib/dotgen/dotinit.c:dot_init_subg
 */
export function dotInitSubg(g: Graph): void {
  if (g.info.nodesep === undefined) g.info.nodesep = 18;
  if (g.info.ranksep === undefined) g.info.ranksep = 36;
  const nc = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  for (let c = 1; c <= nc; c++) {
    if (clust && clust[c - 1]) dotInitSubg(clust[c - 1]);
  }
}

// ---------------------------------------------------------------------------
// dotInitNodeEdge
// ---------------------------------------------------------------------------

/**
 * Calls commonInitNode (shape-aware, label-driven sizing) then
 * dotInitNode for every node, then dotInitEdge for every edge.
 *
 * @see lib/dotgen/dotinit.c:dot_init_node_edge
 * @see lib/dotgen/dotinit.c:dot_init_node (common_init_node + gv_nodesize)
 */
export function dotInitNodeEdge(g: Graph): void {
  for (const n of g.nodes.values()) {
    commonInitNode(n, g);
    dotInitNode(n);
  }
  const measurer = (g.root.info.gvc as { textMeasurer?: TextMeasurer } | undefined)?.textMeasurer;
  for (const e of g.edges) {
    dotInitEdge(e);
    if (measurer) initEdgeLabels(e, g, measurer);
  }
}

// ---------------------------------------------------------------------------
// removeFill
// ---------------------------------------------------------------------------

/**
 * Removes placeholder fill-nodes added by fillRanks for newrank mode.
 * In this port, newrank mode is not fully implemented — no-op is safe.
 *
 * @see lib/dotgen/dotinit.c:removeFill
 */
export function removeFill(_g: Graph): void {
  // newrank mode not implemented; placeholder fill nodes are not created.
}

// ---------------------------------------------------------------------------
// dotCleanup
// ---------------------------------------------------------------------------

/**
 * Clears all edge lists and linked-list pointers from nodes in the fast-graph,
 * releasing layout state without destroying the underlying graph structure.
 *
 * Mirrors dot_cleanup: frees virtual node list then per-node edge lists.
 *
 * @see lib/dotgen/dotinit.c:dot_cleanup
 */
export function dotCleanup(g: Graph): void {
  let n: Node | undefined = g.info.nlist;
  while (n !== undefined) {
    const next: Node | undefined = n.info.next;
    n.info.in       = undefined;
    n.info.out      = undefined;
    n.info.flat_in  = undefined;
    n.info.flat_out = undefined;
    n.info.other    = undefined;
    n.info.next     = undefined;
    n.info.prev     = undefined;
    n = next;
  }
  g.info.nlist = undefined;
}
