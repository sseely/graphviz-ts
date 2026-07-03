// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/class1.c and lib/dotgen/class2.c.
 *
 * class1: initial edge classification — virtual edges for span-1 edges,
 * intercluster edges via interclust1.
 *
 * class2: full edge classification — virtual node chains for long edges,
 * flat/cluster/back edges, fast-graph setup for crossing minimization.
 *
 * @see lib/dotgen/class1.c
 * @see lib/dotgen/class2.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { buildOutEdgeIndex } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import {
  VIRTUAL,
  virtualNode, virtualEdge, fastNode, flatEdge,
  findFastEdge, mergeOneway, otherEdge,
} from './fastgr.js';
import { ufFind, nodesInSeq } from './decomp.js';
import { dotRoot } from './mincross-utils.js';
import { SLACKNODE, CLUSTER, CL_BACK, IGNORED } from './rank.js';
import { CLUSTER_EDGE } from './cluster-path.js';
import { makeAuxEdge } from './position-aux.js';
// Circular imports: classify.ts ↔ cluster.ts — fine for function declarations
import { markClusters, buildSkeleton } from './cluster.js';

// ---------------------------------------------------------------------------
// portsEq  @see lib/dotgen/position.c:ports_eq
// ---------------------------------------------------------------------------

/**
 * Returns true when edges e and f share the same port configuration.
 * Note the asymmetry: only e's tail_port.defined is checked for tail coords.
 * @see lib/dotgen/position.c:ports_eq
 */
export function portsEq(e: Edge, f: Edge): boolean {
  const ehp = e.info.head_port;
  const fhp = f.info.head_port;
  const etp = e.info.tail_port;
  const ftp = f.info.tail_port;
  const headMatch = (ehp.p.x === fhp.p.x && ehp.p.y === fhp.p.y) || !ehp.defined;
  const tailMatch = (etp.p.x === ftp.p.x && etp.p.y === ftp.p.y) || !etp.defined;
  return ehp.defined === fhp.defined && headMatch && tailMatch;
}

// ---------------------------------------------------------------------------
// nonconstraintEdge  @see lib/dotgen/class1.c:nonconstraint_edge
// ---------------------------------------------------------------------------

/**
 * Returns true when the edge has constraint=false.
 * @see lib/dotgen/class1.c:nonconstraint_edge
 */
export function nonconstraintEdge(e: Edge): boolean {
  return e.info.constraint === false;
}

// ---------------------------------------------------------------------------
// Virtual-weight helpers (inlined to avoid mincross.ts cycle)
// ---------------------------------------------------------------------------

const WNODE_ORDINARY = 0;
const WNODE_SINGLETON = 1;
const WNODE_VIRTUAL = 2;
const CLASSIFY_WEIGHT_TABLE = [[1, 1, 1], [1, 2, 2], [1, 2, 4]];

function epClass(n: Node): number {
  if (n.info.node_type === VIRTUAL) return WNODE_VIRTUAL;
  if ((n.info.weight_class ?? 2) <= 1) return WNODE_SINGLETON;
  return WNODE_ORDINARY;
}

/** @see lib/dotgen/mincross.c:virtual_weight (inlined to avoid cycle) */
function applyVirtualWeight(e: Edge): void {
  const t = CLASSIFY_WEIGHT_TABLE[epClass(e.tail)][epClass(e.head)];
  e.info.weight = (e.info.weight ?? 1) * t;
}

// ---------------------------------------------------------------------------
// interclust1 helpers  @see lib/dotgen/class1.c:interclust1
// ---------------------------------------------------------------------------

function interclust1TRank(e: Edge): number {
  const clust = e.tail.info.clust;
  return clust ? (e.tail.info.rank ?? 0) - (clust.info.leader?.info.rank ?? 0) : 0;
}

function interclust1HRank(e: Edge): number {
  const clust = e.head.info.clust;
  return clust ? (e.head.info.rank ?? 0) - (clust.info.leader?.info.rank ?? 0) : 0;
}

function interclust1Lengths(e: Edge): [number, number] {
  const offset = (e.info.minlen ?? 1) + interclust1TRank(e) - interclust1HRank(e);
  return offset > 0 ? [0, offset] : [-offset, 0];
}

/**
 * Build a slack-node virtual edge for inter-cluster edges.
 * @see lib/dotgen/class1.c:interclust1
 */
function interclust1(g: Graph, t: Node, h: Node, e: Edge): void {
  const [tLen, hLen] = interclust1Lengths(e);
  const v = virtualNode(g);
  v.info.node_type = SLACKNODE;
  const t0 = ufFind(t);
  const h0 = ufFind(h);
  const w = e.info.weight ?? 1;
  const rt = makeAuxEdge(v, t0, tLen, CL_BACK * w);
  const rh = makeAuxEdge(v, h0, hLen, w);
  rt.info.to_orig = e;
  rh.info.to_orig = e;
}

// ---------------------------------------------------------------------------
// class1  @see lib/dotgen/class1.c:class1
// ---------------------------------------------------------------------------

function class1Edge(g: Graph, e: Edge): void {
  if (e.info.to_virt !== undefined) return;
  if (nonconstraintEdge(e)) return;
  const t = ufFind(e.tail);
  const h = ufFind(e.head);
  if (t === h) return;
  if (t.info.clust || h.info.clust) { interclust1(g, e.tail, e.head, e); return; }
  const rep = findFastEdge(t, h);
  if (rep !== undefined) mergeOneway(e, rep);
  else virtualEdge(t, h, e);
}

/**
 * Initial edge classification pass.
 * @see lib/dotgen/class1.c:class1
 */
export function class1(g: Graph): void {
  markClusters(g);
  for (const n of nodesInSeq(g)) {
    for (const e of n.outEdges(g)) class1Edge(g, e);
  }
}

// ---------------------------------------------------------------------------
// makeChain helpers  @see lib/dotgen/class2.c:make_chain
// ---------------------------------------------------------------------------

function labelVnodeDimen(orig: Edge): { x: number; y: number } | undefined {
  const lbl = orig.info.label as ({ dimen?: { x: number; y: number } } | undefined);
  return lbl?.dimen;
}

function labelVnode(g: Graph, orig: Edge): Node {
  const dimen = labelVnodeDimen(orig);
  const v = virtualNode(g);
  v.info.label = orig.info.label;
  // C uses GD_nodesep(agroot(v)) — the ROOT graph's nodesep — not the
  // (possibly cluster) subgraph's. For a label vnode created inside a cluster
  // whose nodesep is unset, reading g.info.nodesep yields 0, shrinking the
  // node's left half-width and shifting the x-coord aux-edge minlen, which
  // perturbs the x-coord network-simplex tree (share-b51 blok_60: 158px off).
  // @see lib/dotgen/class2.c:label_vnode (ND_lw(v) = GD_nodesep(agroot(v)))
  v.info.lw = dotRoot(g).info.nodesep ?? 0;
  if (!(orig.info as { label_ontop?: number }).label_ontop && dimen) {
    const flip = dotRoot(g).info.flip === true;
    v.info.ht = flip ? dimen.x : dimen.y;
    v.info.rw = flip ? dimen.y : dimen.x;
  }
  return v;
}

function incrWidth(g: Graph, v: Node): void {
  const width = Math.floor((g.info.nodesep ?? 0) / 2);
  v.info.lw = (v.info.lw ?? 0) + width;
  v.info.rw = (v.info.rw ?? 0) + width;
}

function plainVnode(g: Graph): Node {
  const v = virtualNode(g);
  incrWidth(g, v);
  return v;
}

function leaderOf(v: Node): Node {
  if (v.info.ranktype !== CLUSTER) return ufFind(v);
  return v.info.clust!.info.rankleader![v.info.rank ?? 0];
}

function chainVnode(g: Graph, orig: Edge, r: number, labelRank: number): Node {
  if (r === labelRank) return labelVnode(g, orig);
  return plainVnode(g);
}

/**
 * Build a virtual node chain from `from` to `to` for edge `orig`.
 * @see lib/dotgen/class2.c:make_chain
 */
export function makeChain(g: Graph, from: Node, to: Node, orig: Edge): void {
  const labelRank = orig.info.label !== undefined
    ? Math.floor(((from.info.rank ?? 0) + (to.info.rank ?? 0)) / 2)
    : -1;
  let u = from;
  const toRank = to.info.rank ?? 0;
  for (let r = (from.info.rank ?? 0) + 1; r <= toRank; r++) {
    const v = r < toRank ? (() => { const n = chainVnode(g, orig, r, labelRank); n.info.rank = r; return n; })() : to;
    const e = virtualEdge(u, v, orig);
    applyVirtualWeight(e);
    u = v;
  }
}

// ---------------------------------------------------------------------------
// mergeChain  @see lib/dotgen/class2.c:merge_chain
// ---------------------------------------------------------------------------

function nodeRank(n: Node): number { return n.info.rank ?? 0; }
function edgeCount(e: Edge): number { return e.info.count ?? 1; }
function edgeXpenalty(e: Edge): number { return e.info.xpenalty ?? 0; }
function edgeWeight(e: Edge): number { return e.info.weight ?? 1; }
function nextVirtEdge(e: Edge): Edge | undefined { return e.head.info.out?.list[0]; }

function mergeChainStep(rep: Edge, e: Edge, updateCount: boolean): Edge | undefined {
  if (updateCount) rep.info.count = edgeCount(rep) + edgeCount(e);
  rep.info.xpenalty = edgeXpenalty(rep) + edgeXpenalty(e);
  rep.info.weight = edgeWeight(rep) + edgeWeight(e);
  return nextVirtEdge(rep);
}

/**
 * Merge edge `e` into the virtual chain `f`, accumulating weights.
 * @see lib/dotgen/class2.c:merge_chain
 */
export function mergeChain(g: Graph, e: Edge, f: Edge, updateCount: boolean): void {
  const lastrank = Math.max(e.tail.info.rank ?? 0, e.head.info.rank ?? 0);
  e.info.to_virt = f;
  let rep: Edge | undefined = f;
  while (rep !== undefined) {
    if ((rep.head.info.rank ?? 0) === lastrank) { mergeChainStep(rep, e, updateCount); break; }
    incrWidth(g, rep.head);
    rep = mergeChainStep(rep, e, updateCount);
  }
}

// ---------------------------------------------------------------------------
// mergeable  @see lib/dotgen/class2.c:mergeable
// ---------------------------------------------------------------------------

/**
 * True when edges e and f connect the same endpoints, label, and ports.
 * @see lib/dotgen/class2.c:mergeable
 */
export function mergeable(e: Edge | undefined, f: Edge | undefined): boolean {
  if (!e || !f) return false;
  return e.tail === f.tail && e.head === f.head
    && e.info.label === f.info.label
    && portsEq(e, f);
}

// ---------------------------------------------------------------------------
// interclrep  @see lib/dotgen/class2.c:interclrep
// ---------------------------------------------------------------------------

function interclrepChain(g: Graph, e: Edge, t: Node, h: Node): void {
  makeChain(g, t, h, e);
  let cur: Edge | undefined = e.info.to_virt;
  while (cur !== undefined && nodeRank(cur.head) <= nodeRank(h)) {
    cur.info.edge_type = CLUSTER_EDGE;
    cur = cur.head.info.out?.list[0];
  }
}

function interclrep(g: Graph, e: Edge): void {
  let t = leaderOf(e.tail);
  let h = leaderOf(e.head);
  if (nodeRank(t) > nodeRank(h)) { const tmp = t; t = h; h = tmp; }
  if (t.info.clust === h.info.clust) return;
  const ve = findFastEdge(t, h);
  if (ve !== undefined) { mergeChain(g, e, ve, true); return; }
  if (nodeRank(t) === nodeRank(h)) return;
  interclrepChain(g, e, t, h);
}

// ---------------------------------------------------------------------------
// isClusterEdge  @see lib/dotgen/class2.c:is_cluster_edge
// ---------------------------------------------------------------------------

function isClusterEdge(e: Edge): boolean {
  return e.tail.info.ranktype === CLUSTER || e.head.info.ranktype === CLUSTER;
}

// ---------------------------------------------------------------------------
// class2 cluster-edge handler
// ---------------------------------------------------------------------------

function handleClusterMergeable(g: Graph, e: Edge, prev: Edge): Edge | undefined {
  if (prev.info.to_virt !== undefined) {
    mergeChain(g, e, prev.info.to_virt!, false);
    otherEdge(e);
  } else if ((e.tail.info.rank ?? 0) === (e.head.info.rank ?? 0)) {
    mergeOneway(e, prev);
    otherEdge(e);
  }
  return prev;
}

function handleClusterEdge(g: Graph, e: Edge, prev: Edge | undefined): Edge | undefined {
  if (mergeable(prev, e)) return handleClusterMergeable(g, e, prev!);
  interclrep(g, e);
  return e;
}

// ---------------------------------------------------------------------------
// class2 multi-edge / concentration handlers
// ---------------------------------------------------------------------------

function concentrateOrMerge(g: Graph, e: Edge, prev: Edge): void {
  // C: if (Concentrate) ED_edge_type(e) = IGNORED — unconditionally, with NO
  // ED_to_virt check. Only the non-concentrate merge_chain branch needs to_virt
  // (set by prev's make_chain). The port previously gated the whole call on
  // prev.to_virt, so adjacent parallel edges (no virtual chain) never got
  // IGNORED under concentrate. @see lib/dotgen/class2.c (merge multi-edges)
  if (dotRoot(g).info.concentrate ?? false) {
    e.info.edge_type = IGNORED;
  } else if (prev.info.to_virt !== undefined) {
    mergeChain(g, e, prev.info.to_virt, true);
    otherEdge(e);
  }
}

function handleMultiSameRank(e: Edge, prev: Edge): boolean {
  if ((e.tail.info.rank ?? 0) !== (e.head.info.rank ?? 0)) return false;
  mergeOneway(e, prev);
  otherEdge(e);
  return true;
}

function handleMultiParallel(g: Graph, e: Edge, prev: Edge): boolean {
  if (e.info.label !== undefined || prev.info.label !== undefined) return false;
  if (!portsEq(e, prev)) return false;
  concentrateOrMerge(g, e, prev);
  return true;
}

function handleMultiEdge(g: Graph, e: Edge, prev: Edge | undefined): boolean {
  if (!prev || e.tail !== prev.tail || e.head !== prev.head) return false;
  if (handleMultiSameRank(e, prev)) return true;
  return handleMultiParallel(g, e, prev);
}

// ---------------------------------------------------------------------------
// class2 back-edge handler
// ---------------------------------------------------------------------------

function oppEdgeConcOrMerge(g: Graph, e: Edge, opp: Edge): boolean {
  if (e.info.label !== undefined || opp.info.label !== undefined) return false;
  if (!portsEq(e, opp)) return false;
  if (dotRoot(g).info.concentrate ?? false) {
    e.info.edge_type = IGNORED;
    opp.info.conc_opp_flag = true;
  } else {
    otherEdge(e);
    mergeChain(g, e, opp.info.to_virt!, true);
  }
  return true;
}

function tryOppEdge(g: Graph, e: Edge, opp: Edge): boolean {
  if (opp.head !== e.tail) return false;
  if (opp.info.edge_type === IGNORED) return false;
  if (opp.info.to_virt === undefined) makeChain(g, opp.tail, opp.head, opp);
  return oppEdgeConcOrMerge(g, e, opp);
}

/**
 * Back edge: find the opposite forward edge and merge into it, else make a new
 * chain. The opposite is sought among the head's **original** out-edges
 * (`agfstout`), NOT the fast graph — a fast edge has no `to_virt`, so iterating
 * `ND_out` would re-trip `tryOppEdge`'s `makeChain` guard and duplicate the edge
 * for a 2-cycle. @see lib/dotgen/class2.c:259 (backward-edge block)
 */
function handleBackEdge(g: Graph, e: Edge): Edge | undefined {
  for (const opp of e.head.outEdges(g)) {
    if (tryOppEdge(g, e, opp)) return undefined;
  }
  makeChain(g, e.head, e.tail, e);
  return e;
}

// ---------------------------------------------------------------------------
// class2 node-edge loop
// ---------------------------------------------------------------------------

function class2EdgeSameRep(g: Graph, e: Edge): Edge | undefined {
  if (nodeRank(e.tail) === nodeRank(e.head)) { flatEdge(g, e); return e; }
  if (nodeRank(e.head) > nodeRank(e.tail)) { makeChain(g, e.tail, e.head, e); return e; }
  return handleBackEdge(g, e);
}

function class2OneEdge(
  g: Graph, e: Edge, prev: Edge | undefined,
): Edge | undefined {
  if (e.info.to_virt !== undefined) return e;
  if (isClusterEdge(e)) return handleClusterEdge(g, e, prev);
  if (handleMultiEdge(g, e, prev)) return prev;
  if (e.tail === e.head) { otherEdge(e); return e; }
  const t = ufFind(e.tail);
  const h = ufFind(e.head);
  if (e.tail !== t || e.head !== h) return prev;
  return class2EdgeSameRep(g, e);
}

function class2ProcessNodeEdges(g: Graph, oes: Edge[]): void {
  let prev: Edge | undefined;
  for (const e of oes) {
    const next = class2OneEdge(g, e, prev);
    prev = next !== undefined ? next : prev;
  }
}

function weightClass(n: Node): number { return n.info.weight_class ?? 0; }
function incrWeightClass(n: Node): void {
  if (weightClass(n) <= 2) n.info.weight_class = weightClass(n) + 1;
}

function class2WeightClasses(g: Graph): void {
  // weight_class counts incident edges per node (capped at 3); the count is
  // order-independent, so one pass over g.edges replaces the O(N·E) per-node
  // outEdges walk. Self-loops bump tail and head (same node) twice, as before.
  for (const e of g.edges) {
    incrWeightClass(e.head);
    incrWeightClass(e.tail);
  }
}

function class2ProcessNodes(g: Graph): void {
  // class2 reads original out-edges in sorted order (prev-chaining is order-
  // sensitive) but only writes the fast/virtual graph, never g.edges — so a
  // single out-edge index is safe and replaces O(N·E) outEdges calls.
  const outIdx = buildOutEdgeIndex(g);
  for (const n of nodesInSeq(g)) {
    if (n.info.clust === undefined && n === ufFind(n)) fastNode(g, n);
    class2ProcessNodeEdges(g, outIdx.get(n) ?? []);
  }
}

/**
 * Full edge classification pass for the dot layout engine.
 * @see lib/dotgen/class2.c:class2
 */
export function class2(g: Graph): void {
  g.info.nlist = undefined;
  markClusters(g);
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nClust; c++) buildSkeleton(g, g.info.clust![c - 1]);
  class2WeightClasses(g);
  class2ProcessNodes(g);
  if (g !== dotRoot(g)) g.info.comp = [g.info.nlist ?? (null as unknown as Node)];
}
