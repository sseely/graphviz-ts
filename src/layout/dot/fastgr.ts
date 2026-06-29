// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/fastgr.c.
 *
 * Maintains the "fast graph" — compact mutation-friendly adjacency lists
 * layered on top of the cgraph model, used during cycle-breaking and
 * virtual-node construction.
 *
 * @see lib/dotgen/fastgr.c
 */

import type { Node } from '../../model/node.js';
import { Node as NodeClass } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { Edge as EdgeClass } from '../../model/edge.js';
import type { Port } from '../../model/geom.js';
import type { EdgeList } from '../../model/nodeInfo.js';
import type { Graph } from '../../model/graph.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Virtual edge type. @see lib/common/types.h */
export const VIRTUAL = 1;

/** Normal edge type. @see lib/common/types.h */
export const NORMAL = 0;

/** Flat ordering constraint edge type. @see lib/common/const.h */
export const FLATORDER = 4;

/** Reversed flat edge type. @see lib/common/const.h */
export const REVERSED = 3;

/** Scale factor for median computation. @see lib/dotgen/mincross.c:MC_SCALE */
export const MC_SCALE = 256;

// ---------------------------------------------------------------------------
// EdgeList helpers  (Group A starts here)
// ---------------------------------------------------------------------------

/**
 * Return el if defined, otherwise a fresh empty EdgeList.
 * @see lib/dotgen/fastgr.c (implicit in elist operations)
 */
export function ensureList(el: EdgeList | undefined): EdgeList {
  if (el !== undefined) return el;
  return { list: [], size: 0 };
}

/**
 * Append edge `e` to list — `L.list[L.size++] = e`.
 * @see lib/dotgen/fastgr.c:elistAppend
 */
export function elistAppend(el: EdgeList, e: Edge): void {
  el.list[el.size++] = e;
}

/**
 * Swap-last-remove of edge `e` from `el`.
 * Uses while+&& to scan, then a single conditional swap.
 * @see lib/dotgen/fastgr.c:zapinlist
 */
export function zapinlist(el: EdgeList, e: Edge): void {
  let i = 0;
  while (i < el.size && el.list[i] !== e) i++;
  // Match C: L->list[L->size] = NULL after swap — callers poll list[0] as sentinel.
  if (i < el.size) { el.list[i] = el.list[--el.size]; el.list[el.size] = undefined as unknown as typeof e; }
}

// ---------------------------------------------------------------------------
// Fast-graph edge operations  (Group B — fresh after zapinlist reset)
// ---------------------------------------------------------------------------

/**
 * Remove `e` from the fast graph (tail.out and head.in).
 * @see lib/dotgen/fastgr.c:deleteFastEdge
 */
export function deleteFastEdge(e: Edge): void {
  if (e.tail.info.out) zapinlist(e.tail.info.out, e);
  if (e.head.info.in) zapinlist(e.head.info.in, e);
}

/**
 * Add `e` to the fast graph (tail.out and head.in).
 * @see lib/dotgen/fastgr.c:fastEdge
 */
export function fastEdge(e: Edge): void {
  if (!e.tail.info.out) e.tail.info.out = { list: [], size: 0 };
  if (!e.head.info.in) e.head.info.in = { list: [], size: 0 };
  elistAppend(e.tail.info.out, e);
  elistAppend(e.head.info.in, e);
}

// ---------------------------------------------------------------------------
// Find fast edge  (Group C — single-function reset after Group B)
// ---------------------------------------------------------------------------

/**
 * Search for an existing fast edge from `u` to `v`.
 * Inlines the static `ffe` helper from C: searches the smaller list.
 * @see lib/dotgen/fastgr.c:findFastEdge
 * @see lib/dotgen/fastgr.c:ffe
 */
export function findFastEdge(u: Node, v: Node): Edge | undefined {
  const uOut = u.info.out;
  const vIn = v.info.in;
  if (uOut === undefined || vIn === undefined) return undefined;
  if (uOut.size <= vIn.size) {
    for (let i = 0; i < uOut.size; i++) {
      if (uOut.list[i].head === v) return uOut.list[i];
    }
  } else {
    for (let i = 0; i < vIn.size; i++) {
      if (vIn.list[i].tail === u) return vIn.list[i];
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Virtual edge construction  (Group D — fresh after findFastEdge reset)
// ---------------------------------------------------------------------------

export function copyPort(p: Port): Port {
  const bp = p.bp !== null ? { ll: { x: p.bp.ll.x, y: p.bp.ll.y }, ur: { x: p.bp.ur.x, y: p.bp.ur.y } } : null;
  return { p: { x: p.p.x, y: p.p.y }, theta: p.theta, bp, defined: p.defined, constrained: p.constrained, clip: p.clip, dyna: p.dyna, order: p.order, side: p.side, name: p.name };
}

/**
 * Port copy is direction-aware: a reversed virtual edge takes the
 * orig's opposite-end port.
 * @see lib/dotgen/fastgr.c:new_virtual_edge
 */
export function copyVirtualPorts(e: Edge, orig: Edge): void {
  if (e.tail === orig.tail) e.info.tail_port = copyPort(orig.info.tail_port);
  else if (e.tail === orig.head) e.info.tail_port = copyPort(orig.info.head_port);
  if (e.head === orig.head) e.info.head_port = copyPort(orig.info.head_port);
  else if (e.head === orig.tail) e.info.head_port = copyPort(orig.info.tail_port);
}

/** Copy weights, ports, and labels from orig; link to_virt/to_orig. */
export function copyVirtualEdgeInfo(e: Edge, orig: Edge): void {
  e.info.count = orig.info.count;
  e.info.xpenalty = orig.info.xpenalty;
  e.info.weight = orig.info.weight;
  e.info.minlen = orig.info.minlen;
  copyVirtualPorts(e, orig);
  e.info.label = orig.info.label;
  e.info.head_label = orig.info.head_label;
  e.info.tail_label = orig.info.tail_label;
  e.info.xlabel = orig.info.xlabel;
  if (orig.info.to_virt === undefined) orig.info.to_virt = e;
  e.info.to_orig = orig;
  // C: AGSEQ(e) = AGSEQ(orig) — the virtual edge inherits the original's
  // sequence number so AGSEQ-keyed sorts (e.g. do_ordering_node's edgeidcmpf)
  // order by DOT-declaration order rather than virtual-creation order.
  // @see lib/dotgen/fastgr.c:new_virtual_edge
  e.seq = orig.seq;
}

/**
 * Allocate a virtual edge from `u` to `v`, copying port/label info from `orig`.
 * `orig` may be null when called from do_ordering_node (C passes NULL there).
 * @see lib/dotgen/fastgr.c:new_virtual_edge
 */
export function newVirtualEdge(u: Node, v: Node, orig: Edge | null): Edge {
  const e = new EdgeClass(u, v, '');
  e.info.edge_type = VIRTUAL;
  if (orig) {
    copyVirtualEdgeInfo(e, orig);
  } else {
    e.info.weight = 1;
    e.info.xpenalty = 1;
    e.info.count = 1;
    e.info.minlen = 1;
  }
  return e;
}

/**
 * Create a virtual edge and register it in the fast graph.
 * @see lib/dotgen/fastgr.c:virtualEdge
 */
export function virtualEdge(u: Node, v: Node, orig: Edge): Edge {
  const e = newVirtualEdge(u, v, orig);
  fastEdge(e);
  return e;
}

// ---------------------------------------------------------------------------
// Edge merging (concentration)
// ---------------------------------------------------------------------------

export function mergeWeightsInto(f: Edge, ew: number, em: number, ex: number): void {
  f.info.weight = (f.info.weight ?? 0) + ew;
  f.info.minlen = Math.max(f.info.minlen ?? 1, em);
  f.info.count = (f.info.count ?? 1) + 1;
  f.info.xpenalty = (f.info.xpenalty ?? 0) + ex;
}

export function basicMerge(e: Edge, rep: Edge): void {
  const ew = e.info.weight ?? 1;
  const em = e.info.minlen ?? 1;
  const ex = e.info.xpenalty ?? 0;
  for (let f: Edge | undefined = rep; f !== undefined; f = f.info.to_virt) {
    mergeWeightsInto(f, ew, em, ex);
  }
}

/**
 * Merge edge `e` into representative `rep`, accumulating weights.
 * @see lib/dotgen/fastgr.c:mergeOneway
 */
export function mergeOneway(e: Edge, rep: Edge): void {
  if (e.info.to_virt !== undefined) return;
  e.info.to_virt = rep;
  basicMerge(e, rep);
}

// ---------------------------------------------------------------------------
// Flat-graph edge operations  (Group E — mirrors Group B for flat edges)
// ---------------------------------------------------------------------------

/**
 * Remove `e` from the flat graph (tail.flat_out and head.flat_in).
 * Also clears `e.info.to_virt` back-reference.
 * @see lib/dotgen/fastgr.c:delete_flat_edge
 */
export function deleteFlatEdge(e: Edge): void {
  e.info.to_virt = undefined;
  if (e.tail.info.flat_out) zapinlist(e.tail.info.flat_out, e);
  if (e.head.info.flat_in) zapinlist(e.head.info.flat_in, e);
}

/**
 * Add `e` to the flat graph (tail.flat_out and head.flat_in) and mark the
 * graph as having flat edges.
 * @see lib/dotgen/fastgr.c:flat_edge
 */
export function flatEdge(g: import('../../model/graph.js').Graph, e: Edge): void {
  if (!e.tail.info.flat_out) e.tail.info.flat_out = { list: [], size: 0 };
  if (!e.head.info.flat_in) e.head.info.flat_in = { list: [], size: 0 };
  elistAppend(e.tail.info.flat_out, e);
  elistAppend(e.head.info.flat_in, e);
  g.info.has_flat_edges = true;
}

/**
 * Search for an existing flat edge from `u` to `v`.
 * @see lib/dotgen/fastgr.c:find_flat_edge
 */
export function findFlatEdge(u: import('../../model/node.js').Node, v: import('../../model/node.js').Node): Edge | undefined {
  const uOut = u.info.flat_out;
  const vIn = v.info.flat_in;
  if (uOut === undefined || vIn === undefined) return undefined;
  if (uOut.size <= vIn.size) {
    for (let i = 0; i < uOut.size; i++) {
      if (uOut.list[i].head === v) return uOut.list[i];
    }
  } else {
    for (let i = 0; i < vIn.size; i++) {
      if (vIn.list[i].tail === u) return vIn.list[i];
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Cycle-breaking
// ---------------------------------------------------------------------------

/**
 * Reverse edge `e`: remove from fast graph, then merge into or create a
 * reverse virtual edge. Sets `e.info.reversed` for dot_splines orientation.
 * @see lib/dotgen/acyclic.c:reverse_edge
 */
export function reverseEdge(e: Edge): void {
  deleteFastEdge(e);
  e.info.reversed = true;
  const f = findFastEdge(e.head, e.tail);
  if (f !== undefined) {
    mergeOneway(e, f);
  } else {
    virtualEdge(e.head, e.tail, e);
  }
}

// ---------------------------------------------------------------------------
// Fast-graph node operations
// ---------------------------------------------------------------------------

/**
 * Add node `n` to graph `g`'s fast-graph linked list (nlist).
 * @see lib/dotgen/fastgr.c:fast_node
 */
export function fastNode(g: Graph, n: Node): void {
  n.info.next = g.info.nlist;
  if (g.info.nlist !== undefined) g.info.nlist.info.prev = n;
  n.info.prev = undefined;
  g.info.nlist = n;
}

/**
 * Remove node `n` from graph `g`'s fast-graph linked list.
 * @see lib/dotgen/fastgr.c:delete_fast_node
 */
export function deleteFastNode(g: Graph, n: Node): void {
  if (n.info.prev !== undefined) n.info.prev.info.next = n.info.next;
  else g.info.nlist = n.info.next;
  if (n.info.next !== undefined) n.info.next.info.prev = n.info.prev;
}

/**
 * Remove node `n` from its rank's ordered node list `v[]`, shifting later
 * entries down one and decrementing the rank's count. The structural inverse
 * of install_in_rank / placeInRankSlot.
 *
 * Faithful to the C: the scan starts at index 0 (not vStart). For the common
 * single-component case vStart is 0/undefined, matching C's index-from-0 scan.
 * @see lib/dotgen/dotinit.c:remove_from_rank
 */
export function removeFromRank(g: Graph, n: Node): void {
  const r = n.info.rank !== undefined ? n.info.rank : 0;
  const rank = g.info.rank;
  if (rank === undefined) return;
  const rk = rank[r];
  for (let j = 0; j < rk.n; j++) {
    const v = rk.v[j];
    if (v === n) {
      for (j++; j < rk.n; j++) {
        rk.v[j - 1] = rk.v[j];
      }
      rk.n--;
      break;
    }
  }
}

/**
 * Allocate a virtual (VIRTUAL node_type) node, add it to `g`'s fast graph
 * with pre-allocated in/out edge lists of capacity 4.
 * @see lib/dotgen/fastgr.c:virtual_node
 */
export function virtualNode(g: Graph): Node {
  const n = new NodeClass(0, '', g);
  n.info.node_type = VIRTUAL;
  // C: ND_lw(n) = ND_rw(n) = 1; ND_ht(n) = 1; ND_UF_size(n) = 1
  // @see lib/dotgen/fastgr.c:virtual_node
  n.info.lw = 1;
  n.info.rw = 1;
  n.info.ht = 1;
  n.info.UF_size = 1;
  n.info.in = { list: [], size: 0 };
  n.info.out = { list: [], size: 0 };
  fastNode(g, n);
  return n;
}

/**
 * Append edge `e` to the `other` list of its tail node.
 * @see lib/dotgen/fastgr.c:other_edge
 */
export function otherEdge(e: Edge): void {
  if (!e.tail.info.other) e.tail.info.other = { list: [], size: 0 };
  elistAppend(e.tail.info.other, e);
}
