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
import { dfpCmp } from "./trap-types.js";
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
  // Same six conditional edges, same order/weights as the C unrolled form.
  // @see lib/ortho/maze.c:createSEdges
  const pairs: [SNode | null, SNode | null, number][] = [
    [L, T, wt], [T, R, wt], [L, B, wt], [B, R, wt], [T, B, vwt], [L, R, hwt],
  ];
  for (const [a, b, w] of pairs) {
    if (a && b) cp.edges[cp.nedges++] = createSEdge(g, a, b, w);
  }
}

// ─── search-node dict ─────────────────────────────────────────────────────────
//
// Mirrors C's CDT ordered set (Dtoset) keyed by the numeric point `snode.p`
// with the C_EPS-tolerant `dfp_cmp` comparator — NOT a stringified key. `byX`
// selects the C disc: vdict (vcmpid) orders by x-then-y, hdict (hcmpid) by
// y-then-x. Kept sorted so findSVert = dtmatch+dtinsert and the gcell walk =
// dtmatch+dtnext. @see lib/ortho/maze.c:vcmpid/hcmpid/findSVert

interface PointDict { nodes: SNode[]; byX: boolean }

/** Ordered compare of points (ax,ay) vs (bx,by) per the dict's disc. */
function pdCmp(byX: boolean, ax: number, ay: number, bx: number, by: number): number {
  if (byX) { const c = dfpCmp(ax, bx); return c !== 0 ? c : dfpCmp(ay, by); }
  const c = dfpCmp(ay, by); return c !== 0 ? c : dfpCmp(ax, bx);
}

/** Binary search for (x,y): { found, idx } — idx is the match or insert point. */
function pdSearch(pd: PointDict, x: number, y: number): { found: boolean; idx: number } {
  let lo = 0, hi = pd.nodes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const n = pd.nodes[mid]!;
    const c = pdCmp(pd.byX, n.x, n.y, x, y);
    if (c === 0) return { found: true, idx: mid };
    if (c < 0) lo = mid + 1; else hi = mid;
  }
  return { found: false, idx: lo };
}

/** @see lib/ortho/maze.c:findSVert (dtmatch; createSNode + dtinsert on miss) */
function findSVert(g: SGraph, pd: PointDict, x: number, y: number, isVert: boolean): SNode {
  const r = pdSearch(pd, x, y);
  if (r.found) return pd.nodes[r.idx]!;
  const np = createSNode(g);
  np.isVert = isVert; np.x = x; np.y = y;
  pd.nodes.splice(r.idx, 0, np);
  return np;
}

// ─── mkMazeGraph helpers ──────────────────────────────────────────────────────

function attachCellSides(
  mp: Maze, g: SGraph, bb: OrthoBox, vdict: PointDict, hdict: PointDict,
): void {
  for (let i = 0; i < mp.ncells; i++) {
    const cp = mp.cells[i];
    cp.nsides = 4;
    cp.sides = [null, null, null, null];
    if (cp.bb.UR.x < bb.UR.x) {
      const np = findSVert(g, vdict, cp.bb.UR.x, cp.bb.LL.y, true);
      np.cells[0] = cp; cp.sides[M_RIGHT] = np;
    }
    if (cp.bb.UR.y < bb.UR.y) {
      const np = findSVert(g, hdict, cp.bb.LL.x, cp.bb.UR.y, false);
      np.cells[0] = cp; cp.sides[M_TOP] = np;
    }
    if (cp.bb.LL.x > bb.LL.x) {
      const np = findSVert(g, vdict, cp.bb.LL.x, cp.bb.LL.y, true);
      np.cells[1] = cp; cp.sides[M_LEFT] = np;
    }
    if (cp.bb.LL.y > bb.LL.y) {
      const np = findSVert(g, hdict, cp.bb.LL.x, cp.bb.LL.y, false);
      np.cells[1] = cp; cp.sides[M_BOTTOM] = np;
    }
  }
}

/**
 * dtmatch + dtnext walk of one cell edge: start at the node equal to (sx,sy),
 * then take in-order successors while the scan coord stays below `bound`
 * (raw `<`, exactly as C). Returns the side nodes in sorted order.
 * @see lib/ortho/maze.c:mkMazeGraph (the four dtmatch/dtnext loops)
 */
function gcellWalk(pd: PointDict, sx: number, sy: number, boundIsX: boolean, bound: number): SNode[] {
  const out: SNode[] = [];
  const r = pdSearch(pd, sx, sy);
  if (!r.found) return out; // dtmatch returned NULL → empty edge
  for (let i = r.idx; i < pd.nodes.length; i++) {
    const np = pd.nodes[i]!;
    if (boundIsX ? !(np.x < bound) : !(np.y < bound)) break;
    out.push(np);
  }
  return out;
}

/** Append walked side nodes to `sides`, tagging each with the owning gcell. */
function appendSide(sides: SNode[], found: SNode[], cp: Cell, cellIdx: 0 | 1): void {
  for (const np of found) { sides.push(np); np.cells[cellIdx] = cp; }
}

function attachGcellSides(mp: Maze, hdict: PointDict, vdict: PointDict): number {
  let maxdeg = 0;
  for (const cp of mp.gcells) {
    const sides: SNode[] = [];
    appendSide(sides, gcellWalk(hdict, cp.bb.LL.x, cp.bb.LL.y, true, cp.bb.UR.x), cp, 1); // bottom
    appendSide(sides, gcellWalk(vdict, cp.bb.LL.x, cp.bb.LL.y, false, cp.bb.UR.y), cp, 1); // left
    appendSide(sides, gcellWalk(hdict, cp.bb.LL.x, cp.bb.UR.y, true, cp.bb.UR.x), cp, 0); // top
    appendSide(sides, gcellWalk(vdict, cp.bb.UR.x, cp.bb.LL.y, false, cp.bb.UR.y), cp, 0); // right
    cp.sides = sides;
    cp.nsides = sides.length;
    if (cp.nsides > maxdeg) maxdeg = cp.nsides;
  }
  return maxdeg;
}

function mkMazeGraph(mp: Maze, bb: OrthoBox): SGraph {
  const bound = 4 * mp.ncells;
  const g = createSGraph(bound + 2);
  const vdict: PointDict = { nodes: [], byX: true };  // vcmpid: x then y
  const hdict: PointDict = { nodes: [], byX: false }; // hcmpid: y then x
  attachCellSides(mp, g, bb, vdict, hdict);
  const maxdeg = attachGcellSides(mp, hdict, vdict);
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
