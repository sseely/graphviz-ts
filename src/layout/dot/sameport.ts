// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/sameport.c — dot_sameports.
 *
 * Merges edges with specified samehead/sametail attributes onto the same port.
 *
 * @see lib/dotgen/sameport.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Port } from '../../model/geom.js';
import { VIRTUAL, MC_SCALE } from './fastgr.js';

// ---------------------------------------------------------------------------
// ARR_LEN — distance from node boundary for arr_port
// @see lib/common/const.h
// ---------------------------------------------------------------------------

/** @see lib/common/const.h:ARR_LEN (approximate — actual value depends on arrow rendering) */
export const ARR_LEN = 10;

// ---------------------------------------------------------------------------
// same_t / same_list — grouping structures
// @see lib/dotgen/sameport.c
// ---------------------------------------------------------------------------

/** A group of edges sharing the same samehead/sametail id at a node. */
export interface SameGroup {
  id: string;
  edges: Edge[];
}

// ---------------------------------------------------------------------------
// sameedge — register edge in a group
// @see lib/dotgen/sameport.c:sameedge
// ---------------------------------------------------------------------------

/** @see lib/dotgen/sameport.c:sameedge */
export function sameedge(same: SameGroup[], e: Edge, id: string): void {
  for (const grp of same) {
    if (grp.id === id) { grp.edges.push(e); return; }
  }
  same.push({ id, edges: [e] });
}

// ---------------------------------------------------------------------------
// shapeClip — move curve[0] to the node boundary
// @see lib/dotgen/sameport.c — calls shape_clip(u, curve)
// ---------------------------------------------------------------------------

/** Clamp t on the x-axis: tighten t so the ray stays within [lo, hi]. */
export function clampAxisX(t: number, d: number, n: number, lo: number, hi: number): number {
  if (d > 0) return Math.min(t, (hi - n) / d);
  if (d < 0) return Math.min(t, (lo - n) / d);
  return t;
}

/** Clamp t on the y-axis: tighten t so the ray stays within [lo, hi]. */
export function clampAxisY(t: number, d: number, n: number, lo: number, hi: number): number {
  if (d > 0) return Math.min(t, (hi - n) / d);
  if (d < 0) return Math.min(t, (lo - n) / d);
  return t;
}

/**
 * Approximate rectangular clip: move curve[0] toward curve[3] until it
 * reaches the node boundary rectangle.
 *
 * The C implementation calls shape_clip() which uses exact shape geometry.
 * This stub approximates with the node's bounding rectangle.
 *
 * @see lib/common/shapes.c:shape_clip
 */
export function shapeClip(u: Node, curve: { x: number; y: number }[]): void {
  const lx = u.info.coord.x - (u.info.lw ?? 1);
  const rx = u.info.coord.x + (u.info.rw ?? 1);
  const ty = u.info.coord.y + (u.info.ht ?? 1) / 2;
  const by = u.info.coord.y - (u.info.ht ?? 1) / 2;
  const dx = curve[3].x - curve[0].x;
  const dy = curve[3].y - curve[0].y;
  if (Math.hypot(dx, dy) === 0) return;
  const nx = curve[0].x;
  const ny = curve[0].y;
  const tx = clampAxisX(1, dx, nx, lx, rx);
  const t  = clampAxisY(tx, dy, ny, by, ty);
  curve[0] = { x: nx + dx * t, y: ny + dy * t };
}

// ---------------------------------------------------------------------------
// buildPort — construct the shared port for a group
// @see lib/dotgen/sameport.c:sameport
// ---------------------------------------------------------------------------

/** Compute (x1,y1) offset to node boundary for average direction. */
export function computeBoundaryOffset(
  u: Node, x: number, y: number, ranksep: number,
): { x1: number; y1: number } {
  const r = Math.max(
    (u.info.lw ?? 0) + (u.info.rw ?? 0),
    (u.info.ht ?? 0) + ranksep,
  );
  const x2 = x * r + u.info.coord.x;
  const y2 = y * r + u.info.coord.y;
  const curve = [
    { x: u.info.coord.x, y: u.info.coord.y },
    { x: (2 * u.info.coord.x + x2) / 3, y: (2 * u.info.coord.y + y2) / 3 },
    { x: (2 * x2 + u.info.coord.x) / 3, y: (2 * y2 + u.info.coord.y) / 3 },
    { x: x2, y: y2 },
  ];
  shapeClip(u, curve);
  return {
    x1: curve[0].x - u.info.coord.x,
    y1: curve[0].y - u.info.coord.y,
  };
}

/** Compute the average direction unit vector from u toward each edge's other end. */
export function averageDirection(u: Node, edges: Edge[]): { x: number; y: number } {
  let sx = 0, sy = 0;
  for (const e of edges) {
    const v = e.head === u ? e.tail : e.head;
    const dx = v.info.coord.x - u.info.coord.x;
    const dy = v.info.coord.y - u.info.coord.y;
    const r = Math.hypot(dx, dy);
    if (r !== 0) { sx += dx / r; sy += dy / r; }
  }
  const r = Math.hypot(sx, sy);
  return r !== 0 ? { x: sx / r, y: sy / r } : { x: 0, y: 0 };
}

/** Build the shared port object for this group at node u. */
export function buildSharedPort(u: Node, edges: Edge[], ranksep: number): Port {
  const dir = averageDirection(u, edges);
  const { x1, y1 } = computeBoundaryOffset(u, dir.x, dir.y, ranksep);
  const px = Math.round(x1);
  const py = Math.round(y1);
  const lw = u.info.lw ?? 0;
  const rw = u.info.rw ?? 0;
  const order = (lw + rw) !== 0 ? (MC_SCALE * (lw + px)) / (lw + rw) : 0;
  return {
    p: { x: px, y: py },
    theta: 0,
    bp: null,
    defined: true,
    constrained: false,
    clip: false,
    dyna: false,
    order,
    side: 0,
    name: null,
  };
}

// ---------------------------------------------------------------------------
// assignPortToChain — walk virtual chain and assign port
// @see lib/dotgen/sameport.c:sameport (inner loops)
// ---------------------------------------------------------------------------

/** Assign prt to edge f at whichever end matches u. */
export function assignHeadIfMatch(f: Edge, u: Node, prt: Port): void {
  if (f.head === u) f.info.head_port = prt;
  if (f.tail === u) f.info.tail_port = prt;
}

/** Walk the forward virtual chain (via head.out) assigning ports. */
export function assignPortForwardChain(e: Edge, u: Node, prt: Port): void {
  for (
    let f: Edge | undefined = e;
    f !== undefined;
    f = (f.info.edge_type ?? 0) === VIRTUAL
      && (f.head.info.node_type ?? 0) === VIRTUAL
      && (f.head.info.out?.size ?? 0) === 1
      ? f.head.info.out!.list[0]
      : undefined
  ) {
    assignHeadIfMatch(f, u, prt);
  }
}

/** Walk the backward virtual chain (via tail.in) assigning ports. */
export function assignPortBackwardChain(e: Edge, u: Node, prt: Port): void {
  for (
    let f: Edge | undefined = e;
    f !== undefined;
    f = (f.info.edge_type ?? 0) === VIRTUAL
      && (f.tail.info.node_type ?? 0) === VIRTUAL
      && (f.tail.info.in?.size ?? 0) === 1
      ? f.tail.info.in!.list[0]
      : undefined
  ) {
    assignHeadIfMatch(f, u, prt);
  }
}

/** Assign prt to all virtual edges of e that touch u. */
export function assignPortToAllVirts(e: Edge, u: Node, prt: Port): void {
  for (let virt: Edge | undefined = e; virt !== undefined; virt = virt.info.to_virt) {
    assignPortForwardChain(virt, u, prt);
    assignPortBackwardChain(virt, u, prt);
  }
}

// ---------------------------------------------------------------------------
// sameport — assign shared port to all edges in a group
// @see lib/dotgen/sameport.c:sameport
// ---------------------------------------------------------------------------

/** @see lib/dotgen/sameport.c:sameport */
export function sameport(u: Node, edges: Edge[], ranksep: number): void {
  if (edges.length < 2) return;
  const prt = buildSharedPort(u, edges, ranksep);
  for (const e of edges) assignPortToAllVirts(e, u, prt);
  u.info.has_port = true;
}

// ---------------------------------------------------------------------------
// attribute presence checks
// ---------------------------------------------------------------------------

/** True if any edge in g has a samehead attribute set. */
export function graphHasSamehead(g: Graph): boolean {
  for (const e of g.edges) {
    if (e.info.samehead !== undefined) return true;
  }
  return false;
}

/** True if any edge in g has a sametail attribute set. */
export function graphHasSametail(g: Graph): boolean {
  for (const e of g.edges) {
    if (e.info.sametail !== undefined) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// collectSameGroups — build same-head/tail groups for one node
// @see lib/dotgen/sameport.c:dot_sameports inner loop
// ---------------------------------------------------------------------------

/** Collect samehead groups for node n. */
export function collectSamehead(n: Node): SameGroup[] {
  const same: SameGroup[] = [];
  for (const e of n.root.edges) {
    if (e.head === n && e.tail === n) continue;
    const id = e.head === n ? e.info.samehead : undefined;
    if (id && id !== '') sameedge(same, e, id);
  }
  return same;
}

/** Collect sametail groups for node n. */
export function collectSametail(n: Node): SameGroup[] {
  const same: SameGroup[] = [];
  for (const e of n.root.edges) {
    if (e.head === n && e.tail === n) continue;
    const id = e.tail === n ? e.info.sametail : undefined;
    if (id && id !== '') sameedge(same, e, id);
  }
  return same;
}

/** Apply sameport merging for all multi-edge groups at node n. */
export function applyGroupsToNode(n: Node, groups: SameGroup[], ranksep: number): void {
  for (const grp of groups) {
    if (grp.edges.length > 1) sameport(n, grp.edges, ranksep);
  }
}

// ---------------------------------------------------------------------------
// dot_sameports — main entry point
// @see lib/dotgen/sameport.c:dot_sameports
// ---------------------------------------------------------------------------

/**
 * Merge edge ports in g for edges sharing samehead/sametail attributes.
 * @see lib/dotgen/sameport.c:dot_sameports
 */
export function dotSameports(g: Graph): void {
  const hasSH = graphHasSamehead(g);
  const hasST = graphHasSametail(g);
  if (!hasSH && !hasST) return;
  const ranksep = g.info.ranksep ?? 0;
  for (const n of g.nodes.values()) {
    if (hasSH) applyGroupsToNode(n, collectSamehead(n), ranksep);
    if (hasST) applyGroupsToNode(n, collectSametail(n), ranksep);
  }
}
