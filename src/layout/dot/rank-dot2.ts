// SPDX-License-Identifier: EPL-2.0
/** @see lib/dotgen/rank.c — dot2_rank pipeline */
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { Graph } from '../../model/graph.js';
import { Node as NodeClass } from '../../model/node.js';
import { Edge as EdgeClass } from '../../model/edge.js';
import {
  mapbool, scaleClamp, isACluster, edgelabelRanks,
  makeNewCluster, nodeInduce,
  MINRANK, SOURCERANK, MAXRANK, SINKRANK, SAMERANK,
} from './rank.js';
import { rank2 } from './ns.js';

// ---------------------------------------------------------------------------
// Constants  @see lib/dotgen/rank.c
// ---------------------------------------------------------------------------

const BACKWARD_PENALTY = 1000;
const STRONG_CLUSTER_WEIGHT = 1000;
const NORANK = 6;
const ROOT_NAME = '\x7froot';
const TOPNODE_NAME = '\x7ftop';
const BOTNODE_NAME = '\x7fbot';

/** Mutable state replacing C statics Last_node and id in weak(). */
export interface XgState { lastNode: Node | undefined; weakId: number; }

// ---------------------------------------------------------------------------
// Accessor helpers — extract ?? and ?. so callers stay within CCN ≤ 10
// ---------------------------------------------------------------------------

export function eMinlen(e: Edge): number { return e.info.minlen ?? 1; }
export function eWeight(e: Edge): number { return e.info.weight ?? 1; }
export function nRankOrZero(n: Node): number { return n.info.rank ?? 0; }
export function gMaxrankOrNeg(g: Graph): number { return g.info.maxrank ?? -1; }
export function gMinrankOrMax(g: Graph): number { return g.info.minrank ?? Number.MAX_SAFE_INTEGER; }
export function gHasParent(g: Graph): boolean { return g.info.parent !== undefined; }
export function gLevel(g: Graph): number { return g.info.level ?? 0; }
export function gParentOrSelf(g: Graph): Graph { return g.info.parent ?? g; }

// ---------------------------------------------------------------------------
// dot2 union-find (ND_set)
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:find */
export function d2find(n: Node): Node {
  let s = n.info.set;
  if (!s) { n.info.set = n; return n; }
  if (s !== n) s = n.info.set = d2find(s);
  return s;
}

/** @see lib/dotgen/rank.c:union_one */
export function d2unionOne(leader: Node, n: Node | undefined): Node {
  if (n) d2find(n).info.set = d2find(leader);
  return leader;
}

/** @see lib/dotgen/rank.c:union_all */
export function d2unionAll(g: Graph): Node | undefined {
  const first = g.nodes.values().next().value as Node | undefined;
  if (!first) return undefined;
  const leader = d2find(first);
  for (const n of g.nodes.values()) d2unionOne(leader, n);
  return leader;
}

// ---------------------------------------------------------------------------
// Xg graph construction helpers
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:makeXnode */
export function makeXnode(Xg: Graph, name: string, st: XgState): Node {
  const n = new NodeClass(Xg.nodes.size, name, Xg);
  n.info.in = { list: [], size: 0 };
  n.info.out = { list: [], size: 0 };
  if (st.lastNode) { n.info.prev = st.lastNode; st.lastNode.info.next = n; }
  else { n.info.prev = undefined; Xg.info.nlist = n; }
  st.lastNode = n; n.info.next = undefined;
  Xg.nodes.set(name, n);
  return n;
}

export function xgFindEdge(Xg: Graph, t: Node, h: Node): Edge | undefined {
  return Xg.edges.find(e => e.tail === t && e.head === h);
}

export function xgAddEdge(Xg: Graph, t: Node, h: Node): Edge {
  const e = new EdgeClass(t, h, ''); Xg.edges.push(e); return e;
}

export function xgDeleteEdge(Xg: Graph, e: Edge): void {
  const i = Xg.edges.indexOf(e);
  if (i >= 0) Xg.edges.splice(i, 1);
}

/** @see lib/dotgen/rank.c:merge */
export function xgMerge(e: Edge, minlen: number, weight: number): void {
  e.info.minlen = Math.max(eMinlen(e), minlen);
  e.info.weight = eWeight(e) + weight;
}

// ---------------------------------------------------------------------------
// compile_samerank helpers
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:rankset_kind */
export function csRanksetKind(g: Graph): number {
  const s = g.attrs.get('rank') ?? '';
  if (s === 'min') return MINRANK;
  if (s === 'source') return SOURCERANK;
  if (s === 'max') return MAXRANK;
  if (s === 'sink') return SINKRANK;
  if (s === 'same') return SAMERANK;
  return NORANK;
}

/** @see lib/dotgen/rank.c:set_parent + cluster setup in compile_samerank */
export function csSetupCluster(g: Graph, parentClust: Graph | undefined): Graph | undefined {
  if (isACluster(g)) {
    if (parentClust) {
      g.info.level = gLevel(parentClust) + 1;
      g.info.parent = parentClust;
      makeNewCluster(parentClust, g);
      nodeInduce(parentClust, g);
    } else { g.info.level = 0; }
    return g;
  }
  return parentClust;
}

export function csProcessClusterNodes(g: Graph): void {
  for (const n of g.nodes.values()) { if (!n.info.clust) n.info.clust = g; }
}

export function csProcessRankset(g: Graph, clust: Graph | undefined): void {
  const kind = csRanksetKind(g);
  if (kind === NORANK) return;
  const leader = d2unionAll(g);
  if (!leader || !clust) return;
  if (kind === MINRANK || kind === SOURCERANK) clust.info.minrep = d2unionOne(leader, clust.info.minrep);
  else if (kind === MAXRANK || kind === SINKRANK) clust.info.maxrep = d2unionOne(leader, clust.info.maxrep);
}

export function csCheckDegenerate(g: Graph): void {
  if (!isACluster(g) || !g.info.minrep) return;
  if (g.info.minrep !== g.info.maxrep) return;
  const up = d2unionAll(g);
  if (up) { g.info.minrep = up; g.info.maxrep = up; }
}

/** @see lib/dotgen/rank.c:compile_samerank */
export function compileSamerank(g: Graph, parentClust: Graph | undefined): void {
  if (g.nodes.size === 0) return;
  const clust = csSetupCluster(g, parentClust);
  for (const s of g.subgraphs.values()) compileSamerank(s, clust);
  if (isACluster(g)) csProcessClusterNodes(g);
  csProcessRankset(g, clust);
  csCheckDegenerate(g);
}

// ---------------------------------------------------------------------------
// compile_nodes
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:compile_nodes */
export function compileNodes(g: Graph, Xg: Graph, st: XgState): void {
  st.lastNode = undefined;
  for (const n of g.nodes.values()) {
    if (d2find(n) === n) n.info.rep = makeXnode(Xg, n.name, st);
  }
  for (const n of g.nodes.values()) {
    if (!n.info.rep) n.info.rep = d2find(n).info.rep;
  }
}

// ---------------------------------------------------------------------------
// compile_edges helpers
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:strong */
export function xgStrong(Xg: Graph, t: Node, h: Node, orig: Edge): void {
  const e = xgFindEdge(Xg, t, h) ?? xgFindEdge(Xg, h, t) ?? xgAddEdge(Xg, t, h);
  xgMerge(e, eMinlen(orig), eWeight(orig));
}

/** @see lib/dotgen/rank.c:weak — find existing weak diamond v→t, v→h */
export function xgWeakExists(Xg: Graph, t: Node, h: Node): boolean {
  for (const e of Xg.edges) {
    if (e.head !== t) continue;
    const v = e.tail;
    for (const f of Xg.edges) { if (f.tail === v && f.head === h) return true; }
  }
  return false;
}

export function xgWeakSetWeights(e: Edge, f: Edge, origW: number, origML: number): void {
  e.info.minlen = Math.max(eMinlen(e), 0);
  e.info.weight = eWeight(e) + origW * BACKWARD_PENALTY - 1;
  f.info.minlen = Math.max(eMinlen(f), origML);
  f.info.weight = eWeight(f) + origW - 1;
}

/** @see lib/dotgen/rank.c:weak */
export function xgWeak(Xg: Graph, t: Node, h: Node, orig: Edge, st: XgState): void {
  if (xgWeakExists(Xg, t, h)) return;
  const v = makeXnode(Xg, `_weak_${st.weakId++}`, st);
  xgWeakSetWeights(xgAddEdge(Xg, v, t), xgAddEdge(Xg, v, h), eWeight(orig), eMinlen(orig));
}

/** @see lib/dotgen/rank.c:is_nonconstraint */
export function isNonConstraint(e: Edge): boolean {
  const v = e.attrs.get('constraint');
  if (!v) return false;
  return !mapbool(v);
}

/** @see lib/dotgen/rank.c:is_a_strong_cluster */
export function isAStrongCluster(g: Graph): boolean {
  return mapbool(g.attrs.get('compact') ?? '');
}

/** @see lib/dotgen/rank.c:dot_lca */
export function dotLca(c0: Graph, c1: Graph): Graph {
  let a = c0; let b = c1;
  while (a !== b) {
    if (gLevel(a) >= gLevel(b)) a = gParentOrSelf(a);
    else b = gParentOrSelf(b);
  }
  return a;
}

/** @see lib/dotgen/rank.c:is_internal_to_cluster */
export function isInternalToCluster(e: Edge): boolean {
  const ct = e.tail.info.clust; const ch = e.head.info.clust;
  if (ct === ch) return true;
  if (!ct || !ch) return false;
  const par = dotLca(ct, ch);
  return par === ct || par === ch;
}

/** Returns true if edge direction should be swapped for internal cluster. */
export function ceShouldSwap(e: Edge, tc: Graph | undefined, hc: Graph | undefined): boolean {
  const tRep = tc ? d2find(e.tail) : undefined;
  const hRep = hc ? d2find(e.head) : undefined;
  return (tc !== undefined && tRep === tc.info.maxrep) ||
         (hc !== undefined && hRep === hc.info.minrep);
}

export function ceInternal(Xg: Graph, e: Edge, Xt: Node, Xh: Node): void {
  const tc = e.tail.info.clust; const hc = e.head.info.clust;
  let xt = Xt; let xh = Xh;
  if (ceShouldSwap(e, tc, hc)) { const tmp = xt; xt = xh; xh = tmp; }
  xgStrong(Xg, xt, xh, e);
}

/** @see lib/dotgen/rank.c:compile_edges inner body */
export function compileEdgeItem(Xg: Graph, e: Edge, Xt: Node, st: XgState): void {
  if (isNonConstraint(e)) return;
  const Xh = d2find(e.head).info.rep;
  if (!Xh || Xt === Xh) return;
  if (isInternalToCluster(e)) { ceInternal(Xg, e, Xt, Xh); return; }
  const tc = e.tail.info.clust; const hc = e.head.info.clust;
  if ((tc && isAStrongCluster(tc)) || (hc && isAStrongCluster(hc))) xgWeak(Xg, Xt, Xh, e, st);
  else xgStrong(Xg, Xt, Xh, e);
}

/** @see lib/dotgen/rank.c:compile_edges */
export function compileEdges(g: Graph, Xg: Graph, st: XgState): void {
  for (const n of g.nodes.values()) {
    const Xt = n.info.rep;
    if (!Xt) continue;
    for (const e of n.outEdges(g)) compileEdgeItem(Xg, e, Xt, st);
  }
}

// ---------------------------------------------------------------------------
// compile_clusters helpers
// ---------------------------------------------------------------------------

interface ClusterBounds { top: Node | undefined; bot: Node | undefined; }

export function ccProcessNode(g: Graph, Xg: Graph, st: XgState, n: Node, b: ClusterBounds): void {
  const rep = d2find(n).info.rep;
  if (!rep) return;
  if (n.inEdges(g).length === 0) {
    if (!b.top) b.top = makeXnode(Xg, TOPNODE_NAME, st);
    xgAddEdge(Xg, b.top, rep);
  }
  if (n.outEdges(g).length === 0) {
    if (!b.bot) b.bot = makeXnode(Xg, BOTNODE_NAME, st);
    xgAddEdge(Xg, rep, b.bot);
  }
}

export function ccStrongCluster(
  g: Graph, Xg: Graph, st: XgState, top: Node | undefined, bot: Node | undefined
): ClusterBounds {
  const b: ClusterBounds = { top, bot };
  for (const n of g.nodes.values()) ccProcessNode(g, Xg, st, n, b);
  if (b.top && b.bot) xgMerge(xgAddEdge(Xg, b.top, b.bot), 0, STRONG_CLUSTER_WEIGHT);
  return b;
}

/** @see lib/dotgen/rank.c:compile_clusters */
export function compileClusters(
  g: Graph, Xg: Graph, st: XgState, top: Node | undefined, bot: Node | undefined
): void {
  let t = top; let b = bot;
  if (isACluster(g) && isAStrongCluster(g)) {
    const bounds = ccStrongCluster(g, Xg, st, t, b);
    t = bounds.top; b = bounds.bot;
  }
  for (const sub of g.subgraphs.values()) compileClusters(sub, Xg, st, t, b);
}

// ---------------------------------------------------------------------------
// break_cycles (iterative DFS)
// ---------------------------------------------------------------------------

export function reverseEdge2(Xg: Graph, e: Edge): void {
  const rev = xgFindEdge(Xg, e.head, e.tail) ?? xgAddEdge(Xg, e.head, e.tail);
  xgMerge(rev, eMinlen(e), eWeight(e));
  xgDeleteEdge(Xg, e);
}

interface DfsFrame { v: Node; edges: Edge[]; i: number; }

export function dfsNode(Xg: Graph, v: Node, frames: DfsFrame[]): void {
  if (v.info.mark) return;
  v.info.mark = 1; v.info.onstack = 1;
  frames.push({ v, edges: v.outEdges(Xg).slice(), i: 0 });
}

export function dfsStep(Xg: Graph, frames: DfsFrame[]): void {
  const fr = frames[frames.length - 1];
  if (fr.i < fr.edges.length) {
    const e = fr.edges[fr.i++];
    if (e.head.info.onstack) reverseEdge2(Xg, e);
    else if (!e.head.info.mark) dfsNode(Xg, e.head, frames);
  } else { fr.v.info.onstack = 0; frames.pop(); }
}

/** @see lib/dotgen/rank.c:break_cycles */
export function breakCycles(Xg: Graph): void {
  for (const n of Xg.nodes.values()) { n.info.mark = 0; n.info.onstack = 0; }
  for (const n of Xg.nodes.values()) {
    if (n.info.mark) continue;
    const frames: DfsFrame[] = [];
    dfsNode(Xg, n, frames);
    while (frames.length > 0) dfsStep(Xg, frames);
  }
}

// ---------------------------------------------------------------------------
// connect_components
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:dfscc (iterative) */
export function dfsccNode(Xg: Graph, start: Node, cc: number): void {
  const stack: Node[] = [start];
  start.info.hops = cc;
  while (stack.length > 0) {
    const v = stack.pop()!;
    for (const e of v.outEdges(Xg)) {
      if (!e.head.info.hops) { e.head.info.hops = cc; stack.push(e.head); }
    }
    for (const e of Xg.edges) {
      if (e.head === v && !e.tail.info.hops) { e.tail.info.hops = cc; stack.push(e.tail); }
    }
  }
}

/** @see lib/dotgen/rank.c:connect_components */
export function connectComponents(Xg: Graph, st: XgState): number {
  for (const n of Xg.nodes.values()) n.info.hops = 0;
  let cc = 0;
  for (const n of Xg.nodes.values()) { if (!n.info.hops) dfsccNode(Xg, n, ++cc); }
  if (cc > 1) {
    const root = makeXnode(Xg, ROOT_NAME, st);
    let ncc = 1;
    for (const n of Xg.nodes.values()) {
      if (n.info.hops === ncc) { xgAddEdge(Xg, root, n); ncc++; }
    }
  }
  return cc;
}

// ---------------------------------------------------------------------------
// add_fast_edges / setMinMax2 / readout_levels
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:add_fast_edges */
export function addFastEdges(Xg: Graph): void {
  for (const e of Xg.edges) {
    if (!e.tail.info.out) e.tail.info.out = { list: [], size: 0 };
    e.tail.info.out.list[e.tail.info.out.size++] = e;
    if (!e.head.info.in) e.head.info.in = { list: [], size: 0 };
    e.head.info.in.list[e.head.info.in.size++] = e;
  }
}

export function setMinMax2Clusters(g: Graph): void {
  const nc = g.info.n_cluster ?? 0;
  const cl = g.info.clust ?? [];
  for (let c = 1; c <= nc; c++) setMinMax2(cl[c - 1], false);
}

export function setMinMax2ScanNode(g: Graph, n: Node, ref: { v: Node | undefined }): void {
  const v = nRankOrZero(n);
  if (gMaxrankOrNeg(g) < v) g.info.maxrank = v;
  if (gMinrankOrMax(g) > v) { g.info.minrank = v; ref.v = n; }
}

/** @see lib/dotgen/rank.c:setMinMax */
export function setMinMax2(g: Graph, doRoot: boolean): void {
  setMinMax2Clusters(g);
  if (!gHasParent(g) && !doRoot) return;
  g.info.minrank = Number.MAX_SAFE_INTEGER; g.info.maxrank = -1;
  const ref: { v: Node | undefined } = { v: undefined };
  for (const n of g.nodes.values()) setMinMax2ScanNode(g, n, ref);
  g.info.leader = ref.v;
}

export function readoutCopyRank(g: Graph, n: Node): void {
  n.info.rank = nRankOrZero(d2find(n).info.rep!);
  if (gMaxrankOrNeg(g) < nRankOrZero(n)) g.info.maxrank = n.info.rank;
  if (gMinrankOrMax(g) > nRankOrZero(n)) g.info.minrank = n.info.rank;
}

export function readoutUpdateMinrk(n: Node, xn: Node, minrk: number[]): void {
  n.info.hops = xn.info.hops ?? 0;
  const r = nRankOrZero(n);
  if (minrk[n.info.hops] > r) minrk[n.info.hops] = r;
}

export function readoutApplyMinrk(g: Graph, minrk: number[]): void {
  for (const n of g.nodes.values()) n.info.rank = nRankOrZero(n) - minrk[n.info.hops ?? 0];
}

export function readoutShiftAll(g: Graph, delta: number): void {
  for (const n of g.nodes.values()) n.info.rank = nRankOrZero(n) - delta;
}

export function readoutScanNodes(g: Graph, minrk: number[] | undefined): void {
  for (const n of g.nodes.values()) {
    readoutCopyRank(g, n);
    if (minrk) readoutUpdateMinrk(n, d2find(n).info.rep!, minrk);
  }
}

export function readoutNormalize(g: Graph, minrk: number[] | undefined): boolean {
  if (minrk) { readoutApplyMinrk(g, minrk); return true; }
  const delta = gMinrankOrMax(g) === Number.MAX_SAFE_INTEGER ? 0 : (g.info.minrank ?? 0);
  if (delta > 0) {
    readoutShiftAll(g, delta);
    g.info.minrank = 0;
    g.info.maxrank = gMaxrankOrNeg(g) - delta;
  }
  return false;
}

/** @see lib/dotgen/rank.c:readout_levels */
export function readoutLevels(g: Graph, Xg: Graph, ncc: number): void {
  g.info.minrank = Number.MAX_SAFE_INTEGER; g.info.maxrank = -1;
  const minrk = ncc > 1 ? new Array<number>(ncc + 1).fill(Number.MAX_SAFE_INTEGER) : undefined;
  readoutScanNodes(g, minrk);
  const doRoot = readoutNormalize(g, minrk);
  setMinMax2(g, doRoot);
  for (const n of Xg.nodes.values()) { n.info.in = undefined; n.info.out = undefined; }
}

// ---------------------------------------------------------------------------
// dot2Rank — main entry point
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:dot2_rank */
export function dot2Rank(g: Graph): void {
  const st: XgState = { lastNode: undefined, weakId: 0 };
  const Xg = new Graph('level assignment constraints', 'strict-directed');
  edgelabelRanks(g);
  const nslimit1 = g.attrs.get('nslimit1');
  const maxiter = nslimit1
    ? scaleClamp(g.nodes.size, parseFloat(nslimit1))
    : Number.MAX_SAFE_INTEGER;
  const ssStr = g.attrs.get('searchsize');
  const ssize = ssStr ? parseInt(ssStr, 10) : -1;
  compileSamerank(g, undefined);
  compileNodes(g, Xg, st);
  compileEdges(g, Xg, st);
  compileClusters(g, Xg, st, undefined, undefined);
  breakCycles(Xg);
  const ncc = connectComponents(Xg, st);
  addFastEdges(Xg);
  rank2(Xg, 1, maxiter, ssize);
  readoutLevels(g, Xg, ncc);
}
