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

export function closeOpenEdge(e: DerivedEdge, d: DerivedNode, open: DerivedEdge[]): number {
  open.splice(open.indexOf(e), 1);
  let cross = 0;
  for (const o of open) {
    if (o.order > e.order && o.tail !== d && o.head !== d) cross++;
  }
  return cross;
}

export function openEdgesAt(d: DerivedNode, edges: DerivedEdge[], open: DerivedEdge[], order: number): void {
  for (const e of edges) {
    if (e.order === 0 && (e.tail === d || e.head === d)) { e.order = order; open.push(e); }
  }
}

export function countCrossings(list: Node[], edges: DerivedEdge[]): number {
  for (const e of edges) e.order = 0;
  const open: DerivedEdge[] = [];
  let crossings = 0; let order = 1;
  for (const n of list) {
    const d = derivedOf(n);
    if (!d) continue;
    for (const e of open.filter((e) => e.tail === d || e.head === d))
      crossings += closeOpenEdge(e, d, open);
    openEdgesAt(d, edges, open, order++);
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

export function tryInsert(list: Node[], n: Node, nbr: Node, pos: number, cnt: { v: number }): boolean {
  const copy = [...list];
  insertNode(list, n, nbr, pos);
  const nc = countCrossings(list, []);
  if (nc < cnt.v) { cnt.v = nc; return true; }
  list.length = 0; list.push(...copy); return false;
}

export function reducePass(list: Node[], edges: DerivedEdge[], cnt: { v: number }): void {
  for (const n of [...list]) {
    const dn = derivedOf(n); if (!dn) continue;
    const nbrs = edges.filter((e) => e.tail === dn || e.head === dn)
      .map((e) => (e.tail === dn ? e.head : e.tail).orig);
    for (const nbr of nbrs) {
      for (const pos of [0, 1] as const) {
        const copy = [...list];
        insertNode(list, n, nbr, pos);
        const nc = countCrossings(list, edges);
        if (nc < cnt.v) { cnt.v = nc; if (cnt.v === 0) return; }
        else { list.length = 0; list.push(...copy); }
      }
    }
  }
}

const CROSS_ITER = 10;

export function reduceEdgeCrossings(list: Node[], edges: DerivedEdge[]): Node[] {
  const cnt = { v: countCrossings(list, edges) };
  for (let i = 0; i < CROSS_ITER && cnt.v > 0; i++) {
    const prev = cnt.v; reducePass(list, edges, cnt);
    if (prev === cnt.v) break;
  }
  return list;
}

// ---------------------------------------------------------------------------
// Spanning tree
// ---------------------------------------------------------------------------

export function dfsSpan(sn: SpanNode, map: Map<DerivedNode, SpanNode>, edges: DerivedEdge[]): void {
  sn.visited = true;
  for (const e of edges) {
    const nbr = e.tail === sn.dn ? e.head : e.head === sn.dn ? e.tail : null;
    if (!nbr) continue;
    const nsn = map.get(nbr);
    if (nsn && !nsn.visited) { nsn.tparent = sn; dfsSpan(nsn, map, edges); }
  }
}

export function buildSpanTree(nodes: DerivedNode[], edges: DerivedEdge[]): Map<DerivedNode, SpanNode> {
  const map = new Map<DerivedNode, SpanNode>();
  for (const dn of nodes)
    map.set(dn, { dn, tparent: null, visited: false, distone: 0, disttwo: 0, leafone: null, leaftwo: null, onpath: false });
  if (nodes.length > 0) dfsSpan(map.get(nodes[0]!)!, map, edges);
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
  const spanMap = buildSpanTree(sn.subGraph.nodes, edges);
  const spanPath = findLongestPath([...spanMap.values()]);
  const list: Node[] = spanPath.map((s) => s.dn.orig);
  for (const s of spanPath) s.dn.cdata.flags |= FLAGS_ONPATH;
  placeResiduals(sn, edges, list);
  reduceEdgeCrossings(list, edges);
  realignToParent(list);
  const N = list.length;
  const largest = largestNodesize(list);
  const radius = N <= 1 ? 0 : N * (minDist + largest) / (2 * Math.PI);
  assignPositions(list, radius);
  sn.radius = N <= 1 ? largest / 2 : radius;
  sn.rad0 = sn.radius; sn.parentPos = -1;
  return list;
}
