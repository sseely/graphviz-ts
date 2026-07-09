// SPDX-License-Identifier: EPL-2.0

/**
 * Per-block circle layout: skeleton extraction, spanning tree, longest-path
 * heuristic, crossing reduction, radius and position assignment.
 *
 * Ports lib/circogen/blockpath.c. All functions are exported so lizard
 * counts each one independently.
 *
 * @see lib/circogen/blockpath.c
 */

import type { Node } from '../../model/node.js';
import type { Block, SubGraph, CircState, DerivedNode, DerivedEdge } from './blocks.js';
import { FLAGS_ONPATH, FLAGS_ISPARENT } from './blocks.js';
import { gvQsort } from '../../util/bsd-qsort.js';

export type SpanNode = {
  dn: DerivedNode; tparent: SpanNode | null; visited: boolean;
  distone: number; disttwo: number;
  leafone: SpanNode | null; leaftwo: SpanNode | null; onpath: boolean;
};

// ---------------------------------------------------------------------------
// Block-graph induction
// ---------------------------------------------------------------------------

export function blockGraph(allEdges: DerivedEdge[], sn: Block): void {
  const ns = new Set(sn.subGraph.nodes);
  for (const n of sn.subGraph.nodes) {
    for (const e of allEdges) {
      if (e.tail === n && ns.has(e.head) && !sn.subGraph.edges.includes(e))
        sn.subGraph.edges.push(e);
    }
  }
}

// ---------------------------------------------------------------------------
// Crossing counting helpers (each branch extracted to keep CCN low)
// ---------------------------------------------------------------------------

export function derivedOf(n: Node): DerivedNode | null {
  return (n.info.alg as { derivedNode?: DerivedNode } | undefined)?.derivedNode ?? null;
}

export function closeOpenEdge(e: DerivedEdge, d: DerivedNode, opened: DerivedEdge[]): number {
  let cross = 0;
  for (const o of opened) {
    if (o.order > e.order && o.tail !== d && o.head !== d) cross++;
  }
  return cross;
}

export function openEdgesAt(d: DerivedNode, edges: DerivedEdge[], opened: DerivedEdge[], order: number): void {
  for (const e of edges) {
    if (e.order === 0 && (e.tail === d || e.head === d)) { e.order = order; opened.push(e); }
  }
}

/**
 * C's count_all_crossings — INCLUDING its load-bearing bug: remove_edge keys
 * the open-edge dict by the half-edge POINTER handed to it, and the closing
 * node's agfstedge always yields the OPPOSITE half from the one stored when
 * the edge was opened, so dtdelete never matches and the list only grows
 * (circogen/edgelist.c:cmpItem on Agedge_t*). Each edge's close therefore
 * counts EVERY edge opened after it (nested as well as interleaved spans),
 * minus edges incident to the closing node — an inflated count that reduce()
 * uses to accept moves. Do not "fix" this to true interleave counting: the
 * final circle order depends on it.
 * @see lib/circogen/blockpath.c:count_all_crossings
 * @see lib/circogen/edgelist.c:remove_edge
 */
export function countCrossings(list: Node[], edges: DerivedEdge[]): number {
  for (const e of edges) e.order = 0;
  const opened: DerivedEdge[] = [];
  let crossings = 0; let order = 1;
  for (const n of list) {
    const d = derivedOf(n);
    if (!d) continue;
    // Close pass: incident edges already opened at their other endpoint
    // (edges opened AT this node still have order 0 — the open pass below
    // runs after, so each edge closes exactly once).
    for (const e of edges) {
      if (e.order > 0 && (e.tail === d || e.head === d))
        crossings += closeOpenEdge(e, d, opened);
    }
    openEdgesAt(d, edges, opened, order++);
  }
  return crossings;
}

// ---------------------------------------------------------------------------
// Crossing reduction
// ---------------------------------------------------------------------------

export function insertNode(list: Node[], cn: Node, neighbor: Node, pos: number): void {
  const i = list.indexOf(cn); if (i !== -1) list.splice(i, 1);
  const ni = list.indexOf(neighbor);
  if (ni === -1) { list.push(cn); return; }
  list.splice(pos === 0 ? ni : ni + 1, 0, cn);
}

/**
 * One reduce pass, mirroring C's reduce (blockpath.c:439): iterate the
 * SUBGRAPH's nodes in agfstnode (root-seq) order — NOT the current list
 * order — and each node's incident edges in agfstedge order; the neighbour
 * is agtail(e) unless that is curnode. The first-improving-move order is
 * load-bearing for the final arrangement.
 */
export function reducePass(
  list: Node[], edges: DerivedEdge[], cnt: { v: number }, nodes: DerivedNode[],
): void {
  const ord = new Map<DerivedNode, number>();
  nodes.forEach((dn, i) => ord.set(dn, i));
  const seq = new Map<DerivedEdge, number>();
  edges.forEach((e, i) => seq.set(e, i));
  for (const dn of nodes) {
    for (const e of spanIncident(dn, edges, ord, seq)) {
      let neighbor = e.tail;
      if (neighbor === dn) neighbor = e.head;
      for (const pos of [0, 1] as const) {
        const copy = [...list];
        insertNode(list, dn.orig, neighbor.orig, pos);
        const nc = countCrossings(list, edges);
        if (nc < cnt.v) { cnt.v = nc; if (cnt.v === 0) return; }
        else { list.length = 0; list.push(...copy); }
      }
    }
  }
}

const CROSS_ITER = 10;

/** @see lib/circogen/blockpath.c:reduce_edge_crossings */
export function reduceEdgeCrossings(
  list: Node[], edges: DerivedEdge[], nodes: DerivedNode[],
): Node[] {
  const cnt = { v: countCrossings(list, edges) };
  for (let i = 0; i < CROSS_ITER && cnt.v > 0; i++) {
    const prev = cnt.v; reducePass(list, edges, cnt, nodes);
    if (prev === cnt.v) break;
  }
  return list;
}

// ---------------------------------------------------------------------------
// Spanning tree
// ---------------------------------------------------------------------------

/**
 * Incident edges of dn in agfstedge order over the (possibly pruned)
 * subgraph edge set: out-edges (by head order, seq) then in-edges (by tail
 * order, seq). `ord`/`seq` maps carry the derived root's node and edge
 * creation orders. @see lib/cgraph/edge.c:agfstedge
 */
function spanIncident(
  dn: DerivedNode, edges: DerivedEdge[],
  ord: Map<DerivedNode, number>, seq: Map<DerivedEdge, number>,
): DerivedEdge[] {
  const out = edges.filter((e) => e.tail === dn)
    .sort((a, b) => ((ord.get(a.head) ?? 0) - (ord.get(b.head) ?? 0)) || ((seq.get(a) ?? 0) - (seq.get(b) ?? 0)));
  const inn = edges.filter((e) => e.head === dn)
    .sort((a, b) => ((ord.get(a.tail) ?? 0) - (ord.get(b.tail) ?? 0)) || ((seq.get(a) ?? 0) - (seq.get(b) ?? 0)));
  return [...out, ...inn];
}

export function dfsSpan(
  sn: SpanNode, map: Map<DerivedNode, SpanNode>, edges: DerivedEdge[],
  ord: Map<DerivedNode, number>, seq: Map<DerivedEdge, number>,
): void {
  sn.visited = true;
  // C dfs iterates agfstedge(g, n) — n's incident edges, not the flat list.
  // @see blockpath.c:321 dfs
  for (const e of spanIncident(sn.dn, edges, ord, seq)) {
    const nbr = e.tail === sn.dn ? e.head : e.tail;
    const nsn = map.get(nbr);
    if (nsn && !nsn.visited) { nsn.tparent = sn; dfsSpan(nsn, map, edges, ord, seq); }
  }
}

export function buildSpanTree(nodes: DerivedNode[], edges: DerivedEdge[]): Map<DerivedNode, SpanNode> {
  const map = new Map<DerivedNode, SpanNode>();
  for (const dn of nodes)
    map.set(dn, { dn, tparent: null, visited: false, distone: 0, disttwo: 0, leafone: null, leaftwo: null, onpath: false });
  const ord = new Map<DerivedNode, number>();
  nodes.forEach((dn, i) => ord.set(dn, i));
  const seq = new Map<DerivedEdge, number>();
  edges.forEach((e, i) => seq.set(e, i));
  // C spanning_tree runs dfs from every unvisited node (forest).
  // @see blockpath.c:344 spanning_tree
  for (const dn of nodes) {
    const sn = map.get(dn)!;
    if (!sn.visited) { sn.tparent = null; dfsSpan(sn, map, edges, ord, seq); }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Longest path helpers
// ---------------------------------------------------------------------------

export function measureDist(leaf: SpanNode, anc: SpanNode, dist: number, change: SpanNode | null): void {
  const p = anc.tparent; if (!p) return;
  const d = dist + 1;
  if (p.distone === 0) { p.leafone = leaf; p.distone = d; }
  else if (d > p.distone) {
    // C only displaces leafone into the second slot when it is not the
    // leaf being replaced (the `change` chain). @see blockpath.c:measure_distance
    if (p.leafone !== change) {
      if (!p.disttwo || p.leaftwo !== change) change = p.leafone;
      p.leaftwo = p.leafone; p.disttwo = p.distone;
    }
    p.leafone = leaf; p.distone = d;
  } else if (d > p.disttwo) { p.leaftwo = leaf; p.disttwo = d; return; }
  else return;
  measureDist(leaf, p, d, change);
}

export function pathToNode(from: SpanNode, stop: SpanNode): SpanNode[] {
  const path: SpanNode[] = [];
  for (let n: SpanNode | null = from; n && n !== stop; n = n.tparent)
    { path.push(n); n.onpath = true; }
  return path;
}

export function leafDegree(sn: SpanNode, all: SpanNode[]): number {
  return all.filter((o) => o.tparent === sn || sn.tparent === o).length;
}

export function findCommon(spanNodes: SpanNode[]): SpanNode | null {
  let common: SpanNode | null = null; let maxLen = 0;
  for (const sn of spanNodes) {
    const len = sn.distone + sn.disttwo;
    if (len > maxLen) { common = sn; maxLen = len; }
  }
  return common;
}

export function findLongestPath(spanNodes: SpanNode[]): SpanNode[] {
  if (spanNodes.length === 1) { spanNodes[0]!.onpath = true; return [spanNodes[0]!]; }
  for (const sn of spanNodes)
    if (leafDegree(sn, spanNodes) === 1) measureDist(sn, sn, 0, null);
  const common = findCommon(spanNodes);
  if (!common) return [];
  const begin = pathToNode(common.leafone ?? common, common);
  begin.push(common); common.onpath = true;
  if (common.disttwo > 0 && common.leaftwo) {
    const end = pathToNode(common.leaftwo, common);
    end.reverse(); for (const s of end) begin.push(s);
  }
  return begin;
}

// ---------------------------------------------------------------------------
// Residual node placement helpers
// ---------------------------------------------------------------------------

export function largestNodesize(list: Node[]): number {
  // C reads ND_width/ND_height — INCHES; the whole circo layout space
  // is inches until spline_edges converts to points.
  let s = 0;
  for (const n of list) s = Math.max(s, n.info.width || 0, n.info.height || 0);
  return s;
}

export function neighborSet(dn: DerivedNode, edges: DerivedEdge[]): Set<DerivedNode> {
  const s = new Set<DerivedNode>();
  for (const e of edges) {
    if (e.tail === dn) s.add(e.head);
    else if (e.head === dn) s.add(e.tail);
  }
  return s;
}

export function isNeighbor(n: Node, nbrs: Set<DerivedNode>): boolean {
  const d = derivedOf(n); return d !== null && nbrs.has(d);
}

export function placeNodeBetweenTwo(list: Node[], dn: DerivedNode, nbrs: Set<DerivedNode>): boolean {
  for (let i = 0; i < list.length; i++) {
    if (isNeighbor(list[i]!, nbrs) && isNeighbor(list[(i + 1) % list.length]!, nbrs))
      { list.splice(i + 1, 0, dn.orig); return true; }
  }
  return false;
}

export function placeNodeAfterAny(list: Node[], dn: DerivedNode, nbrs: Set<DerivedNode>): boolean {
  for (let i = 0; i < list.length; i++) {
    if (isNeighbor(list[i]!, nbrs)) { list.splice(i + 1, 0, dn.orig); return true; }
  }
  return false;
}

export function placeNode(dn: DerivedNode, edges: DerivedEdge[], list: Node[]): void {
  const nbrs = neighborSet(dn, edges);
  if (nbrs.size >= 2 && placeNodeBetweenTwo(list, dn, nbrs)) return;
  if (nbrs.size > 0 && placeNodeAfterAny(list, dn, nbrs)) return;
  list.push(dn.orig);
}

export function placeResiduals(sn: Block, edges: DerivedEdge[], list: Node[]): void {
  for (const dn of sn.subGraph.nodes)
    if (!(dn.cdata.flags & FLAGS_ONPATH)) placeNode(dn, edges, list);
}

// ---------------------------------------------------------------------------
// Realign and position assignment
// ---------------------------------------------------------------------------

export function realignToParent(list: Node[]): void {
  for (let i = 0; i < list.length; i++) {
    const f = (list[i]!.info.alg as { flags?: number } | undefined)?.flags ?? 0;
    if (f & FLAGS_ISPARENT) { const h = list.splice(0, i); list.push(...h); break; }
  }
}

export function assignPositions(list: Node[], radius: number): void {
  const N = list.length;
  for (let k = 0; k < N; k++) {
    const theta = k * (2 * Math.PI / N);
    const n = list[k]!;
    n.info.pos = n.info.pos ?? [0, 0];
    n.info.pos[0] = radius * Math.cos(theta);
    n.info.pos[1] = radius * Math.sin(theta);
    const a = n.info.alg as Record<string, unknown> | undefined;
    if (a) { a['pos'] = k; a['psi'] = 0; }
  }
}

// ---------------------------------------------------------------------------
// remove_pair_edges — layout skeleton extraction
// @see lib/circogen/blockpath.c:clone_graph/getList/find_pair_edges/
//      remove_pair_edges
// ---------------------------------------------------------------------------

/** Mutable clone edge (xclone in C's clone_graph). */
interface XEdge {
  tail: XNode;
  head: XNode;
  /** Original derived edge; null once its deletion from outg is recorded. */
  orige: DerivedEdge | null;
  /** Creation order — cgraph edge seq proxy. */
  seq: number;
  alive: boolean;
}

/** Mutable clone node. `idx` is creation order — C compares node POINTERS
 * ((uintptr_t)n1 < n2, allocation order); creation index is the proxy. */
interface XNode {
  dn: DerivedNode;
  idx: number;
  degree: number;
  out: XEdge[];
  in: XEdge[];
  alive: boolean;
}

/** Incident live edges of x in agfstedge order: out-edges (by head idx, seq)
 * then in-edges (by tail idx, seq). @see lib/cgraph/edge.c:agfstedge */
function xIncident(x: XNode): XEdge[] {
  const out = x.out.filter((e) => e.alive)
    .sort((a, b) => (a.head.idx - b.head.idx) || (a.seq - b.seq));
  const inn = x.in.filter((e) => e.alive)
    .sort((a, b) => (a.tail.idx - b.tail.idx) || (a.seq - b.seq));
  return [...out, ...inn];
}

/** agfindedge on the clone: live edge between a and b, either direction. */
function xFindEdge(a: XNode, b: XNode): XEdge | null {
  for (const e of a.out) if (e.alive && e.head === b) return e;
  for (const e of a.in) if (e.alive && e.tail === b) return e;
  return null;
}

/** agedge(g, tp, hp, NULL, 1) on the clone: create a new live edge. */
function xAddEdge(tp: XNode, hp: XNode, seq: number): void {
  const e: XEdge = { tail: tp, head: hp, orige: null, seq, alive: true };
  tp.out.push(e);
  hp.in.push(e);
}

/** agdelete(g, currnode): kill the node and its incident edges. */
function xDeleteNode(x: XNode): void {
  x.alive = false;
  for (const e of x.out) e.alive = false;
  for (const e of x.in) e.alive = false;
}

/** Working state threaded through the find_pair_edges passes. */
interface PairCtx {
  pruned: Set<DerivedEdge>;
  nextSeq: { v: number };
}

/**
 * The pair-edge scan for one node: delete "paired" original edges from the
 * skeleton and add synthetic clone edges between unpaired neighbours.
 * @see lib/circogen/blockpath.c:find_pair_edges
 */
export function findPairEdges(n: XNode, ctx: PairCtx): void {
  let edgeCnt = 0;
  const nodeDegree = n.degree;
  const withPair: XNode[] = [];
  const withoutPair: XNode[] = [];

  const incident = xIncident(n);
  for (const e of incident) {
    const n1 = e.head === n ? e.tail : e.head;
    let hasPairEdge = false;
    for (const ep of incident) {
      if (ep === e) continue;
      const n2 = ep.head === n ? ep.tail : ep.head;
      const ex = xFindEdge(n1, n2);
      if (ex) {
        hasPairEdge = true;
        if (n1.idx < n2.idx) { // count edge only once (C: pointer compare)
          edgeCnt++;
          if (ex.orige !== null) {
            ctx.pruned.add(ex.orige); // agdelete(outg, ORIGE(ex))
            ex.orige = null; // delete only once
          }
        }
      }
    }
    if (hasPairEdge) withPair.push(n1);
    else withoutPair.push(n1);
  }

  let diff = nodeDegree - 1 - edgeCnt;
  if (diff > 0) {
    if (diff < withoutPair.length) {
      // C's first loop pairs ALL adjacent neighbours_without entries — it is
      // NOT gated on diff staying positive (diff may go negative, skipping
      // the second loop). @see blockpath.c:143
      for (let mark = 0; mark + 1 < withoutPair.length; mark += 2) {
        xAddEdge(withoutPair[mark]!, withoutPair[mark + 1]!, ctx.nextSeq.v++);
        withoutPair[mark]!.degree++;
        withoutPair[mark + 1]!.degree++;
        diff--;
      }
      for (let mark = 2; diff > 0; mark++, diff--) {
        xAddEdge(withoutPair[0]!, withoutPair[mark]!, ctx.nextSeq.v++);
        withoutPair[0]!.degree++;
        withoutPair[mark]!.degree++;
      }
    } else if (diff === withoutPair.length) {
      // C's tp can only be non-null here (a pair marks two neighbours), but
      // mirror the guard structure.
      const tp = withPair.length === 0 ? null : withPair[0]!;
      for (const hp of withoutPair) {
        if (tp !== null) {
          xAddEdge(tp, hp, ctx.nextSeq.v++);
          tp.degree++;
        }
        hp.degree++;
      }
    }
  }
}

/**
 * Create the layout skeleton: repeatedly take the minimum-degree clone node,
 * delete paired original edges around it, and remove it. Returns the block's
 * edges minus the pruned ones (C's outg), which the spanning tree runs over.
 * The deglist is qsort-sorted (descending degree, LIST_SORT -> libc qsort) —
 * the equal-degree tie permutation decides the processing order.
 * @see lib/circogen/blockpath.c:remove_pair_edges
 */
export function removePairEdges(
  nodes: DerivedNode[], edges: DerivedEdge[],
): DerivedEdge[] {
  // clone_graph: xclone nodes in subgraph (root-seq) order; xclone edges from
  // agfstout scans in node order, seq = creation order.
  const xmap = new Map<DerivedNode, XNode>();
  nodes.forEach((dn, i) => {
    xmap.set(dn, { dn, idx: i, degree: 0, out: [], in: [], alive: true });
  });
  let seq = 0;
  for (const dn of nodes) {
    const xn = xmap.get(dn)!;
    for (const e of edges) {
      if (e.tail !== dn) continue;
      const xh = xmap.get(e.head);
      if (!xh) continue;
      const xe: XEdge = { tail: xn, head: xh, orige: e, seq: seq++, alive: true };
      xn.out.push(xe);
      xh.in.push(xe);
      xn.degree += 1;
      xh.degree += 1;
    }
  }

  const ctx: PairCtx = { pruned: new Set<DerivedEdge>(), nextSeq: { v: seq } };
  const cmpDegree = (a: XNode, b: XNode): number =>
    (a.degree < b.degree ? 1 : a.degree > b.degree ? -1 : 0);

  // getList: nodes in agfstnode order, qsort by descending degree.
  const dl: XNode[] = gvQsort([...xmap.values()], cmpDegree);

  const nodeCount = nodes.length;
  for (let counter = 0; counter < nodeCount - 3; counter++) {
    const currnode = dl.length === 0 ? null : dl.pop()!;
    if (currnode === null) continue;

    // Remove all adjacent nodes since they have to be reinserted.
    const adj = xIncident(currnode).map((e) =>
      e.head === currnode ? e.tail : e.head);
    for (const a of adj) {
      const ix = dl.indexOf(a);
      if (ix >= 0) dl.splice(ix, 1);
    }

    findPairEdges(currnode, ctx);

    for (const a of xIncident(currnode).map((e) =>
      e.head === currnode ? e.tail : e.head)) {
      a.degree--;
      dl.push(a);
    }
    gvQsort(dl, cmpDegree);

    xDeleteNode(currnode);
  }

  return edges.filter((e) => !ctx.pruned.has(e));
}

// ---------------------------------------------------------------------------
// Main entry point
// @see lib/circogen/blockpath.c:layout_block
// ---------------------------------------------------------------------------

export function layoutBlock(g: SubGraph, sn: Block, minDist: number, _state: CircState): Node[] {
  void _state;
  // cgraph iterates subgraph nodes in root-creation (ID) order, not
  // block-insertion order; the spanning-tree root and path order
  // depend on it. @see lib/cgraph (dictionary ordering by AGID)
  sn.subGraph.nodes.sort((a, b) => a.orig.id - b.orig.id);
  blockGraph(g.edges, sn);
  const edges = sn.subGraph.edges as unknown as DerivedEdge[];
  for (const dn of sn.subGraph.nodes) dn.cdata.flags &= ~FLAGS_ONPATH;
  // C: copyG = remove_pair_edges(subg) — the spanning tree runs over the
  // PRUNED skeleton; the full edge set is still used for residual placement
  // and crossing reduction. @see blockpath.c:578-586
  const skeleton = removePairEdges(sn.subGraph.nodes, edges);
  const spanMap = buildSpanTree(sn.subGraph.nodes, skeleton);
  const spanPath = findLongestPath([...spanMap.values()]);
  const list: Node[] = spanPath.map((s) => s.dn.orig);
  for (const s of spanPath) s.dn.cdata.flags |= FLAGS_ONPATH;
  placeResiduals(sn, edges, list);
  reduceEdgeCrossings(list, edges, sn.subGraph.nodes);
  realignToParent(list);
  const N = list.length;
  const largest = largestNodesize(list);
  const radius = N <= 1 ? 0 : N * (minDist + largest) / (2 * Math.PI);
  assignPositions(list, radius);
  sn.radius = N <= 1 ? largest / 2 : radius;
  sn.rad0 = sn.radius; sn.parentPos = -1;
  return list;
}
