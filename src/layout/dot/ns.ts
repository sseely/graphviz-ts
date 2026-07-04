// SPDX-License-Identifier: EPL-2.0
/** @see lib/common/ns.c — rank, balance, main simplex loop */
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Graph } from '../../model/graph.js';
import type { NsCtx } from './ns-core.js';
import { SEARCHSIZE, NORMAL, nsSlack, seq, invalidatePath, exchangeTreeEdges } from './ns-core.js';
import { dfsRange } from './ns-range.js';
import { feasibleTree } from './ns-subtree.js';
import { gvQsort } from '../../util/bsd-qsort.js';

// ---------------------------------------------------------------------------
// Node / Edge accessor helpers — eliminate ?? from callers (each ?? is +1 CCN)
// ---------------------------------------------------------------------------

export function nodeRank(n: Node): number { return n.info.rank ?? 0; }
export function nodeLow(n: Node): number { return n.info.low ?? 0; }
export function nodeLim(n: Node): number { return n.info.lim ?? 0; }
export function nodeType(n: Node): number { return n.info.node_type ?? 0; }
export function nodeInSize(n: Node): number { return n.info.in?.size ?? 0; }
export function nodeOutSize(n: Node): number { return n.info.out?.size ?? 0; }
export function nodeTreeSize(n: Node): number {
  return (n.info.tree_in?.size ?? 0) + (n.info.tree_out?.size ?? 0);
}
export function edgeCv(e: Edge): number { return e.info.cutvalue ?? 0; }
export function edgeWeight(e: Edge): number { return e.info.weight ?? 1; }
export function edgeMinlen(e: Edge): number { return e.info.minlen ?? 1; }

// ---------------------------------------------------------------------------
// initRank  (topological BFS)
// ---------------------------------------------------------------------------

export function initRankIn(v: Node): void {
  v.info.rank = 0;
  const inp = v.info.in;
  if (!inp) return;
  for (let i = 0; i < inp.size; i++) {
    const e = inp.list[i];
    const r = nodeRank(e.tail) + edgeMinlen(e);
    if (r > nodeRank(v)) v.info.rank = r;
  }
}

export function initRankOut(v: Node, q: Node[]): void {
  const out = v.info.out;
  if (!out) return;
  for (let i = 0; i < out.size; i++) {
    const e = out.list[i];
    const hp = (e.head.info.priority ?? 0) - 1;
    e.head.info.priority = hp;
    if (hp <= 0) q.push(e.head);
  }
}

/** @see lib/common/ns.c:init_rank */
export function initRank(ctx: NsCtx): void {
  const q: Node[] = [];
  for (let n = ctx.g.info.nlist; n; n = n.info.next) {
    if ((n.info.priority ?? 0) === 0) q.push(n);
  }
  while (q.length > 0) { const v = q.shift()!; initRankIn(v); initRankOut(v, q); }
}

// ---------------------------------------------------------------------------
// leaveEdge
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:leave_edge (wrap-around scan helper) */
export function leaveEdgeScan(
  ctx: NsCtx, to: number, cnt: number, rv: Edge | undefined
): [Edge | undefined, number] {
  // C's leave_edge wrap loop runs `while (S_i < j)` and exits with S_i == j,
  // preserving the rotating search cursor for the next pivot. The previous port
  // reset S_i back to 0 here, which degenerated the round-robin into a repeated
  // full rescan from the front — inflating the pivot count on graphs where the
  // search wraps (e.g. 2475_2: 8748 native pivots vs ~18000+ before this fix).
  while (ctx.sI < to) {
    const f = ctx.treeEdges[ctx.sI];
    if (edgeCv(f) < 0) {
      if (!rv || edgeCv(f) < edgeCv(rv)) rv = f;
      if (++cnt >= ctx.searchSize) return [rv, cnt];
    }
    ctx.sI++;
  }
  return [rv, cnt];
}

/** @see lib/common/ns.c:leave_edge */
export function leaveEdge(ctx: NsCtx): Edge | undefined {
  let rv: Edge | undefined;
  let cnt = 0;
  const j = ctx.sI;
  while (ctx.sI < ctx.treeEdges.length) {
    const f = ctx.treeEdges[ctx.sI];
    if (edgeCv(f) < 0) {
      if (!rv || edgeCv(f) < edgeCv(rv)) rv = f;
      if (++cnt >= ctx.searchSize) return rv;
    }
    ctx.sI++;
  }
  if (j > 0) { ctx.sI = 0; [rv, cnt] = leaveEdgeScan(ctx, j, cnt, rv); }
  return rv;
}

// ---------------------------------------------------------------------------
// enterEdge helpers  (dfs_enter_outedge / dfs_enter_inedge)
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:dfs_enter_outedge (out-edge scan) */
export function dfsEnterOutScan(
  n: Node, low: number, lim: number, todo: Node[], best: EnterBest
): void {
  const out = n.info.out;
  if (!out) return;
  // AD-2: lim is set by dfsRangeInit before enterEdge runs — read it directly.
  const nLim = n.info.lim!;
  const list = out.list;
  const size = out.size;
  // Hot loop (with its in-edge twin, >60% of large-graph render time in the
  // 2371/2646 profiles): e.info / endpoint .info are read ONCE per edge and
  // isTreeEdge/seq/nsSlack are inlined with identical `??` semantics —
  // value-identical to the helper form, minus the repeated property walks.
  for (let i = 0; i < size; i++) {
    const e = list[i];
    const ei = e.info;
    const head = e.head;
    const hInfo = head.info;
    if ((ei.tree_index ?? -1) >= 0) {
      if (hInfo.lim! < nLim) todo.push(head);
    } else {
      const hLim = hInfo.lim!;
      if (hLim < low || hLim > lim) {
        const s = (hInfo.rank ?? 0) - (e.tail.info.rank ?? 0) - (ei.minlen ?? 1);
        if (best.e === undefined || s < best.slack) { best.e = e; best.slack = s; }
      }
    }
  }
}

export function dfsEnterOutTreeIn(n: Node, todo: Node[], bestSlack: number): void {
  const ti = n.info.tree_in;
  if (!ti || bestSlack <= 0) return;
  const nLim = n.info.lim!;
  for (let i = 0; i < ti.size; i++) {
    const e = ti.list[i];
    if (e.tail.info.lim! < nLim) todo.push(e.tail);
  }
}

/** @see lib/common/ns.c:dfs_enter_outedge */
export function dfsEnterOutedge(v: Node, low: number, lim: number): Edge | undefined {
  const todo: Node[] = [v];
  const best: EnterBest = { e: undefined, slack: Number.MAX_SAFE_INTEGER };
  while (todo.length > 0) {
    const cur = todo.pop()!;
    dfsEnterOutScan(cur, low, lim, todo, best);
    dfsEnterOutTreeIn(cur, todo, best.slack);
  }
  return best.e;
}

/**
 * Running best (entering edge + its slack), threaded through the search so
 * slack is computed once per candidate edge (C maintains `Slack` as a local
 * int rather than recomputing SLACK(Enter) on every comparison).
 */
interface EnterBest { e: Edge | undefined; slack: number; }

/** @see lib/common/ns.c:dfs_enter_inedge (in-edge scan) */
export function dfsEnterInScan(
  n: Node, low: number, lim: number, todo: Node[], best: EnterBest
): void {
  const inp = n.info.in;
  if (!inp) return;
  // AD-2: lim is set by dfsRangeInit before enterEdge runs — read it directly.
  const nLim = n.info.lim!;
  const list = inp.list;
  const size = inp.size;
  // Hot loop — see dfsEnterOutScan; same fused, value-identical form.
  for (let i = 0; i < size; i++) {
    const e = list[i];
    const ei = e.info;
    const tail = e.tail;
    const tInfo = tail.info;
    if ((ei.tree_index ?? -1) >= 0) {
      if (tInfo.lim! < nLim) todo.push(tail);
    } else {
      const tLim = tInfo.lim!;
      if (tLim < low || tLim > lim) {
        const s = (e.head.info.rank ?? 0) - (tInfo.rank ?? 0) - (ei.minlen ?? 1);
        if (best.e === undefined || s < best.slack) { best.e = e; best.slack = s; }
      }
    }
  }
}

export function dfsEnterInTreeOut(n: Node, todo: Node[], bestSlack: number): void {
  const to = n.info.tree_out;
  if (!to || bestSlack <= 0) return;
  const nLim = n.info.lim!;
  for (let i = 0; i < to.size; i++) {
    const e = to.list[i];
    if (e.head.info.lim! < nLim) todo.push(e.head);
  }
}

/** @see lib/common/ns.c:dfs_enter_inedge */
export function dfsEnterInedge(v: Node, low: number, lim: number): Edge | undefined {
  const todo: Node[] = [v];
  const best: EnterBest = { e: undefined, slack: Number.MAX_SAFE_INTEGER };
  while (todo.length > 0) {
    const cur = todo.pop()!;
    dfsEnterInScan(cur, low, lim, todo, best);
    dfsEnterInTreeOut(cur, todo, best.slack);
  }
  return best.e;
}

/** @see lib/common/ns.c:enter_edge */
export function enterEdge(e: Edge): Edge | undefined {
  const tl = nodeLim(e.tail);
  const hl = nodeLim(e.head);
  if (tl < hl) return dfsEnterInedge(e.tail, nodeLow(e.tail), tl);
  return dfsEnterOutedge(e.head, nodeLow(e.head), hl);
}

// ---------------------------------------------------------------------------
// treeupdate / rerank / update
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:treeupdate */
export function treeupdate(v: Node, w: Node, cutvalue: number, dir: boolean): Node {
  let n = v;
  while (!seq(nodeLow(n), nodeLim(w), nodeLim(n))) {
    const e = n.info.par!;
    const d = n === e.tail ? dir : !dir;
    if (d) e.info.cutvalue = edgeCv(e) + cutvalue;
    else e.info.cutvalue = edgeCv(e) - cutvalue;
    n = nodeLim(e.tail) > nodeLim(e.head) ? e.tail : e.head;
  }
  return n;
}

/**
 * Iterative rerank (AD-3). C's `rerank` recurses to depth O(V) and overflows
 * V8's ~1MB stack on deep tight trees (tests/2108); a browser stack is small
 * and fixed, so it must be an explicit todo-stack. Each node's rank is
 * decremented exactly once by `delta` and the writes are independent, so the
 * LIFO visit order yields a bit-identical result to the recursive pre-order.
 * @see lib/common/ns.c:rerank
 */
export function rerank(v: Node, delta: number): void {
  const todo: Node[] = [v];
  while (todo.length > 0) {
    const n = todo.pop()!;
    const ni = n.info; // hot loop: read n.info once (same fusion as dfsEnterInScan)
    ni.rank = (ni.rank ?? 0) - delta;
    const par = ni.par;
    const to = ni.tree_out;
    if (to) for (let i = 0; i < to.size; i++) {
      const e = to.list[i];
      if (e !== par) todo.push(e.head);
    }
    const ti = ni.tree_in;
    if (ti) for (let i = 0; i < ti.size; i++) {
      const e = ti.list[i];
      if (e !== par) todo.push(e.tail);
    }
  }
}

export function updateRerank(e: Edge, delta: number): void {
  if (delta <= 0) return;
  if (nodeTreeSize(e.tail) === 1) { rerank(e.tail, delta); return; }
  if (nodeTreeSize(e.head) === 1) { rerank(e.head, -delta); return; }
  if (nodeLim(e.tail) < nodeLim(e.head)) rerank(e.tail, delta);
  else rerank(e.head, -delta);
}

/** @see lib/common/ns.c:update */
export function nsUpdate(ctx: NsCtx, e: Edge, f: Edge): number {
  updateRerank(e, nsSlack(f));
  const cutvalue = edgeCv(e);
  const lca = treeupdate(f.tail, f.head, cutvalue, true);
  if (treeupdate(f.head, f.tail, cutvalue, false) !== lca) return 2;
  const lcaLow = nodeLow(lca);
  invalidatePath(lca, f.head);
  invalidatePath(lca, f.tail);
  f.info.cutvalue = -cutvalue;
  e.info.cutvalue = 0;
  exchangeTreeEdges(ctx, e, f);
  dfsRange(lca, lca.info.par, lcaLow);
  return 0;
}

// ---------------------------------------------------------------------------
// scan/normalize, free, reset
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:scan_and_normalize */
export function scanAndNormalize(ctx: NsCtx): number {
  let min = Number.MAX_SAFE_INTEGER;
  let max = Number.MIN_SAFE_INTEGER;
  for (let n = ctx.g.info.nlist; n; n = n.info.next) {
    if (nodeType(n) === NORMAL) {
      const r = nodeRank(n);
      if (r < min) min = r;
      if (r > max) max = r;
    }
  }
  for (let n = ctx.g.info.nlist; n; n = n.info.next) n.info.rank = nodeRank(n) - min;
  return max - min;
}

export function freeTreeNode(n: Node): void {
  n.info.tree_in = undefined;
  n.info.tree_out = undefined;
  n.info.mark = 0;
}

export function resetLists(ctx: NsCtx): void { ctx.treeEdges.length = 0; ctx.sI = 0; }

/** @see lib/common/ns.c:freeTreeList */
export function freeTreeList(ctx: NsCtx): void {
  for (let n = ctx.g.info.nlist; n; n = n.info.next) freeTreeNode(n);
  resetLists(ctx);
}

// ---------------------------------------------------------------------------
// LR_balance
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:LR_balance */
export function lrBalance(ctx: NsCtx): void {
  for (let i = 0; i < ctx.treeEdges.length; i++) {
    const e = ctx.treeEdges[i];
    if (edgeCv(e) !== 0) continue;
    const f = enterEdge(e);
    if (!f) continue;
    const delta = nsSlack(f);
    if (delta <= 1) continue;
    const half = delta >> 1;
    if (nodeLim(e.tail) < nodeLim(e.head)) rerank(e.tail, half);
    else rerank(e.head, -half);
  }
  freeTreeList(ctx);
}

// ---------------------------------------------------------------------------
// TB_balance helpers
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:TB_balance (adj mode detection) */
export function tbGetAdj(g: Graph): number {
  const s = g.attrs.get('TBbalance') ?? '';
  if (s === 'min') return 1;
  if (s === 'max') return 2;
  return 0;
}

export function tbForceAdj(ctx: NsCtx, adj: number, maxrank: number): void {
  if (adj === 0) return;
  for (let n = ctx.g.info.nlist; n; n = n.info.next) {
    if (nodeType(n) !== NORMAL) continue;
    if (adj === 1 && nodeInSize(n) === 0) n.info.rank = 0;
    if (adj === 2 && nodeOutSize(n) === 0) n.info.rank = maxrank;
  }
}

export function tbSortCompare(a: Node, b: Node, adj: number): number {
  return adj > 1 ? nodeRank(b) - nodeRank(a) : nodeRank(a) - nodeRank(b);
}

export function tbSortNodes(ctx: NsCtx, nrank: number[], adj: number): Node[] {
  const nodes: Node[] = [];
  for (let n = ctx.g.info.nlist; n; n = n.info.next) nodes.push(n);
  // C `LIST_SORT` is libc `qsort` (UNSTABLE). The walk below mutates `nrank` per
  // node, so equal-rank tie order decides which rank a tied node lands on — JS's
  // stable sort diverges from the oracle here (e.g. graphs/mike node L lands one
  // rank too high). Reproduce qsort's permutation. @see bsd-qsort.ts
  gvQsort(nodes, (a, b) => tbSortCompare(a, b, adj));
  for (const n of nodes) {
    if (nodeType(n) === NORMAL) nrank[nodeRank(n)]++;
  }
  return nodes;
}

export function tbComputeBounds(n: Node, maxrank: number): [number, number, number, number] {
  let inw = 0, outw = 0, low = 0, high = maxrank;
  const ni = n.info.in;
  if (ni) for (let i = 0; i < ni.size; i++) {
    const e = ni.list[i];
    inw += edgeWeight(e);
    const r = nodeRank(e.tail) + edgeMinlen(e);
    if (r > low) low = r;
  }
  const no = n.info.out;
  if (no) for (let i = 0; i < no.size; i++) {
    const e = no.list[i];
    outw += edgeWeight(e);
    const r = nodeRank(e.head) - edgeMinlen(e);
    if (r < high) high = r;
  }
  if (low < 0) low = 0;
  return [inw, outw, low, high];
}

export function tbMoveNode(n: Node, low: number, high: number, nrank: number[], adj: number): void {
  if (adj > 0) { n.info.rank = adj === 1 ? low : high; return; }
  let choice = low;
  for (let i = low + 1; i <= high; i++) {
    if (nrank[i] < nrank[choice]) choice = i;
  }
  nrank[nodeRank(n)]--;
  nrank[choice]++;
  n.info.rank = choice;
}

/** @see lib/common/ns.c:TB_balance */
export function tbBalance(ctx: NsCtx): void {
  const maxrank = scanAndNormalize(ctx);
  const nrank = new Array<number>(maxrank + 1).fill(0);
  const adj = tbGetAdj(ctx.g);
  tbForceAdj(ctx, adj, maxrank);
  const nodes = tbSortNodes(ctx, nrank, adj);
  for (const n of nodes) {
    if (nodeType(n) !== NORMAL) { freeTreeNode(n); continue; }
    const [inw, outw, low, high] = tbComputeBounds(n, maxrank);
    if (inw === outw) tbMoveNode(n, low, high, nrank, adj);
    freeTreeNode(n);
  }
  resetLists(ctx);
}

// ---------------------------------------------------------------------------
// initGraph
// ---------------------------------------------------------------------------

export function initGraphEdge(n: Node, e: Edge): boolean {
  n.info.priority = (n.info.priority ?? 0) + 1;
  e.info.cutvalue = 0; e.info.tree_index = -1;
  return nodeRank(e.head) - nodeRank(e.tail) < edgeMinlen(e);
}

/** @see lib/common/ns.c:init_graph */
export function initGraph(ctx: NsCtx, g: Graph): boolean {
  ctx.g = g; ctx.treeEdges = []; ctx.sI = 0; ctx.nEdges = 0; ctx.nNodes = 0;
  ctx.searchSize = SEARCHSIZE;
  let feasible = true;
  for (let n = g.info.nlist; n; n = n.info.next) {
    n.info.mark = 0; ctx.nNodes++; n.info.priority = 0;
    const inp = n.info.in;
    if (inp) for (let i = 0; i < inp.size; i++) {
      if (initGraphEdge(n, inp.list[i])) feasible = false;
    }
    n.info.tree_in = { list: [], size: 0 };
    const outp = n.info.out;
    if (outp) for (let i = 0; i < outp.size; i++) ctx.nEdges++;
    n.info.tree_out = { list: [], size: 0 };
  }
  return feasible;
}

// ---------------------------------------------------------------------------
// rank2 / rank (public entry points)
// ---------------------------------------------------------------------------

export function rank2Loop(ctx: NsCtx, maxiter: number): number {
  let iter = 0;
  let e: Edge | undefined;
  while ((e = leaveEdge(ctx)) !== undefined) {
    const f = enterEdge(e);
    if (!f) break;
    const uerr = nsUpdate(ctx, e, f);
    if (uerr !== 0) { freeTreeList(ctx); return uerr; }
    if (++iter >= maxiter) break;
  }
  return 0;
}

export function rank2Balance(ctx: NsCtx, balance: number): void {
  if (balance === 1) { tbBalance(ctx); resetLists(ctx); }
  else if (balance === 2) lrBalance(ctx);
  else { scanAndNormalize(ctx); freeTreeList(ctx); }
}

/** @see lib/common/ns.c:rank2 */
export function rank2(g: Graph, balance: number, maxiter: number, searchSize: number): number {
  const ctx: NsCtx = { g, treeEdges: [], sI: 0, nEdges: 0, nNodes: 0, searchSize: SEARCHSIZE };
  if (!initGraph(ctx, g)) initRank(ctx);
  if (searchSize >= 0) ctx.searchSize = searchSize;
  const err = feasibleTree(ctx);
  if (err !== 0) { freeTreeList(ctx); return err; }
  if (maxiter <= 0) { freeTreeList(ctx); return 0; }
  const uerr = rank2Loop(ctx, maxiter);
  if (uerr !== 0) { freeTreeList(ctx); return uerr; }
  rank2Balance(ctx, balance);
  return 0;
}

/** @see lib/common/ns.c:rank */
export function rank(g: Graph, balance: number, maxiter: number): number {
  const s = g.attrs.get('searchsize');
  const ss = s !== undefined ? parseInt(s, 10) : SEARCHSIZE;
  return rank2(g, balance, maxiter, ss);
}
