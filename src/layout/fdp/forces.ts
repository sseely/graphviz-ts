// SPDX-License-Identifier: EPL-2.0

/**
 * Force computation primitives for the fdp layout engine.
 *
 * Ports applyRep, applyAttr, doRep, doNeighbor, gridRepulse, updatePos,
 * and their supporting helpers from lib/fdpgen/tlayout.c.
 *
 * @see lib/fdpgen/tlayout.c:applyRep
 * @see lib/fdpgen/tlayout.c:applyAttr
 * @see lib/fdpgen/tlayout.c:gridRepulse
 * @see lib/fdpgen/tlayout.c:updatePos
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { findInGrid, type Grid } from './grid.js';

// ---------------------------------------------------------------------------
// Displacement scratch — WeakMap avoids any cast on NodeInfo
// ---------------------------------------------------------------------------

/**
 * Per-node displacement scratch buffer (xd, yd) for one force iteration.
 * Uses a WeakMap so no cast on NodeInfo is required and GC is automatic.
 *
 * @see lib/fdpgen/tlayout.c:ND_disp (xd/yd fields)
 */
const dispMap = new WeakMap<Node, [number, number]>();

/** Returns the displacement scratch buffer for a node, lazily allocated. */
export function getDisp(n: Node): [number, number] {
  let d = dispMap.get(n);
  if (d === undefined) {
    d = [0, 0];
    dispMap.set(n, d);
  }
  return d;
}

/** Zeroes the displacement buffer for a node. */
export function zeroDisp(n: Node): void {
  const d = getDisp(n);
  d[0] = 0;
  d[1] = 0;
}

// ---------------------------------------------------------------------------
// ForceCtx — bundles K + useNew to stay under 4-param limit
// ---------------------------------------------------------------------------

/**
 * Force computation context bundling the spring constant and force variant.
 * Passed to all force functions instead of two separate parameters.
 */
export interface ForceCtx {
  /** Ideal spring constant. @see lib/fdpgen/tlayout.c:T_K */
  K: number;
  /** Use Hooke (true) or proportional (false) force variant. @see lib/fdpgen/tlayout.c:T_useNew */
  useNew: boolean;
}

// ---------------------------------------------------------------------------
// RepulseGrid — bundles grid + ctx to keep repulse helpers under 4 params
// ---------------------------------------------------------------------------

/**
 * Bundles the spatial grid and force context for repulsion helpers.
 * Keeps repulseNeighbour / repulse8Neighbours / repulseCell under the
 * 4-parameter lizard limit.
 */
export interface RepulseGrid {
  grid: Grid;
  ctx: ForceCtx;
}

// ---------------------------------------------------------------------------
// AttrEdgeInfo — bundles per-edge factor + ideal distance
// ---------------------------------------------------------------------------

/**
 * Bundles per-edge attractive force parameters so applyAttr stays at ≤4 params.
 * @see lib/fdpgen/tlayout.c:applyAttr (factor / edgeDist locals)
 */
export interface AttrEdgeInfo {
  /** Force scale factor (from edge weight attribute). */
  factor: number;
  /** Ideal edge length / rest length. */
  edgeDist: number;
}

// ---------------------------------------------------------------------------
// Zero-distance jitter
// ---------------------------------------------------------------------------

/**
 * Jitters a zero delta pair until dist² > 0.
 * @see lib/fdpgen/tlayout.c:doRep (while dist2 == 0 loop)
 */
export function jitter(): [number, number] {
  let xd: number, yd: number;
  do {
    xd = 5 - Math.floor(Math.random() * 10);
    yd = 5 - Math.floor(Math.random() * 10);
  } while (xd * xd + yd * yd === 0);
  return [xd, yd];
}

/**
 * Returns [xd, yd] from q.pos − p.pos; jitters if zero-length.
 * @see lib/fdpgen/tlayout.c:applyRep (delta computation)
 */
export function safeDelta(p: Node, q: Node): [number, number] {
  const xd = (q.info.pos?.[0] ?? 0) - (p.info.pos?.[0] ?? 0);
  const yd = (q.info.pos?.[1] ?? 0) - (p.info.pos?.[1] ?? 0);
  if (xd * xd + yd * yd === 0) return jitter();
  return [xd, yd];
}

// ---------------------------------------------------------------------------
// Repulsive force between two nodes
// ---------------------------------------------------------------------------

/**
 * Computes the repulsion force magnitude.
 * @see lib/fdpgen/tlayout.c:doRep
 */
export function repForce(dist2: number, ctx: ForceCtx): number {
  const K2 = ctx.K * ctx.K;
  return ctx.useNew ? K2 / (Math.sqrt(dist2) * dist2) : K2 / dist2;
}

/**
 * Applies repulsive force between nodes p and q.
 * @see lib/fdpgen/tlayout.c:applyRep
 */
export function applyRep(p: Node, q: Node, ctx: ForceCtx): void {
  const [xd, yd] = safeDelta(p, q);
  const force = repForce(xd * xd + yd * yd, ctx);
  const dp = getDisp(p);
  const dq = getDisp(q);
  dq[0] += xd * force;  dq[1] += yd * force;
  dp[0] -= xd * force;  dp[1] -= yd * force;
}

// ---------------------------------------------------------------------------
// Attractive force along an edge
// ---------------------------------------------------------------------------

/**
 * Computes attractive force magnitude for an edge.
 * @see lib/fdpgen/tlayout.c:applyAttr
 */
export function attrForce(
  dist: number, info: AttrEdgeInfo, useNew: boolean,
): number {
  return useNew
    ? info.factor * (dist - info.edgeDist) / dist
    : info.factor * dist / info.edgeDist;
}

/**
 * Applies attractive force along an edge from p (tail) to q (head).
 * @see lib/fdpgen/tlayout.c:applyAttr
 */
export function applyAttr(
  p: Node, q: Node, info: AttrEdgeInfo, ctx: ForceCtx,
): void {
  const [xd, yd] = safeDelta(p, q);
  const dist = Math.sqrt(xd * xd + yd * yd);
  const force = attrForce(dist, info, ctx.useNew);
  const dp = getDisp(p);
  const dq = getDisp(q);
  dq[0] -= xd * force;  dq[1] -= yd * force;
  dp[0] += xd * force;  dp[1] += yd * force;
}

// ---------------------------------------------------------------------------
// Attractive forces over all edges
// ---------------------------------------------------------------------------

/**
 * Applies attractive forces for all non-self edges among the given nodes.
 * @see lib/fdpgen/tlayout.c:gAdjust (attractive force loop)
 */
export function computeAttractive(
  g: Graph, nodes: Node[], ctx: ForceCtx,
): void {
  const nodeSet = new Set(nodes);
  for (const e of g.edges) {
    if (e.tail === e.head) continue;
    if (!nodeSet.has(e.tail) || !nodeSet.has(e.head)) continue;
    const info: AttrEdgeInfo = {
      factor: e.info.factor ?? 1.0,
      edgeDist: e.info.dist ?? ctx.K,
    };
    applyAttr(e.tail, e.head, info, ctx);
  }
}

// ---------------------------------------------------------------------------
// Grid-neighbour repulsion helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the squared distance between p and q is within one cell.
 * @see lib/fdpgen/tlayout.c:doNeighbor (dist2 < T_Cell*T_Cell check)
 */
export function withinCell(p: Node, q: Node, cellSize: number): boolean {
  const xd = (q.info.pos?.[0] ?? 0) - (p.info.pos?.[0] ?? 0);
  const yd = (q.info.pos?.[1] ?? 0) - (p.info.pos?.[1] ?? 0);
  return xd * xd + yd * yd < cellSize * cellSize;
}

/**
 * Applies repulsion between every node in cellNodes and every node in
 * the neighbouring cell (ni, nj), filtered by cell-distance.
 *
 * @param rg  Bundled grid + force context.
 * @param ni  Neighbour cell column index.
 * @param nj  Neighbour cell row index.
 * @param cellNodes  Nodes in the source cell.
 * @see lib/fdpgen/tlayout.c:doNeighbor
 */
export function repulseNeighbour(
  rg: RepulseGrid, ni: number, nj: number, cellNodes: Node[],
): void {
  const neighbour = findInGrid(rg.grid, ni, nj);
  if (!neighbour) return;
  const cs = rg.grid.cellSize;
  for (const p of cellNodes) {
    for (const q of neighbour.nodes) {
      if (withinCell(p, q, cs)) applyRep(p, q, rg.ctx);
    }
  }
}

/**
 * Applies within-cell all-pairs repulsion.
 * @see lib/fdpgen/tlayout.c:gridRepulse (inner pair loop)
 */
export function repulseSelf(nodes: Node[], ctx: ForceCtx): void {
  for (let pi = 0; pi < nodes.length; pi++) {
    for (let qi = pi + 1; qi < nodes.length; qi++) {
      applyRep(nodes[pi], nodes[qi], ctx);
    }
  }
}

/**
 * Applies neighbour repulsion for all 8 directions around (ci, cj).
 *
 * @param rg  Bundled grid + force context.
 * @param nodes  Nodes in the center cell.
 * @param ci  Center cell column index.
 * @param cj  Center cell row index.
 */
export function repulse8Neighbours(
  rg: RepulseGrid, nodes: Node[], ci: number, cj: number,
): void {
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (di === 0 && dj === 0) continue;
      repulseNeighbour(rg, ci + di, cj + dj, nodes);
    }
  }
}

/**
 * Applies all 8-neighbour + self repulsive forces for one grid cell.
 *
 * @param rg  Bundled grid + force context.
 * @param nodes  Nodes in the cell.
 * @param ci  Cell column index.
 * @param cj  Cell row index.
 * @see lib/fdpgen/tlayout.c:gridRepulse
 */
export function repulseCell(
  rg: RepulseGrid, nodes: Node[], ci: number, cj: number,
): void {
  repulseSelf(nodes, rg.ctx);
  repulse8Neighbours(rg, nodes, ci, cj);
}

// ---------------------------------------------------------------------------
// Repulsive forces (grid-accelerated)
// ---------------------------------------------------------------------------

/**
 * Applies repulsive forces to all nodes using the spatial grid.
 * @see lib/fdpgen/tlayout.c:gAdjust (walkGrid / gridRepulse)
 */
export function computeRepulsive(rg: RepulseGrid): void {
  rg.grid.walk((cell, ci, cj) => repulseCell(rg, cell.nodes, ci, cj));
}

// ---------------------------------------------------------------------------
// Position update
// ---------------------------------------------------------------------------

/**
 * Applies displacement to one node's position, capped by temperature T.
 * @see lib/fdpgen/tlayout.c:updatePos (inner body)
 */
export function moveNode(n: Node, T: number): void {
  if (n.info.pinned) return;
  const d = getDisp(n);
  const len2 = d[0] * d[0] + d[1] * d[1];
  const pos = n.info.pos!;
  if (len2 < T * T) {
    pos[0] += d[0];  pos[1] += d[1];
  } else {
    const fact = T / Math.sqrt(len2);
    pos[0] += d[0] * fact;  pos[1] += d[1] * fact;
  }
}

/**
 * Moves all nodes by their displacements, capped by temperature.
 * @see lib/fdpgen/tlayout.c:updatePos
 */
export function updatePositions(nodes: Node[], T: number): void {
  for (const n of nodes) moveNode(n, T);
}
