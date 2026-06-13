// SPDX-License-Identifier: EPL-2.0

/**
 * Slot manipulation, path mapping, and inter-cluster chain building
 * for the dot cluster expansion phase.
 *
 * @see lib/dotgen/cluster.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import {
  VIRTUAL, NORMAL,
  virtualNode,
  virtualEdge, deleteFastEdge, findFastEdge,
  mergeOneway,
} from './fastgr.js';
import { dotRoot } from './mincross-utils.js';

/** @see lib/dotgen/cluster.c:CLUSTER_EDGE */
export const CLUSTER_EDGE = 5;

// ---------------------------------------------------------------------------
// map_interclust_node — @see lib/dotgen/cluster.c:map_interclust_node
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:map_interclust_node */
export function mapInterclustNode(n: Node): Node {
  const clust = n.info.clust;
  if (clust === undefined || clust.info.expanded) return n;
  return clust.info.rankleader![n.info.rank ?? 0];
}

// ---------------------------------------------------------------------------
// make_slots — @see lib/dotgen/cluster.c:make_slots
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:make_slots (contract branch) */
export function makeSlotsContract(root: Graph, r: number, pos: number, d: number): void {
  const rk = root.info.rank![r];
  for (let i = pos - d + 1; i < rk.n; i++) {
    const v = rk.v[i];
    v.info.order = i + d - 1;
    rk.v[v.info.order!] = v;
  }
  for (let i = rk.n + d - 1; i < rk.n; i++) rk.v[i] = null as unknown as Node;
}

/** @see lib/dotgen/cluster.c:make_slots (expand branch) */
export function makeSlotsExpand(root: Graph, r: number, pos: number, d: number): void {
  const rk = root.info.rank![r];
  for (let i = rk.n - 1; i > pos; i--) {
    const v = rk.v[i];
    v.info.order = i + d - 1;
    rk.v[v.info.order!] = v;
  }
  for (let i = pos + 1; i < pos + d; i++) rk.v[i] = null as unknown as Node;
}

/** @see lib/dotgen/cluster.c:make_slots */
export function makeSlots(root: Graph, r: number, pos: number, d: number): void {
  if (d <= 0) makeSlotsContract(root, r, pos, d);
  else makeSlotsExpand(root, r, pos, d);
  root.info.rank![r].n += d - 1;
}

// ---------------------------------------------------------------------------
// clone_vn — @see lib/dotgen/cluster.c:clone_vn
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:clone_vn */
export function cloneVn(g: Graph, vn: Node): Node {
  const r = vn.info.rank ?? 0;
  makeSlots(g, r, vn.info.order!, 2);
  const rv = virtualNode(g);
  rv.info.lw = vn.info.lw;
  rv.info.rw = vn.info.rw;
  rv.info.rank = r;
  rv.info.order = (vn.info.order ?? 0) + 1;
  g.info.rank![r].v[rv.info.order] = rv;
  return rv;
}

// ---------------------------------------------------------------------------
// safe_other_edge — @see lib/dotgen/cluster.c:safe_other_edge
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:safe_other_edge */
export function safeOtherEdge(e: Edge): void {
  if (!e.tail.info.other) e.tail.info.other = { list: [], size: 0 };
  const other = e.tail.info.other;
  for (let i = 0; i < other.size; i++) if (other.list[i] === e) return;
  other.list[other.size++] = e;
}

// ---------------------------------------------------------------------------
// map_path helpers — @see lib/dotgen/cluster.c:map_path
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:ports_eq (simplified) */
export function portsEqSimple(orig: Edge, e: Edge): boolean {
  const hp = orig.info.head_port;
  const tp = orig.info.tail_port;
  const ehp = e.info.head_port;
  const etp = e.info.tail_port;
  return hp.defined === ehp.defined
    && tp.defined === etp.defined
    && (!hp.defined || (hp.p.x === ehp.p.x && hp.p.y === ehp.p.y))
    && (!tp.defined || (tp.p.x === etp.p.x && tp.p.y === etp.p.y));
}

/** @see lib/dotgen/cluster.c:map_path (multi-edge adjacent span) */
export function mapPathAdjacentMulti(from: Node, to: Node, orig: Edge, ve: Edge, type: number): void {
  const root = dotRoot(from.root);
  let u = from;
  for (let r = (from.info.rank ?? 0); r < (to.info.rank ?? 0); r++) {
    const v = r < (to.info.rank ?? 0) - 1 ? cloneVn(root, ve.head) : to;
    const e = virtualEdge(u, v, orig);
    e.info.edge_type = type;
    u = v;
    ve.info.count = (ve.info.count ?? 1) - 1;
    ve = ve.head.info.out!.list[0];
  }
}

/** @see lib/dotgen/cluster.c:map_path (single adjacent span) */
export function mapPathAdjacentSingle(from: Node, to: Node, orig: Edge, ve: Edge, type: number): void {
  const existing = findFastEdge(from, to);
  if (existing !== undefined && portsEqSimple(orig, existing)) {
    orig.info.to_virt = existing;
    existing.info.edge_type = type;
    existing.info.count = (existing.info.count ?? 1) + 1;
    if (from.info.node_type === NORMAL && to.info.node_type === NORMAL)
      safeOtherEdge(orig);
  } else {
    orig.info.to_virt = undefined;
    const e = virtualEdge(from, to, orig);
    e.info.edge_type = type;
    ve.info.count = (ve.info.count ?? 1) - 1;
  }
}

/** @see lib/dotgen/cluster.c:map_path (single long span) */
export function mapPathLongSingle(from: Node, to: Node, orig: Edge, ve: Edge, type: number): void {
  let e: Edge;
  if (ve.tail !== from) {
    orig.info.to_virt = undefined;
    e = orig.info.to_virt = virtualEdge(from, ve.head, orig);
    deleteFastEdge(ve);
  } else {
    e = ve;
  }
  while ((e.head.info.rank ?? 0) !== (to.info.rank ?? 0))
    e = e.head.info.out!.list[0];
  if (e.head !== to) {
    const old = e;
    e = virtualEdge(e.tail, to, orig);
    e.info.edge_type = type;
    deleteFastEdge(old);
  }
}

/** @see lib/dotgen/cluster.c:map_path (cnt > 1 branch) */
export function mapPathMultiEdge(from: Node, to: Node, orig: Edge, ve: Edge, type: number): void {
  orig.info.to_virt = undefined;
  const span = (to.info.rank ?? 0) - (from.info.rank ?? 0);
  if (span === 1) {
    const ex = findFastEdge(from, to);
    if (ex !== undefined && portsEqSimple(orig, ex)) {
      mergeOneway(orig, ex);
      if (from.info.node_type === NORMAL && to.info.node_type === NORMAL)
        safeOtherEdge(orig);
      return;
    }
  }
  mapPathAdjacentMulti(from, to, orig, ve, type);
}

/** @see lib/dotgen/cluster.c:map_path */
export function mapPath(from: Node, to: Node, orig: Edge, ve: Edge, type: number): void {
  if (ve.tail === from && ve.head === to) return;
  const span = (to.info.rank ?? 0) - (from.info.rank ?? 0);
  const cnt = ve.info.count ?? 1;
  if (cnt > 1) mapPathMultiEdge(from, to, orig, ve, type);
  else if (span === 1) mapPathAdjacentSingle(from, to, orig, ve, type);
  else mapPathLongSingle(from, to, orig, ve, type);
}

// ---------------------------------------------------------------------------
// make_interclust_chain — @see lib/dotgen/cluster.c:make_interclust_chain
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:make_interclust_chain */
export function makeInterclustChain(from: Node, to: Node, orig: Edge): void {
  const u = mapInterclustNode(from);
  const v = mapInterclustNode(to);
  const type = u === from && v === to ? VIRTUAL : CLUSTER_EDGE;
  mapPath(u, v, orig, orig.info.to_virt!, type);
}
