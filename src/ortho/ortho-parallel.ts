// SPDX-License-Identifier: EPL-2.0
/**
 * Parallel-segment precedence edges for orthogonal track assignment.
 *
 * When two segments occupy the exact same channel position (`is_parallel`),
 * `top_sort`'s default ordering is unconstrained — C resolves the tie by
 * walking outward along each segment's route until the two chains diverge,
 * then propagating the divergent pair's `seg_cmp` precedence back along the
 * parallel run as explicit graph edges. Skipping this (as an earlier port
 * revision did — see corpus 1447_1) leaves parallel tracks in whatever order
 * `top_sort` picks by construction, which does not match the C oracle.
 *
 * Faithful port of `lib/ortho/ortho.c:780-1010`.
 *
 * @see lib/ortho/ortho.c:next_seg
 * @see lib/ortho/ortho.c:is_parallel
 * @see lib/ortho/ortho.c:propagate_prec
 * @see lib/ortho/ortho.c:decide_point
 * @see lib/ortho/ortho.c:set_parallel_edges
 * @see lib/ortho/ortho.c:removeEdge
 * @see lib/ortho/ortho.c:addPEdges
 * @see lib/ortho/ortho.c:add_p_edges
 */

import type { OrthoSegment, Channel, Maze } from "./types.js";
import { Bend } from "./types.js";
import { chanSearch } from "./maze-channels.js";
import { insertEdge, edgeExists, removeRedge } from "./rawgraph.js";
import { segCmp } from "./ortho-route.js";

/** @see lib/ortho/ortho.c:next_seg */
function nextSeg(seg: OrthoSegment, dir: number): OrthoSegment | null {
  if (!dir) return seg.prev;
  return seg.next;
}

/** @see lib/ortho/ortho.c:is_parallel */
function isParallel(s1: OrthoSegment, s2: OrthoSegment): boolean {
  return s1.p.p1 === s2.p.p1 && s1.p.p2 === s2.p.p2 &&
    s1.l1 === s2.l1 && s1.l2 === s2.l2;
}

/** @see lib/ortho/ortho.c:propagate_prec */
function propagatePrec(seg: OrthoSegment, prec: number, hops: number, dir: number): number {
  let ans = prec;
  let current = seg;
  for (let x = 1; x <= hops; x++) {
    const next = nextSeg(current, dir)!;
    if (!current.isVert) {
      if (next.commCoord === current.p.p1) {
        if (current.l1 === Bend.B_UP) ans *= -1;
      } else {
        if (current.l2 === Bend.B_DOWN) ans *= -1;
      }
    } else {
      if (next.commCoord === current.p.p1) {
        if (current.l1 === Bend.B_RIGHT) ans *= -1;
      } else {
        if (current.l2 === Bend.B_LEFT) ans *= -1;
      }
    }
    current = next;
  }
  return ans;
}

/** @see lib/ortho/ortho.c:decide_point */
function decidePoint(
  ret: { a: number; b: number },
  si: OrthoSegment, sj: OrthoSegment, dir1: number, dir2: number,
): number {
  let prec = 0;
  let ans = 0;
  let np1: OrthoSegment | null;
  let np2: OrthoSegment | null = null;
  while ((np1 = nextSeg(si, dir1)) !== null &&
         (np2 = nextSeg(sj, dir2)) !== null &&
         isParallel(np1, np2)) {
    ans++;
    si = np1; // eslint-disable-line no-param-reassign
    sj = np2; // eslint-disable-line no-param-reassign
  }
  if (np1 === null) prec = 0;
  else if (np2 === null) throw new Error("decide_point: np2 null (C assert(0))");
  else {
    const temp = segCmp(np1, np2);
    if (temp === -2) return -1;
    prec = propagatePrec(np1, temp, ans + 1, 1 - dir1);
  }
  ret.a = ans;
  ret.b = prec;
  return 0;
}

/**
 * Truth table for `set_parallel_edges`'s four nested branches
 * (`ortho.c:797-849`), keyed by (isVert, commCoordMatchesP1, lDirMatchesTarget)
 * where `lDirMatchesTarget` is `l1===B_UP`/`l2===B_UP` for the horizontal axis
 * and `l1===B_LEFT`/`l2===B_LEFT` for the vertical axis (the two `l1`-vs-`l2`
 * arms are selected by `commCoordMatchesP1`, mirroring `ortho.c`'s
 * `prev1->comm_coord==seg1->p.p1` test). The value is `flip`: whether
 * `edge_exists(chan, seg1, seg2)` being true means the new edge is inserted
 * as `(prev2, prev1)` (flip) rather than `(prev1, prev2)`.
 *
 * Table derived by exhaustive enumeration of the 8 C branches (4 per axis,
 * 2 truth values of `edge_exists` each collapse to one `flip` bit) — see
 * `ortho-parallel.test.ts` for the pinned truth-table regression.
 *
 * @see lib/ortho/ortho.c:780-849 set_parallel_edges
 */
const SPE_FLIP_TABLE: Record<string, boolean> = {
  "h,A,dir": true,
  "h,A,!dir": false,
  "h,!A,dir": false,
  "h,!A,!dir": true,
  "v,A,dir": false,
  "v,A,!dir": true,
  "v,!A,dir": true,
  "v,!A,!dir": false,
};

function speFlip(isVert: boolean, commCoordMatchesP1: boolean, lDirMatchesTarget: boolean): boolean {
  const axis = isVert ? "v" : "h";
  const a = commCoordMatchesP1 ? "A" : "!A";
  const d = lDirMatchesTarget ? "dir" : "!dir";
  return SPE_FLIP_TABLE[`${axis},${a},${d}`];
}

/** @see lib/ortho/ortho.c:set_parallel_edges */
function setParallelEdges(
  seg1: OrthoSegment, seg2: OrthoSegment, dir1: number, dir2: number,
  hops: number, mp: Maze,
): void {
  let chan = seg1.isVert
    ? chanSearch(mp.vchans, seg1.commCoord, seg1.p)!
    : chanSearch(mp.hchans, seg1.commCoord, seg1.p)!;
  insertEdge(chan.G!, seg1.indNo!, seg2.indNo!);

  for (let x = 1; x <= hops; x++) {
    const prev1 = nextSeg(seg1, dir1)!;
    const prev2 = nextSeg(seg2, dir2)!;
    const nchan = seg1.isVert
      ? chanSearch(mp.hchans, prev1.commCoord, prev1.p)!
      : chanSearch(mp.vchans, prev1.commCoord, prev1.p)!;

    const commCoordMatchesP1 = prev1.commCoord === seg1.p.p1;
    const lDir = commCoordMatchesP1 ? seg1.l1 : seg1.l2;
    const target = seg1.isVert ? Bend.B_LEFT : Bend.B_UP;
    const flip = speFlip(seg1.isVert, commCoordMatchesP1, lDir === target);
    const edgeSeen = edgeExists(chan.G!, seg1.indNo!, seg2.indNo!);
    if (edgeSeen === flip) insertEdge(nchan.G!, prev2.indNo!, prev1.indNo!);
    else insertEdge(nchan.G!, prev1.indNo!, prev2.indNo!);

    chan = nchan;
    seg1 = prev1; // eslint-disable-line no-param-reassign
    seg2 = prev2; // eslint-disable-line no-param-reassign
  }
}

/** @see lib/ortho/ortho.c:removeEdge */
function removeEdgeParallel(
  seg1: OrthoSegment, seg2: OrthoSegment, dir: number, mp: Maze,
): void {
  let ptr1 = seg1;
  let ptr2 = seg2;
  while (isParallel(ptr1, ptr2)) {
    ptr1 = nextSeg(ptr1, 1)!;
    ptr2 = nextSeg(ptr2, dir)!;
  }
  const chan = ptr1.isVert
    ? chanSearch(mp.vchans, ptr1.commCoord, ptr1.p)!
    : chanSearch(mp.hchans, ptr1.commCoord, ptr1.p)!;
  removeRedge(chan.G!, ptr1.indNo!, ptr2.indNo!);
}

/**
 * Which of `prev`'s two segments to walk (0 : decrease, 1 : increase) when
 * resolving segment `i` vs `j` — the inline "get_directions" comment block at
 * the top of `addPEdges`.
 * @see lib/ortho/ortho.c:918
 */
function getDirections(segI: OrthoSegment, segJ: OrthoSegment): number {
  if (segI.prev === null) return segJ.prev === null ? 0 : 1;
  if (segJ.prev === null) return 1;
  return segI.prev.commCoord === segJ.prev.commCoord ? 0 : 1;
}

/**
 * Dispatch on the two deciding-point precedences (`prec1`/`prec2`, each in
 * {-1,0,1} using the `seg_cmp` sign convention) to add or remove the
 * constraint edges for one parallel segment pair.
 * @see lib/ortho/ortho.c:963-989 (the `if (prec1 == ...)` chain in addPEdges)
 */
function resolveParallelPrecedence(
  prec1: number, prec2: number, segI: OrthoSegment, segJ: OrthoSegment,
  dir: number, hopsA: number, hopsB: number, mp: Maze,
): void {
  if (prec1 === -1) {
    setParallelEdges(segJ, segI, dir, 0, hopsA, mp);
    setParallelEdges(segJ, segI, 1 - dir, 1, hopsB, mp);
    if (prec2 === 1) removeEdgeParallel(segI, segJ, 1 - dir, mp);
  } else if (prec1 === 0) {
    if (prec2 === -1) {
      setParallelEdges(segJ, segI, dir, 0, hopsA, mp);
      setParallelEdges(segJ, segI, 1 - dir, 1, hopsB, mp);
    } else if (prec2 === 0) {
      setParallelEdges(segI, segJ, 0, dir, hopsA, mp);
      setParallelEdges(segI, segJ, 1, 1 - dir, hopsB, mp);
    } else if (prec2 === 1) {
      setParallelEdges(segI, segJ, 0, dir, hopsA, mp);
      setParallelEdges(segI, segJ, 1, 1 - dir, hopsB, mp);
    }
  } else if (prec1 === 1) {
    setParallelEdges(segI, segJ, 0, dir, hopsA, mp);
    setParallelEdges(segI, segJ, 1, 1 - dir, hopsB, mp);
    if (prec2 === -1) removeEdgeParallel(segI, segJ, 1 - dir, mp);
  }
}

/** @see lib/ortho/ortho.c:addPEdges */
function addPEdges(cp: Channel, mp: Maze): number {
  const G = cp.G!;
  const segs = cp.segList;
  for (let i = 0; i + 1 < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (!edgeExists(G, i, j) && !edgeExists(G, j, i)) {
        if (isParallel(segs[i], segs[j])) {
          const dir = getDirections(segs[i], segs[j]);

          const p = { a: 0, b: 0 };
          if (decidePoint(p, segs[i], segs[j], 0, dir) !== 0) return -1;
          const hopsA = p.a;
          const prec1 = p.b;
          if (decidePoint(p, segs[i], segs[j], 1, 1 - dir) !== 0) return -1;
          const hopsB = p.a;
          const prec2 = p.b;

          resolveParallelPrecedence(prec1, prec2, segs[i], segs[j], dir, hopsA, hopsB, mp);
        }
      }
    }
  }
  return 0;
}

/** @see lib/ortho/ortho.c:add_p_edges */
export function addPEdgesAll(chans: Map<number, Map<string, Channel>>, mp: Maze): number {
  for (const [, sub] of chans) {
    for (const [, cp] of sub) {
      if (addPEdges(cp, mp) !== 0) return -1;
    }
  }
  return 0;
}
