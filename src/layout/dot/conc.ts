// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/conc.c — dot_concentrate.
 *
 * Build edge concentrators for parallel edges with a common endpoint.
 *
 * @see lib/dotgen/conc.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Port } from '../../model/geom.js';
import {
  VIRTUAL, NORMAL,
  virtualEdge, mergeOneway, deleteFastEdge, deleteFastNode,
} from './fastgr.js';
import { dotScanRanks } from './rank.js';
import { dotRoot, rankGet } from './mincross-utils.js';
import { nodesInSeq } from './decomp.js';
import { graphMinrank, graphMaxrank } from './position-aux.js';

const UP = 0;
const DOWN = 1;

// ---------------------------------------------------------------------------
// portcmp
// @see lib/dotgen/dotsplines.c:portcmp
// ---------------------------------------------------------------------------

/** @see lib/dotgen/dotsplines.c:portcmp */
export function portcmp(p0: Port, p1: Port): number {
  if (!p1.defined) return p0.defined ? 1 : 0;
  if (!p0.defined) return -1;
  if (p0.p.x < p1.p.x) return -1;
  if (p0.p.x > p1.p.x) return 1;
  if (p0.p.y < p1.p.y) return -1;
  if (p0.p.y > p1.p.y) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// candidate predicates
// @see lib/dotgen/conc.c:downcandidate, upcandidate
// ---------------------------------------------------------------------------

/** @see lib/dotgen/conc.c:downcandidate */
export function downcandidate(v: Node): boolean {
  return (v.info.node_type ?? 0) === VIRTUAL
    && (v.info.in?.size ?? 0) === 1
    && (v.info.out?.size ?? 0) === 1
    && v.info.label === undefined;
}

/** @see lib/dotgen/conc.c:upcandidate */
export function upcandidate(v: Node): boolean {
  return (v.info.node_type ?? 0) === VIRTUAL
    && (v.info.out?.size ?? 0) === 1
    && (v.info.in?.size ?? 0) === 1
    && v.info.label === undefined;
}

// ---------------------------------------------------------------------------
// sameDir helpers
// @see lib/dotgen/conc.c:samedir
// ---------------------------------------------------------------------------

/** Walk to_orig chain to find the underlying NORMAL edge. */
export function findNormalEdge(e: Edge): Edge | undefined {
  let cur: Edge | undefined = e;
  while (cur !== undefined && (cur.info.edge_type ?? NORMAL) !== NORMAL) {
    cur = cur.info.to_orig;
  }
  return cur;
}

/** @see lib/dotgen/conc.c:samedir */
export function sameDir(e: Edge, f: Edge): boolean {
  const e0 = findNormalEdge(e);
  if (e0 === undefined) return false;
  const f0 = findNormalEdge(f);
  if (f0 === undefined) return false;
  if (e0.info.conc_opp_flag || f0.info.conc_opp_flag) return false;
  const fDiff = (f0.tail.info.rank ?? 0) - (f0.head.info.rank ?? 0);
  const eDiff = (e0.tail.info.rank ?? 0) - (e0.head.info.rank ?? 0);
  return fDiff * eDiff > 0;
}

// ---------------------------------------------------------------------------
// candidate pair predicates
// @see lib/dotgen/conc.c:bothdowncandidates, bothupcandidates
// ---------------------------------------------------------------------------

/** @see lib/dotgen/conc.c:bothdowncandidates */
export function bothdowncandidates(u: Node, v: Node): boolean {
  const e = u.info.in?.list[0];
  const f = v.info.in?.list[0];
  if (!e || !f) return false;
  if (!downcandidate(v)) return false;
  if (e.tail !== f.tail) return false;
  return sameDir(e, f) && portcmp(e.info.tail_port, f.info.tail_port) === 0;
}

/** @see lib/dotgen/conc.c:bothupcandidates */
export function bothupcandidates(u: Node, v: Node): boolean {
  const e = u.info.out?.list[0];
  const f = v.info.out?.list[0];
  if (!e || !f) return false;
  if (!upcandidate(v)) return false;
  if (e.head !== f.head) return false;
  return sameDir(e, f) && portcmp(e.info.head_port, f.info.head_port) === 0;
}

// ---------------------------------------------------------------------------
// merge helpers — each handles one edge in the merge loop
// @see lib/dotgen/conc.c:mergevirtual
// ---------------------------------------------------------------------------

/** Find or create the left-side representative edge in the DOWN merge. */
export function resolveDownRep(left: Node, headNode: Node, e: Edge): Edge {
  for (let k = 0; k < (left.info.out?.size ?? 0); k++) {
    if (left.info.out!.list[k].head === headNode) return left.info.out!.list[k];
  }
  return virtualEdge(left, headNode, e);
}

/** Drain all in-edges from right into f, then delete e. */
export function drainIntoDown(right: Node, f: Edge, e: Edge): void {
  while ((right.info.in?.size ?? 0) > 0) {
    const e0 = right.info.in!.list[0];
    mergeOneway(e0, f);
    deleteFastEdge(e0);
  }
  deleteFastEdge(e);
}

/** Merge one out-edge of right into left (DOWN direction). */
export function mergeOneOutEdge(left: Node, right: Node): void {
  const e = right.info.out!.list[0];
  const f = resolveDownRep(left, e.head, e);
  drainIntoDown(right, f, e);
}

/** Find or create the left-side representative edge in the UP merge. */
export function resolveUpRep(left: Node, tailNode: Node, e: Edge): Edge {
  for (let k = 0; k < (left.info.in?.size ?? 0); k++) {
    if (left.info.in!.list[k].tail === tailNode) return left.info.in!.list[k];
  }
  return virtualEdge(tailNode, left, e);
}

/** Drain all out-edges from right into f, then delete e. */
export function drainIntoUp(right: Node, f: Edge, e: Edge): void {
  while ((right.info.out?.size ?? 0) > 0) {
    const e0 = right.info.out!.list[0];
    mergeOneway(e0, f);
    deleteFastEdge(e0);
  }
  deleteFastEdge(e);
}

/** Merge one in-edge of right into left (UP direction). */
export function mergeOneInEdge(left: Node, right: Node): void {
  const e = right.info.in!.list[0];
  const f = resolveUpRep(left, e.tail, e);
  drainIntoUp(right, f, e);
}

/** Compact the rank array after merging positions lpos+1..rpos into lpos. */
export function compactRank(g: Graph, r: number, lpos: number, rpos: number): void {
  const rankArr = g.info.rank!;
  let k = lpos + 1;
  for (let i = rpos + 1; i < rankArr[r].n; i++) {
    const n = rankArr[r].v[k] = rankArr[r].v[i];
    n.info.order = k;
    k++;
  }
  rankArr[r].n = k;
  rankArr[r].v[k] = undefined as unknown as Node;
}

/** Merge right into left using DOWN semantics. */
export function absorbNodeDown(left: Node, right: Node, g: Graph): void {
  while ((right.info.out?.size ?? 0) > 0) mergeOneOutEdge(left, right);
  deleteFastNode(g, right);
}

/** Merge right into left using UP semantics. */
export function absorbNodeUp(left: Node, right: Node, g: Graph): void {
  while ((right.info.in?.size ?? 0) > 0) mergeOneInEdge(left, right);
  deleteFastNode(g, right);
}

/** @see lib/dotgen/conc.c:mergevirtual */
export function mergeVirtual(g: Graph, r: number, lpos: number, rpos: number, dir: number): void {
  const rankArr = g.info.rank!;
  const left = rankArr[r].v[lpos];
  for (let i = lpos + 1; i <= rpos; i++) {
    const right = rankArr[r].v[i];
    if (dir === DOWN) absorbNodeDown(left, right, g);
    else absorbNodeUp(left, right, g);
  }
  compactRank(g, r, lpos, rpos);
}

// ---------------------------------------------------------------------------
// infuse / rebuild_vlists
// @see lib/dotgen/conc.c:infuse, rebuild_vlists
// ---------------------------------------------------------------------------

/** @see lib/dotgen/conc.c:infuse */
export function infuse(g: Graph, n: Node): void {
  const r = n.info.rank ?? 0;
  const rl = g.info.rankleader;
  if (!rl) return;
  const lead = rl[r];
  if (lead === undefined || (lead.info.order ?? 0) > (n.info.order ?? 0)) rl[r] = n;
}

/** Infuse virtual nodes along the to_virt/out chain of edge e. */
export function infuseEdgeChain(g: Graph, e: Edge): void {
  let rep: Edge | undefined = e;
  while (rep?.info.to_virt) rep = rep.info.to_virt;
  const targetRank = e.head.info.rank ?? 0;
  while (rep !== undefined && (rep.head.info.rank ?? 0) < targetRank) {
    infuse(g, rep.head);
    rep = rep.head.info.out?.list[0];
  }
}

/** True if virtual node n's orig edge has both endpoints in g. */
export function virtNodeInGraph(g: Graph, n: Node): boolean {
  let e: Edge | undefined = n.info.in?.list[0];
  while (e?.info.to_orig) e = e.info.to_orig;
  return e !== undefined && g.nodes.has(e.tail.name) && g.nodes.has(e.head.name);
}

/** Compute the highest valid index (maxi) for one rank vlist. */
export function computeMaxi(g: Graph, r: number): number {
  const rankArr = g.info.rank!;
  let maxi = -1;
  for (let i = 0; i < rankArr[r].n; i++) {
    // Read THROUGH the window. C's `GD_rank(g)[r].v[i]` here is the OFFSET
    // pointer set two lines above in rebuild_vlists, so index i is relative to
    // the rank leader; a raw `v[i]` would read the ROOT's leftmost node. This is
    // the sole conc.ts site reached with a CLUSTER (via fillRankVlist) — the
    // rest run on the root under dotConcentrate, where vStart is 0 and C uses
    // raw indexing too.
    const n = rankGet(rankArr[r], i);
    if (n === undefined) break;
    if ((n.info.node_type ?? NORMAL) === NORMAL) {
      if (g.nodes.has(n.name)) { maxi = i; } else break;
    } else {
      if (virtNodeInGraph(g, n)) maxi = i;
    }
  }
  return maxi;
}

/** @see lib/dotgen/conc.c:rebuild_vlists — fill one rank's v pointer. */
export function fillRankVlist(g: Graph, r: number, root: Graph): number {
  const rankArr = g.info.rank!;
  const lead = g.info.rankleader![r];
  if (lead === undefined || lead === null) {
    console.error(`Error: rebuild_vlists: lead is null for rank ${r}`);
    return -1;
  }
  const rootRank = root.info.rank![r];
  if (rootRank.v[lead.info.order ?? 0] !== lead) {
    console.error(
      `Error: rebuild_vlists: rank lead ${lead.name} not in order ` +
      `${lead.info.order ?? 0} of rank ${r}`,
    );
    return -1;
  }
  // C: GD_rank(g)[r].v = GD_rank(dot_root(g))[r].v + ND_order(lead) — a LIVE
  // POINTER into the root's array, so writes through either view stay mutually
  // visible. The port models that pointer-plus-offset as (shared array, vStart),
  // exactly as merge_ranks does (cluster.ts:149-150, whose comment spells out
  // that a `.slice` copy detaches the cluster view).
  //
  // This site used to `.slice()` — a COPY, with vStart reset to 0. It was the
  // only one of the three rank-alias sites modelled as a copy, and it silently
  // broke the invariant C gives for free: cluster window and root array are the
  // same memory. It happened not to misbehave only because the sole root-rank
  // mutation after dot_concentrate (makeVnSlot, inside flatNode) always sets
  // reset=true, and recResetVlists then re-aliases the window and heals the copy.
  // Any future writer through a cluster's rank[r].v would have written into the
  // detached copy and been lost.
  // @see lib/dotgen/conc.c:168 rebuild_vlists
  rankArr[r].v = rootRank.v;
  rankArr[r].vStart = lead.info.order ?? 0;
  const maxi = computeMaxi(g, r);
  if (maxi === -1) console.error(`Warning: degenerate concentrated rank ${g.name},${r}`);
  rankArr[r].n = maxi + 1;
  return 0;
}

/** Infuse every node (and its out-edge chains) in g into rankleader. */
export function infuseAllNodes(g: Graph): void {
  // C walks each node's ORIGINAL out-edges in the cluster subgraph
  // (agfstout(g, n)), then resolves each through ED_to_virt inside the chain
  // walk. The fast list (n.info.out) holds virtual SEGMENTS instead: to_virt
  // is unset on them and their head is the first chain vnode, so the walk's
  // target rank collapses to tail rank+1 and intermediate vnodes are never
  // infused — a cluster rank populated only by chain vnodes then has no
  // rankleader and rebuild_vlists fails (corpus 2183 cluster_A rank 9).
  // @see lib/dotgen/conc.c:146-155
  const outsByTail = new Map<Node, Edge[]>();
  for (const e of g.edges) {
    const arr = outsByTail.get(e.tail);
    if (arr) arr.push(e);
    else outsByTail.set(e.tail, [e]);
  }
  for (const n of nodesInSeq(g)) {
    infuse(g, n);
    const oes = outsByTail.get(n);
    if (oes) for (const e of oes) infuseEdgeChain(g, e);
  }
}

/** Fill all per-rank vlists for g using root as the master rank table. */
export function fillAllRankVlists(g: Graph): number {
  // C uses GD_rank(dot_root(g)) as the master rank table. dotRoot falls back to
  // g.root (the true root), NOT g — `g.info.dotroot ?? g` wrongly used the
  // cluster itself when dotroot was unset. @see lib/dotgen/conc.c:rebuild_vlists
  const root = dotRoot(g);
  const minR = graphMinrank(g);
  const maxR = graphMaxrank(g);
  for (let r = minR; r <= maxR; r++) {
    const rc = fillRankVlist(g, r, root);
    if (rc !== 0) return rc;
  }
  return 0;
}

/** Recursively rebuild vlists for all clusters of g. */
export function rebuildClusterVlists(g: Graph): number {
  const nCluster = g.info.n_cluster ?? 0;
  const clust = g.info.clust ?? [];
  for (let c = 0; c < nCluster; c++) {
    const ret = rebuildVlists(clust[c]);
    if (ret !== 0) return ret;
  }
  return 0;
}

/** @see lib/dotgen/conc.c:rebuild_vlists */
export function rebuildVlists(g: Graph): number {
  const minR = graphMinrank(g);
  const maxR = graphMaxrank(g);
  if (!g.info.rankleader) g.info.rankleader = [];
  for (let r = minR; r <= maxR; r++) g.info.rankleader[r] = undefined as unknown as Node;
  dotScanRanks(g);
  infuseAllNodes(g);
  const rc = fillAllRankVlists(g);
  if (rc !== 0) return rc;
  return rebuildClusterVlists(g);
}

// ---------------------------------------------------------------------------
// dot_concentrate passes
// ---------------------------------------------------------------------------

/** @see lib/dotgen/conc.c:dot_concentrate — one downward rank sweep */
export function concentrateOneRankDown(g: Graph, r: number): void {
  const rankArr = g.info.rank!;
  for (let leftpos = 0; leftpos < rankArr[r].n; leftpos++) {
    const left = rankArr[r].v[leftpos];
    if (!downcandidate(left)) continue;
    let rightpos = leftpos + 1;
    while (rightpos < rankArr[r].n && bothdowncandidates(left, rankArr[r].v[rightpos])) rightpos++;
    if (rightpos - leftpos > 1) mergeVirtual(g, r, leftpos, rightpos - 1, DOWN);
  }
}

/** @see lib/dotgen/conc.c:dot_concentrate — one upward rank sweep */
export function concentrateOneRankUp(g: Graph, r: number): void {
  const rankArr = g.info.rank!;
  for (let leftpos = 0; leftpos < rankArr[r].n; leftpos++) {
    const left = rankArr[r].v[leftpos];
    if (!upcandidate(left)) continue;
    let rightpos = leftpos + 1;
    while (rightpos < rankArr[r].n && bothupcandidates(left, rankArr[r].v[rightpos])) rightpos++;
    if (rightpos - leftpos > 1) mergeVirtual(g, r, leftpos, rightpos - 1, UP);
  }
}

/** Run the downward concentration pass; return the last r examined. */
export function runDownPass(g: Graph): number {
  const rankArr = g.info.rank!;
  const maxR = graphMaxrank(g);
  let r = graphMinrank(g) + 1;
  for (; rankArr[r + 1]?.n && r < maxR; r++) concentrateOneRankDown(g, r);
  return r;
}

/** Run the upward concentration pass from r down to 1. */
export function runUpPass(g: Graph, startR: number): void {
  let r = startR;
  while (r > 0) { concentrateOneRankUp(g, r); r--; }
}

/**
 * Build edge concentrators for parallel edges with a common endpoint.
 *
 * The final cluster loop here is a distinct call site from
 * `rebuildClusterVlists`'s recursive nested-cluster loop inside
 * `rebuildVlists` — C's `dot_concentrate` (conc.c:237-243) calls
 * `rebuild_vlists` directly on each of `g`'s own top-level clusters and, on
 * ANY failure (including one bubbled up from a doubly-nested cluster),
 * reports a single `agerr(AGPREV, ...)` continuation line (no "Error:"/
 * "Warning:" prefix — AGPREV reuses the previous call's level) and
 * normalizes the return to -1. Do not fold this into `rebuildClusterVlists`:
 * that helper is also called recursively from inside `rebuildVlists` itself,
 * where C does NOT emit this message.
 * @see lib/dotgen/conc.c:dot_concentrate
 */
export function dotConcentrate(g: Graph): number {
  if (graphMaxrank(g) - graphMinrank(g) <= 1) return 0;
  const r = runDownPass(g);
  runUpPass(g, r);
  const nCluster = g.info.n_cluster ?? 0;
  const clust = g.info.clust ?? [];
  for (let c = 0; c < nCluster; c++) {
    if (rebuildVlists(clust[c]) !== 0) {
      console.error('concentrate=true may not work correctly.');
      return -1;
    }
  }
  return 0;
}
