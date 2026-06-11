// SPDX-License-Identifier: EPL-2.0

/**
 * fdp initial layout — grid-accelerated Fruchterman–Reingold on point
 * nodes with boundary ports.
 *
 * Spec read at the 15.0.0 tag: the post-tag tree reorders doRep floats
 * (hypot vs sqrt(x²·y²)) and adds an Mlimit cutoff; the golden refs are
 * 15.0.0 output, so neither is ported.
 *
 * All math is double precision (unlike neato's float32 stress kernel).
 * Force-accumulation order is load-bearing: node iteration is the
 * component's id order, edge iteration is the graph edge order, and
 * grid cells walk in ascending (i, j) order.
 *
 * Parameter state lives in tlayout-parms.ts; initial placement in
 * tlayout-init.ts.
 *
 * @see lib/fdpgen/tlayout.c (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { fma, fms } from '../../common/fma.js';
import { Grid, type Cell } from './grid.js';
import {
  type Bport,
  type XParams,
  dndata,
  disp,
  isPort,
  gdata,
  P_FIX,
} from './fdp-model.js';
import { parms, cool, initParams, resetParams } from './tlayout-parms.js';
import { initPositions } from './tlayout-init.js';

export { fdpInitParams, fdpParms, setSeedFdp, INIT_RANDOM, INIT_REGULAR, INIT_SELF } from './tlayout-parms.js';

// ---------------------------------------------------------------------------
// Forces
// ---------------------------------------------------------------------------

/**
 * Coincident-node fallback. C re-rolls deltas with rand()%10; the
 * libc rand() sequence is platform-specific and unreachable for the
 * supported inputs (drand48 placement is continuous), so reaching it
 * is a STOP condition rather than a silent divergence.
 */
export function coincidentNodes(p: Node, q: Node): never {
  throw new Error(
    `fdp: coincident nodes ${p.name}/${q.name} hit the C rand() fallback ` +
    '(tlayout.c doRep/applyAttr) — not ported; see mission 7 journal',
  );
}

/**
 * Repulsive force = K²/d (useNew) or K²/d².
 * @see lib/fdpgen/tlayout.c:doRep
 */
function doRep(
  p: Node, q: Node, xdelta: number, ydelta: number, dist2: number,
): void {
  let force: number;

  if (dist2 === 0.0) coincidentNodes(p, q);
  if (parms.useNew) {
    const dist = Math.sqrt(dist2);
    force = parms.K * parms.K / (dist * dist2);
  } else {
    force = parms.K * parms.K / dist2;
  }
  if (isPort(p) && isPort(q)) force *= 10.0;
  const dq = disp(q);
  const dp = disp(p);
  // arm64 contraction: disp ± delta·force are fmadd/fmsub
  dq[0] = fma(xdelta, force, dq[0]);
  dq[1] = fma(ydelta, force, dq[1]);
  dp[0] = fms(xdelta, force, dp[0]);
  dp[1] = fms(ydelta, force, dp[1]);
}

/** @see lib/fdpgen/tlayout.c:applyRep */
function applyRep(p: Node, q: Node): void {
  const xdelta = q.info.pos![0]! - p.info.pos![0]!;
  const ydelta = q.info.pos![1]! - p.info.pos![1]!;
  doRep(p, q, xdelta, ydelta, fma(xdelta, xdelta, ydelta * ydelta));
}

/** @see lib/fdpgen/tlayout.c:doNeighbor */
function doNeighbor(grid: Grid, i: number, j: number, nodes: Node[]): void {
  const cellp = grid.find(i, j);
  if (cellp === undefined) return;
  for (const p of nodes) {
    for (const q of cellp.nodes) {
      const xdelta = q.info.pos![0]! - p.info.pos![0]!;
      const ydelta = q.info.pos![1]! - p.info.pos![1]!;
      const dist2 = fma(xdelta, xdelta, ydelta * ydelta);
      if (dist2 < parms.Cell * parms.Cell) doRep(p, q, xdelta, ydelta, dist2);
    }
  }
}

/** @see lib/fdpgen/tlayout.c:gridRepulse */
function gridRepulse(cellp: Cell, grid: Grid): void {
  const nodes = cellp.nodes;
  const i = cellp.i;
  const j = cellp.j;
  for (const p of nodes) {
    for (const q of nodes) {
      if (p !== q) applyRep(p, q);
    }
  }

  doNeighbor(grid, i - 1, j - 1, nodes);
  doNeighbor(grid, i - 1, j, nodes);
  doNeighbor(grid, i - 1, j + 1, nodes);
  doNeighbor(grid, i, j - 1, nodes);
  doNeighbor(grid, i, j + 1, nodes);
  doNeighbor(grid, i + 1, j - 1, nodes);
  doNeighbor(grid, i + 1, j, nodes);
  doNeighbor(grid, i + 1, j + 1, nodes);
}

/**
 * Attractive force = weight × (d − len)/d (useNew) or weight × d/len.
 * @see lib/fdpgen/tlayout.c:applyAttr
 */
function applyAttr(p: Node, q: Node, e: Edge): void {
  const xdelta = q.info.pos![0]! - p.info.pos![0]!;
  const ydelta = q.info.pos![1]! - p.info.pos![1]!;
  const dist2 = fma(xdelta, xdelta, ydelta * ydelta);
  if (dist2 === 0.0) coincidentNodes(p, q);
  const dist = Math.sqrt(dist2);
  let force: number;
  if (parms.useNew) {
    force = (e.info.factor ?? 1) * (dist - (e.info.dist ?? 1)) / dist;
  } else {
    force = (e.info.factor ?? 1) * dist / (e.info.dist ?? 1);
  }
  const dq = disp(q);
  const dp = disp(p);
  dq[0] = fms(xdelta, force, dq[0]);
  dq[1] = fms(ydelta, force, dq[1]);
  dp[0] = fma(xdelta, force, dp[0]);
  dp[1] = fma(ydelta, force, dp[1]);
}

// ---------------------------------------------------------------------------
// updatePos
// ---------------------------------------------------------------------------

/** Temperature-limited move of one node; returns its new raw target. */
function moveTarget(n: Node, temp: number): { x: number; y: number } {
  const dx = disp(n)[0];
  const dy = disp(n)[1];
  const len2 = fma(dx, dx, dy * dy);
  const temp2 = temp * temp;
  /* limit by temperature */
  if (len2 < temp2) {
    return { x: n.info.pos![0]! + dx, y: n.info.pos![1]! + dy };
  }
  const fact = temp / Math.sqrt(len2);
  return {
    x: fma(dx, fact, n.info.pos![0]!),
    y: fma(dy, fact, n.info.pos![1]!),
  };
}

/** Boundary-ellipse clamp for the with-ports case. */
function clampToBoundary(n: Node, x: number, y: number): void {
  const d = Math.sqrt(
    x * x / (parms.Wd * parms.Wd) + y * y / (parms.Ht * parms.Ht));
  if (isPort(n)) {
    n.info.pos![0] = x / d;
    n.info.pos![1] = y / d;
  } else if (d >= 1.0) {
    n.info.pos![0] = 0.95 * x / d;
    n.info.pos![1] = 0.95 * y / d;
  } else {
    n.info.pos![0] = x;
    n.info.pos![1] = y;
  }
}

/**
 * Move nodes by their accumulated displacement, limited by temperature
 * and (when ports exist) the boundary ellipse.
 * @see lib/fdpgen/tlayout.c:updatePos
 */
function updatePos(g: Graph, temp: number, pp: Bport[] | null): void {
  for (const n of g.nodes.values()) {
    if (dndata(n).pinned & P_FIX) continue;
    const { x, y } = moveTarget(n, temp);
    if (pp) {
      clampToBoundary(n, x, y);
    } else {
      n.info.pos![0] = x;
      n.info.pos![1] = y;
    }
  }
}

// ---------------------------------------------------------------------------
// adjust passes
// ---------------------------------------------------------------------------

/** FLOOR @see lib/fdpgen/tlayout.c:FLOOR */
const FLOOR = Math.floor;

/** One grid-accelerated iteration. @see lib/fdpgen/tlayout.c:gAdjust */
function gAdjust(g: Graph, temp: number, pp: Bport[] | null, grid: Grid): void {
  if (temp <= 0.0) return;

  grid.clear();

  for (const n of g.nodes.values()) {
    const d = disp(n);
    d[0] = d[1] = 0;
    grid.add(
      FLOOR(n.info.pos![0]! / parms.Cell),
      FLOOR(n.info.pos![1]! / parms.Cell),
      n,
    );
  }

  for (const n of g.nodes.values()) {
    for (const e of n.outEdges(g)) {
      if (n !== e.head) applyAttr(n, e.head, e);
    }
  }
  grid.walk(gridRepulse);

  updatePos(g, temp, pp);
}

/** All-pairs repulsion + attraction. @see tlayout.c:adjust (force loop) */
function allPairForces(g: Graph, nodes: Node[]): void {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    for (let k = i + 1; k < nodes.length; k++) {
      applyRep(n, nodes[k]!);
    }
    for (const e of n.outEdges(g)) {
      if (n !== e.head) applyAttr(n, e.head, e);
    }
  }
}

/** One O(n²) all-pairs iteration. @see lib/fdpgen/tlayout.c:adjust */
function adjust(g: Graph, temp: number, pp: Bport[] | null): void {
  if (temp <= 0.0) return;

  const nodes = [...g.nodes.values()];
  for (const n of nodes) {
    const d = disp(n);
    d[0] = d[1] = 0;
  }
  allPairForces(g, nodes);
  updatePos(g, temp, pp);
}

// ---------------------------------------------------------------------------
// fdp_tLayout
// ---------------------------------------------------------------------------

/**
 * Lay out one derived component g, respecting its boundary ports.
 * @see lib/fdpgen/tlayout.c:fdp_tLayout
 */
export function fdpTLayout(g: Graph, xpms: XParams): void {
  const pp = gdata(g).ports;
  const reset = initParams(g, xpms);
  const ctr = initPositions(g, pp);

  if (parms.useGrid) {
    const grid = new Grid();
    for (let i = 0; i < parms.loopcnt; i++) {
      const temp = cool(i);
      gAdjust(g, temp, pp, grid);
    }
  } else {
    for (let i = 0; i < parms.loopcnt; i++) {
      const temp = cool(i);
      adjust(g, temp, pp);
    }
  }

  if (ctr.x !== 0.0 || ctr.y !== 0.0) {
    for (const n of g.nodes.values()) {
      n.info.pos![0]! += ctr.x;
      n.info.pos![1]! += ctr.y;
    }
  }
  if (reset) resetParams();
}
