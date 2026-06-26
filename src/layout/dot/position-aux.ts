// SPDX-License-Identifier: EPL-2.0

/**
 * Auxiliary edge construction and removal for the dot position phase.
 * @see lib/dotgen/position.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { Node as NodeClass } from '../../model/node.js';
import { Edge as EdgeClass } from '../../model/edge.js';
import { fastEdge, findFastEdge } from './fastgr.js';
import { SLACKNODE, EDGE_LABEL } from './rank.js';
import { selfRightSpace } from '../../common/splines-selfedge.js';
import { lateInt } from '../../common/nodeinit.js';

/** @see lib/common/const.h:CL_OFFSET */
export const CL_OFFSET = 8;

/**
 * Cluster margin = `late_int(g, G_margin, CL_OFFSET, 0)`. The `margin` attribute
 * is resolved up the subgraph chain (matching `agxget` inheritance), so a
 * cluster with no own `margin` inherits an ancestor's; absent everywhere it
 * falls back to `CL_OFFSET`, and negatives clamp to 0. Used for both the
 * x-coordinate (`make_lrvn`/`make_lrconstraints`/separate clusters) and the
 * rank/y-coordinate (`set_ycoords`) cluster spacing.
 * @see lib/dotgen/position.c:397,436,460,642
 */
export function clusterMarginOf(g: Graph): number {
  let raw: string | undefined;
  for (let s: Graph | null = g; s !== null; s = s.parent) {
    const v = s.attrs.get('margin');
    if (v !== undefined) { raw = v; break; }
  }
  return lateInt(raw, CL_OFFSET, 0);
}

/** @see lib/common/const.h:BOTTOM_IX */
export const BOTTOM_IX = 0;
/** @see lib/common/const.h:RIGHT_IX */
export const RIGHT_IX = 1;
/** @see lib/common/const.h:TOP_IX */
export const TOP_IX = 2;
/** @see lib/common/const.h:LEFT_IX */
export const LEFT_IX = 3;

// ---------------------------------------------------------------------------
// Accessor helpers — each ?? is its own CCN=2 function so callers stay ≤10
// ---------------------------------------------------------------------------

/** @internal */
export function nodeRw(n: Node): number { return n.info.rw ?? 0; }

/** @internal */
export function nodeLw(n: Node): number { return n.info.lw ?? 0; }

/** @internal */
export function nodeOrder(n: Node): number { return n.info.order ?? 0; }

/** @internal */
export function nodeRank(n: Node): number { return n.info.rank ?? 0; }

/** @internal */
export function nodeUfSize(n: Node): number { return n.info.UF_size ?? 1; }

/** @internal */
export function edgeMinlen(e: Edge): number { return e.info.minlen ?? 1; }

/** @internal */
export function edgeWeight(e: Edge): number { return e.info.weight ?? 0; }

/** @internal */
export function edgeDist(e: Edge): number { return e.info.dist ?? 0; }

/** @internal */
export function graphNodesep(g: Graph): number { return g.info.nodesep ?? 0; }

/** @internal */
export function graphMinrank(g: Graph): number { return g.info.minrank ?? 0; }

/** @internal */
export function graphMaxrank(g: Graph): number { return g.info.maxrank ?? 0; }

/** @internal */
export function graphNclust(g: Graph): number { return g.info.n_cluster ?? 0; }

/** @internal */
export function graphHt1(g: Graph): number { return g.info.ht1 ?? 0; }

/** @internal */
export function graphHt2(g: Graph): number { return g.info.ht2 ?? 0; }

/** @internal */
export function graphRanksep(g: Graph): number { return g.info.ranksep ?? 0; }

// ---------------------------------------------------------------------------
// make_aux_edge — @see lib/dotgen/position.c:make_aux_edge
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:make_aux_edge */
export function makeAuxEdge(u: Node, v: Node, len: number, wt: number): Edge {
  const e = new EdgeClass(u, v, '');
  e.info.minlen = Math.round(Math.min(len, 2147483647));
  e.info.weight = wt;
  fastEdge(e);
  return e;
}

// ---------------------------------------------------------------------------
// allocate_aux_edges — @see lib/dotgen/position.c:allocate_aux_edges
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:allocate_aux_edges */
export function allocateAuxEdges(g: Graph): void {
  for (let n = g.info.nlist; n !== undefined; n = n.info.next) {
    n.info.save_in = n.info.in;
    n.info.save_out = n.info.out;
    const ni = n.info.out?.size ?? 0;
    const nj = n.info.in?.size ?? 0;
    n.info.in = { list: new Array(ni + nj + 3), size: 0 };
    n.info.out = { list: new Array(3), size: 0 };
  }
}

// ---------------------------------------------------------------------------
// make_LR_constraints helpers
// ---------------------------------------------------------------------------

/** LR node separation for a rank (accounts for edge labels). */
export function lrSep(g: Graph, rankIdx: number): number {
  const nodesep = graphNodesep(g);
  if (!((g.info.has_labels ?? 0) & EDGE_LABEL)) return nodesep;
  return rankIdx & 1 ? 5 : nodesep;
}

/** @see lib/dotgen/position.c:make_LR_constraints (single flat-edge constraint) */
export function processFlatEdge(g: Graph, u: Node, e: Edge): void {
  const nodesep = graphNodesep(g);
  const isOrdered = nodeOrder(u) < nodeOrder(e.head);
  const t0 = isOrdered ? e.tail : e.head;
  const h0 = isOrdered ? e.head : e.tail;
  const width = nodeRw(t0) + nodeLw(h0);
  const m0 = edgeMinlen(e) * nodesep + width;
  const ex = findFastEdge(t0, h0);
  if (ex !== undefined) {
    const m1 = Math.max(m0, width + nodesep + Math.round(edgeDist(e)));
    ex.info.minlen = Math.max(ex.info.minlen ?? 1, m1);
    ex.info.weight = Math.max(ex.info.weight ?? 0, edgeWeight(e));
  } else if (!e.info.label) {
    makeAuxEdge(t0, h0, m0, edgeWeight(e));
  }
}

/** @see lib/dotgen/position.c:make_LR_constraints (flat-edge endpoint loop) */
export function makeFlatEdgeConstraints(g: Graph, u: Node): void {
  const flatOut = u.info.flat_out;
  if (!flatOut) return;
  for (let k = 0; k < flatOut.size; k++) {
    processFlatEdge(g, u, flatOut.list[k]);
  }
}

/** @see lib/dotgen/position.c:make_LR_constraints (flat-label constraint body) */
export function applyFlatLabel(
  g: Graph,
  e: Edge,
  e0raw: Edge,
  e1raw: Edge,
): void {
  const nodesep = graphNodesep(g);
  const e0 = nodeOrder(e0raw.head) <= nodeOrder(e1raw.head) ? e0raw : e1raw;
  const e1 = e0 === e0raw ? e1raw : e0raw;
  const m0 = edgeMinlen(e) * nodesep / 2;
  const m1a = m0 + nodeRw(e0.head) + nodeLw(e0.tail);
  if (!canReach(e0.tail, e0.head)) makeAuxEdge(e0.head, e0.tail, m1a, edgeWeight(e));
  const m1b = m0 + nodeRw(e1.tail) + nodeLw(e1.head);
  if (!canReach(e1.head, e1.tail)) makeAuxEdge(e1.tail, e1.head, m1b, edgeWeight(e));
}

/** @see lib/dotgen/position.c:make_LR_constraints (flat-label constraints via ND_alg) */
export function makeFlatLabelConstraints(g: Graph, u: Node): void {
  const e = u.info.posAlg;
  if (!e) return;
  const so = u.info.save_out;
  if (!so || so.size < 2) return;
  applyFlatLabel(g, e, so.list[0], so.list[1]);
}

/** @see lib/dotgen/position.c:go */
export function go(u: Node, v: Node): boolean {
  if (u === v) return true;
  const out = u.info.out;
  if (!out) return false;
  for (let i = 0; i < out.size; i++) {
    if (go(out.list[i].head, v)) return true;
  }
  return false;
}

/** @see lib/dotgen/position.c:canreach */
export function canReach(u: Node, v: Node): boolean {
  return go(u, v);
}

/** @see lib/dotgen/position.c:make_LR_constraints (self-edge width accumulation) */
export function selfWidth(u: Node): number {
  const other = u.info.other;
  if (!other || other.size === 0) return 0;
  let sw = 0;
  for (let k = 0; k < other.size; k++) {
    const e = other.list[k];
    if (e.tail === e.head) sw += selfRightSpace(e);
  }
  return sw;
}

/** @see lib/dotgen/position.c:make_LR_constraints (per-rank inner loop, one node pair) */
export function lrRankPair(g: Graph, r: number, u: Node, v: Node, last: number): number {
  const nodesep = lrSep(g, r);
  const width = nodeRw(u) + nodeLw(v) + nodesep;
  makeAuxEdge(u, v, width, 0);
  /* C: `last = (ND_rank(v) = last + width)`. ND_rank is an int, so the
   * double `last + width` truncates toward zero on assignment, and the
   * truncated *integer* flows back into `last` — positions accumulate as
   * integers. The port's info.rank is a float, so without this truncation the
   * fractional node widths accumulate, perturbing the initial feasible ranks
   * (slack/tight-edge detection) and selecting a different vertex of the
   * x-coord NS optimal face (honda-tokoro weight=0 degeneracy).
   * @see lib/dotgen/position.c:make_LR_constraints */
  const next = Math.trunc(last + width);
  v.info.rank = next;
  return next;
}

/** @see lib/dotgen/position.c:make_LR_constraints (per-rank inner loop) */
export function makeLrRankConstraints(g: Graph, r: number): void {
  const rank = g.info.rank!;
  const rk = rank[r];
  let last = 0;
  for (let j = 0; j < rk.n; j++) {
    const u = rk.v[j];
    u.info.mval = u.info.rw;
    u.info.rw = nodeRw(u) + selfWidth(u);
    if (rk.v[0]) u.info.rank = last;
    const v = rk.v[j + 1];
    if (v) last = lrRankPair(g, r, u, v, last);
    makeFlatLabelConstraints(g, u);
    makeFlatEdgeConstraints(g, u);
  }
  if (rk.n > 0) rk.v[0].info.rank = 0;
}

/** @see lib/dotgen/position.c:make_LR_constraints */
export function makeLrConstraints(g: Graph): void {
  for (let i = (g.info.minrank ?? 0); i <= (g.info.maxrank ?? 0); i++) {
    makeLrRankConstraints(g, i);
  }
}

// ---------------------------------------------------------------------------
// make_edge_pairs — @see lib/dotgen/position.c:make_edge_pairs
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:make_edge_pairs (per-edge) */
export function addEdgePair(g: Graph, e: Edge): void {
  const sn = makeSlackNode(g);
  const hp = e.info.head_port.p;
  const tp = e.info.tail_port.p;
  // C: `int m0 = (ED_head_port(e).p.x - ED_tail_port(e).p.x)` truncates the
  // fractional port offset toward zero BEFORE the +1 and the aux-edge minlen
  // round (position.c:338). Keeping it as a float and letting makeAuxEdge round
  // m0+1 inflates the tail/head separation by 1pt for any fractional port
  // offset (e.g. a record field center), shifting the ported node's x by 1.
  const d = Math.trunc(hp.x - tp.x);
  const m0 = Math.max(0, d);
  const m1 = Math.max(0, -d);
  makeAuxEdge(sn, e.tail, m0 + 1, edgeWeight(e));
  makeAuxEdge(sn, e.head, m1 + 1, edgeWeight(e));
  sn.info.rank = Math.min(nodeRank(e.tail) - m0 - 1, nodeRank(e.head) - m1 - 1);
}

/** @see lib/dotgen/position.c:make_edge_pairs */
export function makeEdgePairs(g: Graph): void {
  for (let n = g.info.nlist; n !== undefined; n = n.info.next) {
    const so = n.info.save_out;
    if (!so) continue;
    for (let i = 0; i < so.size; i++) {
      addEdgePair(g, so.list[i]);
    }
  }
}

/** Create a SLACKNODE virtual node and prepend to nlist. */
export function makeSlackNode(g: Graph): Node {
  const sn = new NodeClass(0, '', g);
  sn.info.node_type = SLACKNODE;
  sn.info.in = { list: [], size: 0 };
  sn.info.out = { list: [], size: 0 };
  sn.info.next = g.info.nlist;
  if (g.info.nlist !== undefined) g.info.nlist.info.prev = sn;
  g.info.nlist = sn;
  return sn;
}

// ---------------------------------------------------------------------------
// create_aux_edges / remove_aux_edges
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:create_aux_edges */
export function createAuxEdges(
  g: Graph,
  posClusters: (g: Graph) => void,
  compressGraph: (g: Graph) => void,
): void {
  allocateAuxEdges(g);
  makeLrConstraints(g);
  makeEdgePairs(g);
  posClusters(g);
  compressGraph(g);
}

/** @see lib/dotgen/position.c:remove_aux_edges (SLACKNODE removal loop) */
export function removeSlackNodes(g: Graph): void {
  let nprev: Node | undefined;
  let n = g.info.nlist;
  while (n !== undefined) {
    const nnext = n.info.next;
    if ((n.info.node_type ?? 0) === SLACKNODE) {
      if (nprev !== undefined) nprev.info.next = nnext;
      else g.info.nlist = nnext;
      if (nnext !== undefined) nnext.info.prev = nprev;
    } else {
      nprev = n;
    }
    n = nnext;
  }
}

/** @see lib/dotgen/position.c:remove_aux_edges (per-node cleanup) */
export function removeAuxEdgesNode(n: Node): void {
  const out = n.info.out;
  if (out) {
    for (let i = 0; i < out.size; i++) {
      out.list[i].info.weight = undefined;
    }
    out.list.length = 0; out.size = 0;
  }
  const inn = n.info.in;
  if (inn) { inn.list.length = 0; inn.size = 0; }
  n.info.out = n.info.save_out;
  n.info.in = n.info.save_in;
}

/** @see lib/dotgen/position.c:remove_aux_edges */
export function removeAuxEdges(g: Graph): void {
  for (let n = g.info.nlist; n !== undefined; n = n.info.next) {
    removeAuxEdgesNode(n);
  }
  removeSlackNodes(g);
}
