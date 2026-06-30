// SPDX-License-Identifier: EPL-2.0
/** @see lib/common/ns.c — subtree union-find, feasible tree construction */
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { addTreeEdge, isTreeEdge, nsSlack } from './ns-core.js';
import type { NsCtx } from './ns-core.js';
import { initCutvalues } from './ns-range.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:subtree_t */
export interface Subtree {
  rep: Node;
  size: number;
  heapIndex: number; // -1 = not in heap
  par?: Subtree;
}

export interface STheap { elt: Subtree[]; size: number; }

interface TstState { v: Node; inI: number; outI: number; rv: number; }

interface IteState { v: Node; ts: Subtree; from?: Node; outI: number; inI: number; }

interface TstCtx {
  ctx: NsCtx; st: Subtree; nodeMap: Map<Node, Subtree>; todo: TstState[];
}

// ---------------------------------------------------------------------------
// STset union-find
// ---------------------------------------------------------------------------

export function onHeap(st: Subtree): boolean { return st.heapIndex >= 0; }

/** @see lib/common/ns.c:STsetFind */
export function stSetFind(n: Node, nodeMap: Map<Node, Subtree>): Subtree {
  let s = nodeMap.get(n)!;
  while (s.par && s.par !== s) {
    if (s.par.par) s.par = s.par.par;
    s = s.par;
  }
  return s;
}

function stPickRoot(r0: Subtree, r1: Subtree): Subtree {
  if (!onHeap(r1)) return r0;
  if (!onHeap(r0)) return r1;
  return r1.size < r0.size ? r0 : r1;
}

/** @see lib/common/ns.c:STsetUnion */
export function stSetUnion(s0: Subtree, s1: Subtree): Subtree {
  let r0 = s0;
  while (r0.par && r0.par !== r0) r0 = r0.par;
  let r1 = s1;
  while (r1.par && r1.par !== r1) r1 = r1.par;
  if (r0 === r1) return r0;
  const r = stPickRoot(r0, r1);
  r0.par = r;
  r1.par = r;
  r.size = r0.size + r1.size;
  return r;
}

// ---------------------------------------------------------------------------
// tight_subtree_search helpers
// ---------------------------------------------------------------------------

export function tstTryNode(tc: TstCtx, v: Node, e: Edge): number {
  if (addTreeEdge(tc.ctx, e) !== 0) return -1;
  tc.nodeMap.set(v, tc.st);
  tc.todo.push({ v, inI: 0, outI: 0, rv: 1 });
  return 1;
}

export function tstScanIn(tc: TstCtx): number {
  const top = tc.todo[tc.todo.length - 1];
  const inList = top.v.info.in;
  if (!inList) return 0;
  while (top.inI < inList.size) {
    const e = inList.list[top.inI++];
    if (isTreeEdge(e) || tc.nodeMap.has(e.tail) || nsSlack(e) !== 0) continue;
    return tstTryNode(tc, e.tail, e);
  }
  return 0;
}

export function tstScanOut(tc: TstCtx): number {
  const top = tc.todo[tc.todo.length - 1];
  const outList = top.v.info.out;
  if (!outList) return 0;
  while (top.outI < outList.size) {
    const e = outList.list[top.outI++];
    if (isTreeEdge(e) || tc.nodeMap.has(e.head) || nsSlack(e) !== 0) continue;
    return tstTryNode(tc, e.head, e);
  }
  return 0;
}

export function tstIterate(tc: TstCtx): number | undefined {
  const ri = tstScanIn(tc);
  if (ri === -1) return -1;
  if (ri === 1) return undefined;
  const ro = tstScanOut(tc);
  if (ro === -1) return -1;
  if (ro === 1) return undefined;
  const last = tc.todo.pop()!;
  if (tc.todo.length === 0) return last.rv;
  tc.todo[tc.todo.length - 1].rv += last.rv;
  return undefined;
}

/** @see lib/common/ns.c:tight_subtree_search */
export function tightSubtreeSearch(
  ctx: NsCtx, v: Node, st: Subtree, nodeMap: Map<Node, Subtree>
): number {
  nodeMap.set(v, st);
  const todo: TstState[] = [{ v, inI: 0, outI: 0, rv: 1 }];
  const tc: TstCtx = { ctx, st, nodeMap, todo };
  let rv = 1;
  while (todo.length > 0) {
    const r = tstIterate(tc);
    if (r === -1) return -1;
    if (r !== undefined) { rv = r; break; }
  }
  return rv;
}

/** @see lib/common/ns.c:find_tight_subtree */
export function findTightSubtree(
  ctx: NsCtx, v: Node, nodeMap: Map<Node, Subtree>
): Subtree | null {
  const st: Subtree = { rep: v, size: 0, heapIndex: -1 };
  st.par = st;
  const sz = tightSubtreeSearch(ctx, v, st, nodeMap);
  if (sz < 0) return null;
  st.size = sz;
  return st;
}

// ---------------------------------------------------------------------------
// inter-tree edge search
// ---------------------------------------------------------------------------

export function iteOutScan(
  todo: IteState[], nodeMap: Map<Node, Subtree>, best: Edge | undefined
): [boolean, Edge | undefined] {
  const s = todo[todo.length - 1];
  const out = s.v.info.out;
  if (!out) return [false, best];
  while (s.outI < out.size) {
    const e = out.list[s.outI++];
    if (!isTreeEdge(e)) {
      if (stSetFind(e.head, nodeMap) !== s.ts) {
        if (best === undefined || nsSlack(e) < nsSlack(best)) best = e;
      }
    } else if (e.head !== s.from) {
      todo.push({ v: e.head, ts: stSetFind(e.head, nodeMap), from: s.v, outI: 0, inI: 0 });
      return [true, best];
    }
  }
  return [false, best];
}

export function iteInScan(
  todo: IteState[], nodeMap: Map<Node, Subtree>, best: Edge | undefined
): [boolean, Edge | undefined] {
  const s = todo[todo.length - 1];
  const ti = s.v.info.in;
  if (!ti) return [false, best];
  while (s.inI < ti.size) {
    const e = ti.list[s.inI++];
    if (!isTreeEdge(e)) {
      if (stSetFind(e.tail, nodeMap) !== s.ts) {
        if (best === undefined || nsSlack(e) < nsSlack(best)) best = e;
      }
    } else if (e.tail !== s.from) {
      todo.push({ v: e.tail, ts: stSetFind(e.tail, nodeMap), from: s.v, outI: 0, inI: 0 });
      return [true, best];
    }
  }
  return [false, best];
}

/** @see lib/common/ns.c:inter_tree_edge_search */
export function interTreeEdgeSearch(
  v: Node, nodeMap: Map<Node, Subtree>
): Edge | undefined {
  const todo: IteState[] = [{ v, ts: stSetFind(v, nodeMap), outI: 0, inI: 0 }];
  let best: Edge | undefined;
  while (todo.length > 0) {
    const s = todo[todo.length - 1];
    if (s.outI === 0 && s.inI === 0 && best !== undefined && nsSlack(best) === 0) {
      todo.pop(); continue;
    }
    const [updO, b0] = iteOutScan(todo, nodeMap, best);
    best = b0;
    if (updO) continue;
    const [updI, b1] = iteInScan(todo, nodeMap, best);
    best = b1;
    if (!updI) todo.pop();
  }
  return best;
}

// ---------------------------------------------------------------------------
// STheap operations
// ---------------------------------------------------------------------------

export function stheapSwap(heap: STheap, i: number, j: number): void {
  const elt = heap.elt;
  const tmp = elt[i]; elt[i] = elt[j]; elt[j] = tmp;
  elt[i].heapIndex = i; elt[j].heapIndex = j;
}

export function stheapSmallest(heap: STheap, idx: number): number {
  const elt = heap.elt;
  const left = 2 * (idx + 1) - 1;
  const right = 2 * (idx + 1);
  let sm = idx;
  if (left < heap.size && elt[left].size < elt[sm].size) sm = left;
  if (right < heap.size && elt[right].size < elt[sm].size) sm = right;
  return sm;
}

/** @see lib/common/ns.c:STheapify */
export function stheapify(heap: STheap, i: number): void {
  let idx = i;
  while (idx < heap.size) {
    const sm = stheapSmallest(heap, idx);
    if (sm === idx) break;
    stheapSwap(heap, idx, sm);
    idx = sm;
  }
}

/** @see lib/common/ns.c:STbuildheap */
export function stBuildHeap(elt: Subtree[], size: number): STheap {
  const heap: STheap = { elt, size };
  for (let i = 0; i < size; i++) elt[i].heapIndex = i;
  for (let i = Math.floor(size / 2) - 1; i >= 0; i--) stheapify(heap, i);
  return heap;
}

/** @see lib/common/ns.c:STextractmin */
export function stExtractMin(heap: STheap): Subtree {
  const rv = heap.elt[0];
  rv.heapIndex = -1;
  heap.elt[0] = heap.elt[heap.size - 1];
  heap.elt[0].heapIndex = 0;
  heap.elt[heap.size - 1] = rv;
  heap.size--;
  stheapify(heap, 0);
  return rv;
}

// ---------------------------------------------------------------------------
// treeAdjust / mergeTrees
// ---------------------------------------------------------------------------

/**
 * Add `delta` to ND_rank of every node in the tight tree reachable from `v`
 * (the parent back-edge to `from` excluded). C's `tree_adjust` is a recursive
 * DFS; the tight tree is acyclic, so each node is visited exactly once and the
 * mutation (`rank += delta`) is order-independent. Ported with an explicit
 * stack instead of recursion: deep trees (e.g. corpus 2646, a 7-deep quadtree
 * with thousands of nodes) overflow the JS call stack where C's larger native
 * stack does not. Outcome is identical to the recursive form.
 * @see lib/common/ns.c:tree_adjust
 */
export function treeAdjust(v: Node, from: Node | undefined, delta: number): void {
  const stack: Array<[Node, Node | undefined]> = [[v, from]];
  while (stack.length > 0) {
    const [n, f] = stack.pop()!;
    n.info.rank = (n.info.rank ?? 0) + delta;
    const ti = n.info.tree_in;
    if (ti) for (let i = 0; i < ti.size; i++) {
      const w = ti.list[i].tail;
      if (w !== f) stack.push([w, n]);
    }
    const to = n.info.tree_out;
    if (to) for (let i = 0; i < to.size; i++) {
      const w = to.list[i].head;
      if (w !== f) stack.push([w, n]);
    }
  }
}

/** @see lib/common/ns.c:merge_trees */
export function mergeTrees(ctx: NsCtx, e: Edge, nodeMap: Map<Node, Subtree>): Subtree | null {
  const t0 = stSetFind(e.tail, nodeMap);
  const t1 = stSetFind(e.head, nodeMap);
  if (!onHeap(t0)) {
    const d = nsSlack(e);
    if (d !== 0) treeAdjust(t0.rep, undefined, d);
  } else {
    const d = -nsSlack(e);
    if (d !== 0) treeAdjust(t1.rep, undefined, d);
  }
  if (addTreeEdge(ctx, e) !== 0) return null;
  return stSetUnion(t0, t1);
}

// ---------------------------------------------------------------------------
// feasibleTree
// ---------------------------------------------------------------------------

export function buildSubtrees(
  ctx: NsCtx, nodeMap: Map<Node, Subtree>, tree: Subtree[]
): number {
  let cnt = 0;
  for (let n = ctx.g.info.nlist; n; n = n.info.next) {
    if (nodeMap.has(n)) continue;
    const st = findTightSubtree(ctx, n, nodeMap);
    if (st === null) return -1;
    tree[cnt++] = st;
  }
  return cnt;
}

export function mergeSubtrees(
  ctx: NsCtx, heap: STheap, nodeMap: Map<Node, Subtree>
): boolean {
  while (heap.size > 1) {
    const t0 = stExtractMin(heap);
    const e = interTreeEdgeSearch(t0.rep, nodeMap);
    if (!e) return false;
    const t1 = mergeTrees(ctx, e, nodeMap);
    if (t1 === null) return false;
    stheapify(heap, t1.heapIndex);
  }
  return true;
}

/** @see lib/common/ns.c:feasible_tree */
export function feasibleTree(ctx: NsCtx): number {
  const nodeMap = new Map<Node, Subtree>();
  const tree: Subtree[] = new Array(ctx.nNodes);
  const cnt = buildSubtrees(ctx, nodeMap, tree);
  if (cnt < 0) return 2;
  const heap = stBuildHeap(tree, cnt);
  if (!mergeSubtrees(ctx, heap, nodeMap)) return 1;
  initCutvalues(ctx);
  return 0;
}
