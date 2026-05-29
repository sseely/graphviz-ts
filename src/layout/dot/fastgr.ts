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
import type { Edge } from '../../model/edge.js';
import { Edge as EdgeClass } from '../../model/edge.js';
import type { Port } from '../../model/geom.js';
import type { EdgeList } from '../../model/nodeInfo.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Virtual edge type. @see lib/common/types.h */
export const VIRTUAL = 1;

/** Normal edge type. @see lib/common/types.h */
export const NORMAL = 0;

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
  if (i < el.size) el.list[i] = el.list[--el.size];
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

function copyPort(p: Port): Port {
  const bp = p.bp !== null ? { ll: { x: p.bp.ll.x, y: p.bp.ll.y }, ur: { x: p.bp.ur.x, y: p.bp.ur.y } } : null;
  return { p: { x: p.p.x, y: p.p.y }, theta: p.theta, bp, defined: p.defined, constrained: p.constrained, clip: p.clip, dyna: p.dyna, order: p.order, side: p.side, name: p.name };
}

/**
 * Allocate a virtual edge from `u` to `v`, copying port/label info from `orig`.
 * @see lib/dotgen/fastgr.c:new_virtual_edge
 */
export function newVirtualEdge(u: Node, v: Node, orig: Edge): Edge {
  const e = new EdgeClass(u, v, '');
  e.info.edge_type = VIRTUAL;
  e.info.tail_port = copyPort(orig.info.tail_port);
  e.info.head_port = copyPort(orig.info.head_port);
  e.info.label = orig.info.label;
  e.info.head_label = orig.info.head_label;
  e.info.tail_label = orig.info.tail_label;
  e.info.xlabel = orig.info.xlabel;
  e.info.to_orig = orig;
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

function basicMerge(e: Edge, rep: Edge): void {
  const ew = e.info.weight ?? 1;
  const em = e.info.minlen ?? 1;
  const ex = e.info.xpenalty ?? 0;
  for (let f: Edge | undefined = rep; f !== undefined; f = f.info.to_virt) {
    f.info.weight = (f.info.weight ?? 0) + ew;
    f.info.minlen = Math.max(f.info.minlen ?? 1, em);
    f.info.count = (f.info.count ?? 1) + 1;
    f.info.xpenalty = (f.info.xpenalty ?? 0) + ex;
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
