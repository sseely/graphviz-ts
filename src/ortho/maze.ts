// SPDX-License-Identifier: EPL-2.0
/**
 * Maze construction — mkMaze, updateWts, markSmall, createSEdges.
 *
 * Faithful port of lib/ortho/maze.c.
 *
 * @see lib/ortho/maze.c
 * @see lib/ortho/maze.h
 */

import type {
  OrthoBox, OrthoGraph, OrthoNode,
  Cell, SNode, SEdge, SGraph, Maze,
} from "./types.js";
import {
  MZ_ISNODE, MZ_SMALLV, MZ_SMALLH,
  M_RIGHT, M_TOP, M_LEFT, M_BOTTOM,
} from "./types.js";
import { partition } from "./partition.js";
import {
  createSGraph, createSNode, createSEdge,
  initSEdges, gsave,
} from "./sgraph.js";

/** @see lib/ortho/maze.c:#define MARGIN 36 */
export const MARGIN = 36;
/** @see lib/ortho/maze.c:#define delta 1 */
const delta = 1;
/** @see lib/ortho/maze.c:#define mu 500 */
const mu = 500;
/** @see lib/ortho/maze.c:#define BIG 16384 */
export const BIG = 16384;

/** @see lib/ortho/maze.c:#define CHANSZ(w) */
export function chanSz(w: number): number {
  return Math.floor((w - 3) / 2);
}

function isSmall(v: number): boolean { return chanSz(v) < 2; }
function isNode(cp: Cell): boolean { return (cp.flags & MZ_ISNODE) !== 0; }

// ─── updateWts ───────────────────────────────────────────────────────────────

function isBend(g: SGraph, e: SEdge): boolean {
  return g.nodes[e.v1].isVert !== g.nodes[e.v2].isVert;
}
function isHorz(g: SGraph, e: SEdge): boolean { return g.nodes[e.v1].isVert; }
function updateWt(ep: SEdge, sz: number): void {
  ep.cnt++;
  if (ep.cnt > sz) { ep.cnt = 0; ep.weight += BIG; }
}

/** @see lib/ortho/maze.c:updateWts */
export function updateWts(g: SGraph, cp: Cell, ep: SEdge): void {
  const bend = isBend(g, ep);
  const hsz = chanSz(cp.bb.UR.y - cp.bb.LL.y);
  const vsz = chanSz(cp.bb.UR.x - cp.bb.LL.x);
  const minsz = Math.min(hsz, vsz);
  let i = 0;
  for (; i < cp.nedges; i++) {
    const e = cp.edges[i];
    if (e === null || !isBend(g, e)) break;
    updateWt(e, minsz);
  }
  for (; i < cp.nedges; i++) {
    const e = cp.edges[i];
    if (e && (bend || e === ep)) updateWt(e, isHorz(g, e) ? hsz : vsz);
  }
}

// ─── markSmall ───────────────────────────────────────────────────────────────

function propagateSmall(start: Cell | null, side: number, flag: number): void {
  if (!start) return;
  let ocp: Cell = start;
  ocp.flags |= flag;
  while (true) {
    const onp: SNode | null = ocp.sides[side] as SNode | null;
    if (!onp) break;
    const next: Cell | null = (side === M_RIGHT || side === M_TOP)
      ? onp.cells[1] : onp.cells[0];
    if (!next || isNode(next)) break;
    next.flags |= flag;
    ocp = next;
  }
}

function markSmallV(cp: Cell): void {
  for (let i = 0; i < cp.nsides; i++) {
    const onp = cp.sides[i];
    if (!onp || !onp.isVert) continue;
    if (onp.cells[0] === cp) propagateSmall(onp.cells[1], M_RIGHT, MZ_SMALLV);
    else propagateSmall(onp.cells[0], M_LEFT, MZ_SMALLV);
  }
}

function markSmallH(cp: Cell): void {
  for (let i = 0; i < cp.nsides; i++) {
    const onp = cp.sides[i];
    if (!onp || onp.isVert) continue;
    if (onp.cells[0] === cp) propagateSmall(onp.cells[1], M_TOP, MZ_SMALLH);
    else propagateSmall(onp.cells[0], M_BOTTOM, MZ_SMALLH);
  }
}

function markSmall(cp: Cell): void {
  if (isSmall(cp.bb.UR.y - cp.bb.LL.y)) markSmallV(cp);
  if (isSmall(cp.bb.UR.x - cp.bb.LL.x)) markSmallH(cp);
}

// ─── createSEdges ────────────────────────────────────────────────────────────

function createSEdges(cp: Cell, g: SGraph): void {
  const bb = cp.bb;
  let hwt = delta * (bb.UR.x - bb.LL.x);
  let vwt = delta * (bb.UR.y - bb.LL.y);
  let wt = (hwt + vwt) / 2.0 + mu;
  if (isSmall(bb.UR.y - bb.LL.y) && !(cp.flags & MZ_SMALLV)) { hwt = BIG; wt = BIG; }
  if (isSmall(bb.UR.x - bb.LL.x) && !(cp.flags & MZ_SMALLH)) { vwt = BIG; wt = BIG; }
  const L = cp.sides[M_LEFT]; const T = cp.sides[M_TOP];
  const R = cp.sides[M_RIGHT]; const B = cp.sides[M_BOTTOM];
  if (L && T) cp.edges[cp.nedges++] = createSEdge(g, L, T, wt);
  if (T && R) cp.edges[cp.nedges++] = createSEdge(g, T, R, wt);
  if (L && B) cp.edges[cp.nedges++] = createSEdge(g, L, B, wt);
  if (B && R) cp.edges[cp.nedges++] = createSEdge(g, B, R, wt);
  if (T && B) cp.edges[cp.nedges++] = createSEdge(g, T, B, vwt);
  if (L && R) cp.edges[cp.nedges++] = createSEdge(g, L, R, hwt);
}

// ─── findSVert ───────────────────────────────────────────────────────────────

function ptKey(p: { x: number; y: number }): string { return `${p.x},${p.y}`; }

function findSVert(
  g: SGraph,
  dict: Map<string, SNode>,
  p: { x: number; y: number },
  isVert: boolean,
): SNode {
  const k = ptKey(p);
  let np = dict.get(k);
  if (!np) { np = createSNode(g); np.isVert = isVert; dict.set(k, np); }
  return np;
}

// ─── mkMazeGraph helpers ──────────────────────────────────────────────────────

function attachCellSides(
  mp: Maze, g: SGraph, bb: OrthoBox,
  vdict: Map<string, SNode>, hdict: Map<string, SNode>,
): void {
  for (let i = 0; i < mp.ncells; i++) {
    const cp = mp.cells[i];
    cp.nsides = 4;
    cp.sides = [null, null, null, null];
    if (cp.bb.UR.x < bb.UR.x) {
      const np = findSVert(g, vdict, { x: cp.bb.UR.x, y: cp.bb.LL.y }, true);
      np.cells[0] = cp; cp.sides[M_RIGHT] = np;
    }
    if (cp.bb.UR.y < bb.UR.y) {
      const np = findSVert(g, hdict, { x: cp.bb.LL.x, y: cp.bb.UR.y }, false);
      np.cells[0] = cp; cp.sides[M_TOP] = np;
    }
    if (cp.bb.LL.x > bb.LL.x) {
      const np = findSVert(g, vdict, cp.bb.LL, true);
      np.cells[1] = cp; cp.sides[M_LEFT] = np;
    }
    if (cp.bb.LL.y > bb.LL.y) {
      const np = findSVert(g, hdict, cp.bb.LL, false);
      np.cells[1] = cp; cp.sides[M_BOTTOM] = np;
    }
  }
}

function collectEdgeNodes(
  dict: Map<string, SNode>,
  startPt: { x: number; y: number },
  isHoriz: boolean,
  limit: number,
  out: SNode[],
  cp: Cell,
  cellIdx: 0 | 1,
): void {
  for (const [key, np] of dict) {
    const [kx, ky] = key.split(",").map(Number);
    const coord = isHoriz ? ky : kx;
    const scan = isHoriz ? kx : ky;
    const startCoord = isHoriz ? startPt.y : startPt.x;
    const startScan = isHoriz ? startPt.x : startPt.y;
    if (Math.abs(coord - startCoord) < 1e-9 && scan >= startScan && scan < limit) {
      out.push(np);
      np.cells[cellIdx] = cp;
    }
  }
}

function attachGcellSides(
  mp: Maze, g: SGraph,
  hdict: Map<string, SNode>, vdict: Map<string, SNode>,
): number {
  let maxdeg = 0;
  for (const cp of mp.gcells) {
    const sides: SNode[] = [];
    // bottom edge (horiz, y=LL.y)
    collectEdgeNodes(hdict, cp.bb.LL, true, cp.bb.UR.x, sides, cp, 1);
    // left edge (vert, x=LL.x)
    collectEdgeNodes(vdict, cp.bb.LL, false, cp.bb.UR.y, sides, cp, 1);
    // top edge (horiz, y=UR.y)
    collectEdgeNodes(hdict, { x: cp.bb.LL.x, y: cp.bb.UR.y }, true, cp.bb.UR.x, sides, cp, 0);
    // right edge (vert, x=UR.x)
    collectEdgeNodes(vdict, { x: cp.bb.UR.x, y: cp.bb.LL.y }, false, cp.bb.UR.y, sides, cp, 0);
    cp.sides = sides;
    cp.nsides = sides.length;
    if (cp.nsides > maxdeg) maxdeg = cp.nsides;
  }
  return maxdeg;
}

function mkMazeGraph(mp: Maze, bb: OrthoBox): SGraph {
  const bound = 4 * mp.ncells;
  const g = createSGraph(bound + 2);
  const vdict = new Map<string, SNode>();
  const hdict = new Map<string, SNode>();
  attachCellSides(mp, g, bb, vdict, hdict);
  const maxdeg = attachGcellSides(mp, g, hdict, vdict);
  for (const gc of mp.gcells) markSmall(gc);
  g.nodes[g.nnodes].index = g.nnodes;
  g.nodes[g.nnodes + 1].index = g.nnodes + 1;
  initSEdges(g, maxdeg);
  for (const cp of mp.cells) createSEdges(cp, g);
  gsave(g);
  return g;
}

// ─── mkMaze ──────────────────────────────────────────────────────────────────

function nodeBb(n: OrthoNode): OrthoBox {
  const w2 = Math.max(1, (n.bb.UR.x - n.bb.LL.x) / 2);
  const h2 = Math.max(1, (n.bb.UR.y - n.bb.LL.y) / 2);
  const cx = (n.bb.LL.x + n.bb.UR.x) / 2;
  const cy = (n.bb.LL.y + n.bb.UR.y) / 2;
  return { LL: { x: cx - w2, y: cy - h2 }, UR: { x: cx + w2, y: cy + h2 } };
}

/** @see lib/ortho/maze.c:mkMaze */
export function mkMaze(g: OrthoGraph): Maze {
  const gcells: Cell[] = g.nodes.map((n) => ({
    flags: MZ_ISNODE, nedges: 0,
    edges: new Array(6).fill(null) as (SEdge | null)[],
    nsides: 0, sides: [], bb: nodeBb(n),
  }));
  let BB: OrthoBox = {
    LL: { x: Number.MAX_VALUE, y: Number.MAX_VALUE },
    UR: { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE },
  };
  for (const gc of gcells) {
    BB = {
      LL: { x: Math.min(BB.LL.x, gc.bb.LL.x), y: Math.min(BB.LL.y, gc.bb.LL.y) },
      UR: { x: Math.max(BB.UR.x, gc.bb.UR.x), y: Math.max(BB.UR.y, gc.bb.UR.y) },
    };
  }
  BB = {
    LL: { x: BB.LL.x - MARGIN, y: BB.LL.y - MARGIN },
    UR: { x: BB.UR.x + MARGIN, y: BB.UR.y + MARGIN },
  };
  const rects = partition(gcells, BB);
  const cells: Cell[] = rects.map((bb) => ({
    flags: 0, nedges: 0,
    edges: new Array(6).fill(null) as (SEdge | null)[],
    nsides: 0, sides: [], bb,
  }));
  const mp: Maze = {
    ncells: cells.length, ngcells: gcells.length,
    cells, gcells,
    sg: createSGraph(0),
    hchans: new Map(), vchans: new Map(),
  };
  mp.sg = mkMazeGraph(mp, BB);
  return mp;
}

/** @see lib/ortho/maze.c:freeMaze */
export function freeMaze(_mp: Maze): void { /* GC handled */ }
