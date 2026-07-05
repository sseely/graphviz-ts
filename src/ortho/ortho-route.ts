// SPDX-License-Identifier: EPL-2.0
/**
 * Orthogonal edge routing pipeline — track assignment, segment comparison,
 * and route conversion.
 *
 * Faithful port of the non-trivial helpers in lib/ortho/ortho.c.
 *
 * @see lib/ortho/ortho.c
 */

import type {
  OrthoSegment, Route, Cell, SGraph, SNode, SEdge,
  Channel, Maze,
} from "./types.js";
import { Bend, M_LEFT, M_RIGHT, M_TOP, M_BOTTOM } from "./types.js";
import { chanSearch } from "./maze-channels.js";
import { makeGraph } from "./rawgraph.js";
import { insertEdge, edgeExists, removeRedge, topSort } from "./rawgraph.js";
import { updateWts } from "./maze.js";
import { addPEdgesAll } from "./ortho-parallel.js";

// ─── weight constants ─────────────────────────────────────────────────────────

const delta = 1;   // weight per unit length
const mu = 500;    // bend penalty per bend edge
export const BIG = 16384;  // near-infinite weight

// ─── Segment construction ─────────────────────────────────────────────────────

/** @see lib/ortho/ortho.c:setSeg */
export function setSeg(
  dir: boolean,
  fix: number,
  b1: number,
  b2: number,
  l1: Bend,
  l2: Bend,
): OrthoSegment {
  const sp: OrthoSegment = {
    isVert: dir, commCoord: fix,
    p: b1 < b2 ? { p1: b1, p2: b2 } : { p1: b2, p2: b1 },
    l1: b1 < b2 ? l1 : l2,
    l2: b1 < b2 ? l2 : l1,
    indNo: null, trackNo: null, prev: null, next: null,
  };
  return sp;
}

// ─── Route conversion ─────────────────────────────────────────────────────────

function midPt(cp: Cell): { x: number; y: number } {
  return {
    x: (cp.bb.LL.x + cp.bb.UR.x) / 2,
    y: (cp.bb.LL.y + cp.bb.UR.y) / 2,
  };
}

function sidePt(ptr: SNode, cp: Cell): { x: number; y: number } {
  const mid = (a: number, b: number) => (a + b) / 2;
  if (cp === ptr.cells[1]) {
    return ptr.isVert
      ? { x: cp.bb.LL.x, y: mid(cp.bb.LL.y, cp.bb.UR.y) }
      : { x: mid(cp.bb.LL.x, cp.bb.UR.x), y: cp.bb.LL.y };
  }
  return ptr.isVert
    ? { x: cp.bb.UR.x, y: mid(cp.bb.LL.y, cp.bb.UR.y) }
    : { x: mid(cp.bb.LL.x, cp.bb.UR.x), y: cp.bb.UR.y };
}

function cellOf(p: SNode, q: SNode): Cell {
  const cp = p.cells[0];
  if (cp === q.cells[0] || cp === q.cells[1]) return cp as Cell;
  return p.cells[1] as Cell;
}

function isNodeCell(cp: Cell): boolean {
  return (cp.flags & 1) !== 0; // MZ_ISNODE = 1
}

/**
 * Convert a shortest-path result to a sequence of routing segments.
 * @see lib/ortho/ortho.c:convertSPtoRoute
 */
export function convertSPtoRoute(
  g: SGraph,
  fst: SNode,
  lst: SNode,
): Route {
  const segs: OrthoSegment[] = [];
  let ptr = fst.nDad as SNode;
  let prev: SNode = ptr;
  let next = ptr.nDad as SNode;
  let cp = isNodeCell(ptr.cells[0] as Cell) ? ptr.cells[1] as Cell : ptr.cells[0] as Cell;
  let bp1 = sidePt(ptr, cp);
  let prevbp = { x: 0, y: 0 };

  while (next.nDad !== null) {
    const ncp = cellOf(prev, next);
    updateWts(g, ncp, ptr.nEdge as SEdge);

    if (ptr.isVert !== next.isVert || next.nDad === lst) {
      const bp2 = ptr.isVert !== next.isVert ? midPt(ncp) : sidePt(next, ncp);
      const seg = buildSeg(ptr, next, cp, ncp, bp1, prevbp, segs.length === 0, lst);
      segs.push(seg);

      // C advances cp/prevbp/bp1 BEFORE the bend-at-end extra segment
      // (ortho.c:182-184), so that segment's channel is the bend cell
      // (cp == ncp) and its direction bendpoints are the shifted pair.
      // Calling with the stale values put the final segment in the
      // pre-bend channel — corpus 2183 m->e rendered a dangling end 63pt
      // from its head. @see lib/ortho/ortho.c:180-203
      cp = ncp; prevbp = bp1; bp1 = bp2;
      if (ptr.isVert !== next.isVert && next.nDad === lst) {
        segs.push(buildLastSeg(next, cp, ncp, bp1, prevbp));
      }
      ptr = next;
    }
    prev = next;
    next = next.nDad as SNode;
  }

  for (let i = 0; i < segs.length; i++) {
    if (i > 0) segs[i].prev = segs[i - 1];
    if (i < segs.length - 1) segs[i].next = segs[i + 1];
  }
  return { segs };
}

function buildSeg(
  ptr: SNode, next: SNode, cp: Cell, ncp: Cell,
  bp1: { x: number; y: number }, prevbp: { x: number; y: number },
  isFirst: boolean, lst: SNode,
): OrthoSegment {
  let l1: Bend; let l2: Bend;
  let fix: number; let b1: number; let b2: number;

  if (ptr.isVert) {
    l1 = isFirst ? Bend.B_NODE : prevbp.y > bp1.y ? Bend.B_UP : Bend.B_DOWN;
    if (ptr.isVert !== next.isVert) l2 = next.cells[0] === ncp ? Bend.B_UP : Bend.B_DOWN;
    else l2 = Bend.B_NODE;
    fix = cp.bb.LL.y; b1 = cp.bb.LL.x; b2 = ncp.bb.LL.x;
  } else {
    l1 = isFirst ? Bend.B_NODE : prevbp.x > bp1.x ? Bend.B_RIGHT : Bend.B_LEFT;
    if (ptr.isVert !== next.isVert) l2 = next.cells[0] === ncp ? Bend.B_RIGHT : Bend.B_LEFT;
    else l2 = Bend.B_NODE;
    fix = cp.bb.LL.x; b1 = cp.bb.LL.y; b2 = ncp.bb.LL.y;
  }
  return setSeg(!ptr.isVert, fix, b1, b2, l1, l2);
}

function buildLastSeg(
  next: SNode, cp: Cell, ncp: Cell,
  bp1: { x: number; y: number }, prevbp: { x: number; y: number },
): OrthoSegment {
  let l1: Bend; let fix: number; let b1: number; let b2: number;
  const l2 = Bend.B_NODE;
  if (next.isVert) {
    l1 = prevbp.y > bp1.y ? Bend.B_UP : Bend.B_DOWN;
    fix = cp.bb.LL.y; b1 = cp.bb.LL.x; b2 = ncp.bb.LL.x;
  } else {
    l1 = prevbp.x > bp1.x ? Bend.B_RIGHT : Bend.B_LEFT;
    fix = cp.bb.LL.x; b1 = cp.bb.LL.y; b2 = ncp.bb.LL.y;
  }
  return setSeg(!next.isVert, fix, b1, b2, l1, l2);
}

// ─── assignSegs ──────────────────────────────────────────────────────────────

/** @see lib/ortho/ortho.c:insertChan */
function insertChan(chan: Channel, seg: OrthoSegment): void {
  seg.indNo = chan.segList.length;
  chan.segList.push(seg);
}

/** @see lib/ortho/ortho.c:assignSegs */
export function assignSegs(
  routes: Route[],
  mp: Maze,
): void {
  for (const rte of routes) {
    for (const seg of rte.segs) {
      const chans = seg.isVert ? mp.vchans : mp.hchans;
      const chan = chanSearch(chans, seg.commCoord, seg.p);
      if (chan) insertChan(chan, seg);
    }
  }
}

// ─── Track assignment ─────────────────────────────────────────────────────────

/** @see lib/ortho/ortho.c:vtrack */
export function vtrack(seg: OrthoSegment, mp: Maze): number {
  const chp = chanSearch(mp.vchans, seg.commCoord, seg.p);
  if (!chp) return seg.commCoord;
  const f = (seg.trackNo ?? 1) / (chp.segList.length + 1);
  return chp.cp!.bb.LL.x + f * (chp.cp!.bb.UR.x - chp.cp!.bb.LL.x);
}

/** @see lib/ortho/ortho.c:htrack */
export function htrack(seg: OrthoSegment, mp: Maze): number {
  const chp = chanSearch(mp.hchans, seg.commCoord, seg.p);
  if (!chp) return seg.commCoord;
  const f = 1.0 - (seg.trackNo ?? 1) / (chp.segList.length + 1);
  const lo = chp.cp!.bb.LL.y;
  const hi = chp.cp!.bb.UR.y;
  return Math.round(lo + f * (hi - lo));
}

// ─── seg_cmp and helpers ──────────────────────────────────────────────────────

function eqEndSeg(s1l2: Bend, s2l2: Bend, t1: Bend, t2: Bend): number {
  if ((s1l2 === t2 && s2l2 !== t2) || (s1l2 === Bend.B_NODE && s2l2 === t1)) return 0;
  return -1;
}

function overlapSeg(s1: OrthoSegment, s2: OrthoSegment, t1: Bend, t2: Bend): number {
  if (s1.p.p2 < s2.p.p2) {
    if (s1.l2 === t1 && s2.l1 === t2) return -1;
    if (s1.l2 === t2 && s2.l1 === t1) return 1;
    return 0;
  }
  if (s1.p.p2 > s2.p.p2) {
    if (s2.l1 === t2 && s2.l2 === t2) return -1;
    if (s2.l1 === t1 && s2.l2 === t1) return 1;
    return 0;
  }
  if (s2.l1 === t2) return eqEndSeg(s1.l2, s2.l2, t1, t2);
  return -1 * eqEndSeg(s2.l2, s1.l2, t1, t2);
}

function ellSeg(s1l1: Bend, s1l2: Bend, t: Bend): number {
  if (s1l1 === t) return s1l2 === t ? -1 : 0;
  return 1;
}

function segCmpEqualP1(s1: OrthoSegment, s2: OrthoSegment, t1: Bend, t2: Bend): number {
  if (s1.p.p2 < s2.p.p2) {
    return s1.l2 === t1 ? eqEndSeg(s2.l1, s1.l1, t1, t2) : -1 * eqEndSeg(s2.l1, s1.l1, t1, t2);
  }
  if (s1.p.p2 > s2.p.p2) {
    return s2.l2 === t2 ? eqEndSeg(s1.l1, s2.l1, t1, t2) : -1 * eqEndSeg(s1.l1, s2.l1, t1, t2);
  }
  return segCmpSameEnds(s1, s2, t1, t2);
}

function segCmpSameEnds(s1: OrthoSegment, s2: OrthoSegment, t1: Bend, t2: Bend): number {
  if (s1.l1 === s2.l1 && s1.l2 === s2.l2) return 0;
  if (s2.l1 === s2.l2) {
    if (s2.l1 === t1) return 1;
    if (s2.l1 === t2) return -1;
    if (s1.l1 !== t1 && s1.l2 !== t1) return 1;
    if (s1.l1 !== t2 && s1.l2 !== t2) return -1;
    return 0;
  }
  if (s2.l1 === t1 && s2.l2 === t2) {
    if (s1.l1 !== t1 && s1.l2 === t2) return 1;
    if (s1.l1 === t1 && s1.l2 !== t2) return -1;
    return 0;
  }
  if (s2.l2 === t1 && s2.l1 === t2) {
    if (s1.l2 !== t1 && s1.l1 === t2) return 1;
    if (s1.l2 === t1 && s1.l1 !== t2) return -1;
    return 0;
  }
  if (s2.l1 === Bend.B_NODE && s2.l2 === t1) return ellSeg(s1.l1, s1.l2, t1);
  if (s2.l1 === Bend.B_NODE && s2.l2 === t2) return -1 * ellSeg(s1.l1, s1.l2, t2);
  if (s2.l1 === t1 && s2.l2 === Bend.B_NODE) return ellSeg(s1.l2, s1.l1, t1);
  return -1 * ellSeg(s1.l2, s1.l1, t2);
}

function segCmpInner(s1: OrthoSegment, s2: OrthoSegment, t1: Bend, t2: Bend): number {
  if (s1.p.p2 < s2.p.p1 || s1.p.p1 > s2.p.p2) return 0;
  if (s1.p.p1 < s2.p.p1 && s2.p.p1 < s1.p.p2) return overlapSeg(s1, s2, t1, t2);
  if (s2.p.p1 < s1.p.p1 && s1.p.p1 < s2.p.p2) return -1 * overlapSeg(s2, s1, t1, t2);
  if (s1.p.p1 === s2.p.p1) return segCmpEqualP1(s1, s2, t1, t2);
  if (s1.p.p2 === s2.p.p1) { if (s1.l2 === s2.l1) return 0; return s1.l2 === t2 ? 1 : -1; }
  if (s1.l1 === s2.l2) return 0;
  return s1.l1 === t2 ? 1 : -1;
}

/** @see lib/ortho/ortho.c:seg_cmp */
export function segCmp(s1: OrthoSegment, s2: OrthoSegment): number {
  if (s1.isVert !== s2.isVert || s1.commCoord !== s2.commCoord) return -2;
  return s1.isVert
    ? segCmpInner(s1, s2, Bend.B_RIGHT, Bend.B_LEFT)
    : segCmpInner(s1, s2, Bend.B_DOWN, Bend.B_UP);
}

// ─── Graph edge management for channels ───────────────────────────────────────

function addEdgesInG(cp: Channel): number {
  const size = cp.segList.length;
  const G = cp.G!;
  for (let x = 0; x + 1 < size; x++) {
    for (let y = x + 1; y < size; y++) {
      const cmp = segCmp(cp.segList[x], cp.segList[y]);
      if (cmp === -2) return -1;
      if (cmp > 0) insertEdge(G, x, y);
      else if (cmp === -1) insertEdge(G, y, x);
    }
  }
  return 0;
}

function addNpEdges(chans: Map<number, Map<string, Channel>>): number {
  for (const [, sub] of chans) {
    for (const [, cp] of sub) {
      if (cp.segList.length > 0 && addEdgesInG(cp) !== 0) return -1;
    }
  }
  return 0;
}

function createGraphs(chans: Map<number, Map<string, Channel>>): void {
  for (const [, sub] of chans) {
    for (const [, cp] of sub) {
      cp.G = makeGraph(cp.segList.length);
    }
  }
}

function assignTrackNo(chans: Map<number, Map<string, Channel>>): void {
  for (const [, sub] of chans) {
    for (const [, cp] of sub) {
      if (cp.segList.length > 0 && cp.G) {
        topSort(cp.G);
        for (let k = 0; k < cp.segList.length; k++) {
          cp.segList[k].trackNo = cp.G.vertices[k].topsortOrder + 1;
        }
      }
    }
  }
}

/** @see lib/ortho/ortho.c:assignTracks */
export function assignTracks(mp: Maze): number {
  createGraphs(mp.hchans);
  createGraphs(mp.vchans);
  if (addNpEdges(mp.hchans) !== 0) return -1;
  if (addNpEdges(mp.vchans) !== 0) return -1;
  if (addPEdgesAll(mp.hchans, mp) !== 0) return -1;
  if (addPEdgesAll(mp.vchans, mp) !== 0) return -1;
  assignTrackNo(mp.hchans);
  assignTrackNo(mp.vchans);
  return 0;
}

export { insertEdge, edgeExists, removeRedge };
