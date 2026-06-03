// SPDX-License-Identifier: EPL-2.0

/**
 * Public API for rectangle packing and connected-component decomposition.
 * Ports lib/pack/pack.c and lib/pack/ccomps.c.
 *
 * @see lib/pack/pack.c
 * @see lib/pack/ccomps.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Box, Point } from '../../model/geom.js';
import { arrayRects } from './array-pack.js';
import { polyRects } from './poly-pack.js';
import {
  PackMode, PackInfo,
  PS2INCH, PK_COL_MAJOR, PK_USER_VALS, PK_LEFT_ALIGN,
  PK_RIGHT_ALIGN, PK_TOP_ALIGN, PK_BOT_ALIGN, PK_INPUT_ORDER,
} from './types.js';

export {
  PackMode, PS2INCH,
  PK_COL_MAJOR, PK_USER_VALS, PK_LEFT_ALIGN, PK_RIGHT_ALIGN,
  PK_TOP_ALIGN, PK_BOT_ALIGN, PK_INPUT_ORDER,
};
export type { PackInfo };
export { ps2inch, inch2ps } from './types.js';

// ---------------------------------------------------------------------------
// putRects / packRects
// ---------------------------------------------------------------------------

/**
 * Compute bounding-box packing offsets for ng bare rectangles.
 * Returns null for Aspect mode (not implemented in C) or Node/Cluster mode
 * (no node geometry available).
 * @see lib/pack/pack.c:putRects
 */
export function putRects(ng: number, bbs: Box[], pinfo: PackInfo): Point[] | null {
  if (ng <= 0) return [];
  if (pinfo.mode === PackMode.Aspect) return null;
  if (pinfo.mode === PackMode.Node || pinfo.mode === PackMode.Cluster) return null;
  if (pinfo.mode === PackMode.Array) return arrayRects(ng, bbs, pinfo);
  return polyRects(ng, bbs, pinfo);
}

/**
 * Pack bare rectangles; updates bbs in place. Returns 0 on success.
 * @see lib/pack/pack.c:packRects
 */
export function packRects(ng: number, bbs: Box[], pinfo: PackInfo): number {
  const pts = putRects(ng, bbs, pinfo);
  if (!pts) return -1;
  for (let i = 0; i < ng; i++) {
    const w = bbs[i].ur.x - bbs[i].ll.x;
    const h = bbs[i].ur.y - bbs[i].ll.y;
    bbs[i].ll.x = pts[i].x;
    bbs[i].ll.y = pts[i].y;
    bbs[i].ur.x = pts[i].x + w;
    bbs[i].ur.y = pts[i].y + h;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Graph bounding-box extraction
// ---------------------------------------------------------------------------

/** Node x-coordinate (0 if unset). */
export function nodeCoordX(n: Node): number {
  return n.info.coord !== undefined ? n.info.coord.x : 0;
}
/** Node y-coordinate (0 if unset). */
export function nodeCoordY(n: Node): number {
  return n.info.coord !== undefined ? n.info.coord.y : 0;
}
/** Expand accumulated bounds by one node. */
export function expandBounds(
  b: { llx: number; lly: number; urx: number; ury: number },
  n: Node, margin: number,
): void {
  const x = nodeCoordX(n);
  const y = nodeCoordY(n);
  const lw = n.info.lw !== undefined ? n.info.lw : 18;
  const rw = n.info.rw !== undefined ? n.info.rw : 18;
  const ht = n.info.ht !== undefined ? n.info.ht : 18;
  b.llx = Math.min(b.llx, x - lw - margin);
  b.lly = Math.min(b.lly, y - ht / 2 - margin);
  b.urx = Math.max(b.urx, x + rw + margin);
  b.ury = Math.max(b.ury, y + ht / 2 + margin);
}
/** Compute bounding box for a subgraph's nodes. @see lib/pack/pack.c:computeBB */
export function computeSubgraphBB(g: Graph, margin: number): Box {
  const b = { llx: Infinity, lly: Infinity, urx: -Infinity, ury: -Infinity };
  for (const n of g.nodes.values()) expandBounds(b, n, margin);
  if (!isFinite(b.llx)) return { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } };
  return { ll: { x: b.llx, y: b.lly }, ur: { x: b.urx, y: b.ury } };
}

/** Extract bounding boxes for an array of subgraphs. */
export function subgraphBBs(gs: Graph[], margin: number): Box[] {
  return gs.map(g => computeSubgraphBB(g, margin));
}

// ---------------------------------------------------------------------------
// putGraphs / packGraphs / packSubgraphs
// ---------------------------------------------------------------------------

/**
 * Compute packing offsets for ng pre-laid-out subgraphs.
 * @see lib/pack/pack.c:putGraphs
 */
export function putGraphs(ng: number, gs: Graph[], _root: Graph, pinfo: PackInfo): Point[] | null {
  if (ng <= 0) return [];
  if (pinfo.mode === PackMode.Aspect) return null;
  const bbs = subgraphBBs(gs, pinfo.margin);
  return putRects(ng, bbs, pinfo);
}

/**
 * Pack subgraphs; returns 0 on success.
 * @see lib/pack/pack.c:packGraphs
 */
export function packGraphs(ng: number, gs: Graph[], root: Graph, pinfo: PackInfo): number {
  const pts = putGraphs(ng, gs, root, pinfo);
  if (!pts) return -1;
  return shiftGraphs(ng, gs, pts, root, pinfo.doSplines);
}

/**
 * Pack subgraphs and update root bounding box.
 * @see lib/pack/pack.c:packSubgraphs
 */
export function packSubgraphs(ng: number, gs: Graph[], root: Graph, pinfo: PackInfo): number {
  const rc = packGraphs(ng, gs, root, pinfo);
  if (rc === 0) root.info.bb = computeSubgraphBB(root, 0);
  return rc;
}

// ---------------------------------------------------------------------------
// shiftGraphs
// ---------------------------------------------------------------------------

/** Shift all nodes in g by (dx, dy) points. @see lib/pack/pack.c:shiftGraph */
export function shiftOneGraph(g: Graph, dx: number, dy: number): void {
  for (const n of g.nodes.values()) {
    const c = n.info.coord ?? { x: 0, y: 0 };
    n.info.coord = { x: c.x + dx, y: c.y + dy };
    if (n.info.pos) {
      // pos is in inches — convert point delta to inches
      n.info.pos[0] = (n.info.pos[0] ?? 0) + dx * PS2INCH;
      n.info.pos[1] = (n.info.pos[1] ?? 0) + dy * PS2INCH;
    }
  }
}

/**
 * Apply packing offsets to subgraphs; shifts coords and pos.
 * @see lib/pack/pack.c:shiftGraphs
 */
export function shiftGraphs(
  ng: number, gs: Graph[], pp: Point[], _root: Graph, _doSplines: boolean,
): number {
  for (let i = 0; i < ng; i++) {
    const bb = computeSubgraphBB(gs[i], 0);
    const dx = pp[i].x - bb.ll.x;
    const dy = pp[i].y - bb.ll.y;
    if (dx !== 0 || dy !== 0) shiftOneGraph(gs[i], dx, dy);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Component decomposition (ccomps.c)
// ---------------------------------------------------------------------------

/** DFS to collect connected component nodes. @see lib/pack/ccomps.c */
export function dfsCollect(g: Graph, start: Node, visited: Set<string>): Node[] {
  const stack: Node[] = [start];
  const comp: Node[] = [];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (visited.has(n.name)) continue;
    visited.add(n.name);
    comp.push(n);
    for (const e of g.edges) {
      if (e.tail === n && !visited.has(e.head.name)) stack.push(e.head);
      if (e.head === n && !visited.has(e.tail.name)) stack.push(e.tail);
    }
  }
  return comp;
}

/** Build a subgraph containing only nodes. @see lib/pack/ccomps.c */
export function buildSubgraph(root: Graph, nodes: Node[], name: string): Graph {
  const sg = new (root.constructor as { new(name: string, kind: string): Graph })(name, 'directed');
  sg.info.dotroot = root;
  for (const n of nodes) sg.nodes.set(n.name, n);
  return sg;
}

/**
 * Decompose g into connected components (nodes only, no edges).
 * @see lib/pack/ccomps.c:ccomps
 */
export function ccomps(g: Graph, pfx: string): Graph[] {
  const visited = new Set<string>();
  const result: Graph[] = [];
  let idx = 0;
  for (const n of g.nodes.values()) {
    if (visited.has(n.name)) continue;
    const comp = dfsCollect(g, n, visited);
    result.push(buildSubgraph(g, comp, `${pfx}_${idx++}`));
  }
  return result;
}

/**
 * ccomps variant — same as ccomps for this port.
 * @see lib/pack/ccomps.c:cccomps
 */
export function cccomps(g: Graph, pfx: string): Graph[] {
  return ccomps(g, pfx);
}

/**
 * ccomps with pinned-node detection.
 * @see lib/pack/ccomps.c:pccomps
 */
export function pccomps(g: Graph, pfx: string): { graphs: Graph[]; pinned: boolean } {
  const graphs = ccomps(g, pfx);
  let pinned = false;
  for (const n of g.nodes.values()) {
    if (n.info.pinned) { pinned = true; break; }
  }
  return { graphs, pinned };
}

/** True if g has exactly one connected component. @see lib/pack/ccomps.c:isConnected */
export function isConnected(g: Graph): boolean {
  return ccomps(g, '__chk').length <= 1;
}

// ---------------------------------------------------------------------------
// Attribute readers
// ---------------------------------------------------------------------------

/** Parse pack mode from string attribute. @see lib/pack/pack.c:parsePackModeInfo */
export function parsePackModeInfo(p: string, dflt: PackMode, pinfo: PackInfo): PackMode {
  if (!p) return dflt;
  const s = p.trim().toLowerCase();
  if (s === 'cluster') { pinfo.mode = PackMode.Cluster; return PackMode.Cluster; }
  if (s === 'node')    { pinfo.mode = PackMode.Node;    return PackMode.Node; }
  if (s === 'graph')   { pinfo.mode = PackMode.Graph;   return PackMode.Graph; }
  if (s === 'array')   { pinfo.mode = PackMode.Array;   return PackMode.Array; }
  if (s === 'aspect')  { pinfo.mode = PackMode.Aspect;  return PackMode.Aspect; }
  pinfo.mode = dflt;
  return dflt;
}

/** Read pack mode from graph attribute. @see lib/pack/pack.c:getPackModeInfo */
export function getPackModeInfo(g: Graph, dflt: PackMode, pinfo: PackInfo): PackMode {
  const s = (g.info as unknown as Record<string, unknown>)['packMode'] as string | undefined;
  return parsePackModeInfo(s ?? '', dflt, pinfo);
}

/** Get pack mode from graph. @see lib/pack/pack.c:getPackMode */
export function getPackMode(g: Graph, dflt: PackMode): PackMode {
  const pinfo: PackInfo = { aspect: 0, sz: 0, margin: 0, doSplines: false, mode: dflt, fixed: null, vals: null, flags: 0 };
  return getPackModeInfo(g, dflt, pinfo);
}

/** Get margin/pack value. @see lib/pack/pack.c:getPack */
export function getPack(g: Graph, notDef: number, dflt: number): number {
  const v = (g.info as unknown as Record<string, unknown>)['pack'];
  if (v === undefined || v === null) return notDef;
  const n = Number(v);
  return isNaN(n) ? dflt : n;
}

/** Populate PackInfo from graph attributes. @see lib/pack/pack.c:getPackInfo */
export function getPackInfo(g: Graph, dflt: PackMode, dfltMargin: number, pinfo: PackInfo): PackMode {
  pinfo.margin = getPack(g, dfltMargin, dfltMargin);
  pinfo.doSplines = false;
  pinfo.flags = 0;
  pinfo.fixed = null;
  pinfo.vals = null;
  pinfo.sz = 0;
  pinfo.aspect = 1;
  return getPackModeInfo(g, dflt, pinfo);
}

/** @see lib/pack/ccomps.c:mapClust */
export function mapClust(cl: Graph): Graph {
  return cl;
}
