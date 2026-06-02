// SPDX-License-Identifier: EPL-2.0

/**
 * fdp layout engine — force-directed placement pipeline.
 *
 * Orchestrates fdp_tLayout, fdp_xLayout, and fdp_layout from the C source.
 * Force computation primitives live in forces.ts.
 *
 * @see lib/fdpgen/layout.c:fdp_layout
 * @see lib/fdpgen/tlayout.c:fdp_tLayout
 * @see lib/fdpgen/xlayout.c:fdp_xLayout
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { LayoutEngine } from '../../gvc/context.js';
import {
  fdpInitNodeEdge,
  fdpInitParams,
  fdpCleanup,
  type FdpParams,
} from './init.js';
import { Grid, addToGrid, clearGrid } from './grid.js';
import { findCComp } from './comp.js';
import { compoundEdges } from './clusteredges.js';
import {
  type ForceCtx,
  type RepulseGrid,
  zeroDisp,
  computeAttractive,
  computeRepulsive,
  repulseSelf,
  updatePositions,
} from './forces.js';

// Re-export public types and helpers that external consumers depend on.
export type { ForceCtx, RepulseGrid } from './forces.js';
export {
  getDisp,
  zeroDisp,
  jitter,
  safeDelta,
  repForce,
  applyRep,
  attrForce,
  applyAttr,
  computeAttractive,
  withinCell,
  repulseNeighbour,
  repulseSelf,
  repulse8Neighbours,
  repulseCell,
  computeRepulsive,
  moveNode,
  updatePositions,
  type AttrEdgeInfo,
} from './forces.js';

// ---------------------------------------------------------------------------
// Temperature cooling
// ---------------------------------------------------------------------------

/**
 * Linear temperature cooling: T(t) = T0 × (maxIter - t) / maxIter.
 * @see lib/fdpgen/tlayout.c:cool
 */
export function cool(T0: number, maxIter: number, t: number): number {
  return T0 * (maxIter - t) / maxIter;
}

/**
 * Auto-computes T0 when params.T0 is -1 (sentinel for "unset").
 * @see lib/fdpgen/tlayout.c:init_params
 */
export function computeT0(params: FdpParams, nnodes: number): number {
  if (params.T0 >= 0) return params.T0;
  return params.Tfact * params.K * Math.sqrt(nnodes) / 5;
}

// ---------------------------------------------------------------------------
// Initial random positions
// ---------------------------------------------------------------------------

/**
 * Places nodes without existing positions randomly within a rectangle.
 * @see lib/fdpgen/tlayout.c:initPositions (no-ports, no-fixed branch)
 */
export function randomisePositions(nodes: Node[], K: number): void {
  const half = K * (Math.sqrt(nodes.length) + 1.0) * 1.2 / 2;
  for (const n of nodes) {
    if (n.info.pinned) continue;
    if (!n.info.pos) n.info.pos = [0, 0];
    n.info.pos[0] = half * (2 * Math.random() - 1);
    n.info.pos[1] = half * (2 * Math.random() - 1);
  }
}

// ---------------------------------------------------------------------------
// One force iteration (grid and naive variants)
// ---------------------------------------------------------------------------

/** Bundles the inputs to a single force iteration. */
export interface IterCtx {
  g: Graph;
  nodes: Node[];
  ctx: ForceCtx;
}

/**
 * One force-directed iteration using the spatial grid.
 * @see lib/fdpgen/tlayout.c:gAdjust
 */
export function gAdjust(iter: IterCtx, grid: Grid, T: number): void {
  clearGrid(grid);
  for (const n of iter.nodes) { zeroDisp(n); addToGrid(grid, n); }
  computeAttractive(iter.g, iter.nodes, iter.ctx);
  const rg: RepulseGrid = { grid, ctx: iter.ctx };
  computeRepulsive(rg);
  updatePositions(iter.nodes, T);
}

/**
 * One force-directed iteration using O(n²) all-pairs repulsion.
 * @see lib/fdpgen/tlayout.c:adjust
 */
export function adjustNaive(iter: IterCtx, T: number): void {
  for (const n of iter.nodes) zeroDisp(n);
  repulseSelf(iter.nodes, iter.ctx);
  computeAttractive(iter.g, iter.nodes, iter.ctx);
  updatePositions(iter.nodes, T);
}

// ---------------------------------------------------------------------------
// fdpTLayout — main force iteration for one connected component
// ---------------------------------------------------------------------------

/** Runs grid-accelerated iterations for the component. */
export function runGridIter(iter: IterCtx, params: FdpParams, T0: number): void {
  const grid = new Grid(3 * params.K);
  for (let t = 0; t < params.maxIter; t++) {
    gAdjust(iter, grid, cool(T0, params.maxIter, t));
  }
}

/** Runs naive all-pairs iterations for the component. */
export function runNaiveIter(iter: IterCtx, params: FdpParams, T0: number): void {
  for (let t = 0; t < params.maxIter; t++) {
    adjustNaive(iter, cool(T0, params.maxIter, t));
  }
}

/**
 * Runs the temperature-annealing force loop for one component.
 * @see lib/fdpgen/tlayout.c:fdp_tLayout
 */
export function fdpTLayout(g: Graph, nodes: Node[], params: FdpParams): void {
  randomisePositions(nodes, params.K);
  const T0 = computeT0(params, nodes.length);
  const ctx: ForceCtx = { K: params.K, useNew: params.useNew };
  const iter: IterCtx = { g, nodes, ctx };
  if (params.useGrid && params.K > 0) {
    runGridIter(iter, params, T0);
  } else {
    runNaiveIter(iter, params, T0);
  }
}

// ---------------------------------------------------------------------------
// fdpXLayout — sync pos ↔ coord
// ---------------------------------------------------------------------------

/** Copies pos[] into coord so renderers can read positions. */
export function posToCoord(n: Node): void {
  if (!n.info.pos) return;
  n.info.coord.x = n.info.pos[0];
  n.info.coord.y = n.info.pos[1];
  if (!n.info.width) n.info.width = 0.5;
  if (!n.info.height) n.info.height = 0.5;
}

/** Copies coord back into pos[] after any coord mutation. */
export function coordToPos(n: Node): void {
  if (!n.info.pos) n.info.pos = [0, 0];
  n.info.pos[0] = n.info.coord.x;
  n.info.pos[1] = n.info.coord.y;
}

/**
 * Overlap-removal phase: syncs pos↔coord and back.
 * @see lib/fdpgen/xlayout.c:fdp_xLayout
 */
export function fdpXLayout(nodes: Node[]): void {
  if (nodes.length < 2) return;
  for (const n of nodes) posToCoord(n);
  for (const n of nodes) coordToPos(n);
}

// ---------------------------------------------------------------------------
// Finalise — copy pos[] → coord for all nodes
// ---------------------------------------------------------------------------

/**
 * Writes fdp positions into the canonical coord field used by renderers.
 * @see lib/fdpgen/layout.c:evalPositions
 */
export function finalisePositions(g: Graph): void {
  for (const n of g.nodes.values()) {
    if (n.info.pos) {
      n.info.coord.x = n.info.pos[0];
      n.info.coord.y = n.info.pos[1];
    }
  }
}

// ---------------------------------------------------------------------------
// fdpLayout — full layout pipeline
// ---------------------------------------------------------------------------

/**
 * Runs the complete fdp layout pipeline on graph g.
 * @see lib/fdpgen/layout.c:fdp_layout
 */
export function fdpLayout(g: Graph): void {
  fdpInitNodeEdge(g);
  const params = fdpInitParams(g);
  const { comps } = findCComp(g);
  for (const comp of comps) {
    if (comp.length === 0) continue;
    fdpTLayout(g, comp, params);
    fdpXLayout(comp);
  }
  compoundEdges(g);
  finalisePositions(g);
}

// ---------------------------------------------------------------------------
// LayoutEngine registration object
// ---------------------------------------------------------------------------

/**
 * fdp LayoutEngine plugin for registration with GvcContext.
 * @see lib/gvc/gvplugin.h:gvlayout_engine_s
 * @see src/gvc/context.ts:LayoutEngine
 */
export const fdpEngine: LayoutEngine = {
  type: 'fdp',
  layout(g: Graph): void { fdpLayout(g); },
  cleanup(g: Graph): void { fdpCleanup(g); },
};
