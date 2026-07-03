// SPDX-License-Identifier: EPL-2.0
/**
 * Partition free space around nodes into rectangular tiles.
 *
 * Faithful port of lib/ortho/partition.c.
 * Runs Seidel trapezoidation TWICE: once normal, once with x/y swapped
 * (via perp()). Intersection of the two decompositions yields cells
 * bounded on all four sides.
 *
 * SEED is fixed at 173 — matches lib/ortho/partition.c:srand48(173).
 *
 * @see lib/ortho/partition.c
 */

import { srand48, drand48 } from "../common/random.js";
import type { OrthoBox, OrthoPoint, Cell } from "./types.js";
import {
  constructTrapezoids, fpEqual, greaterThan, isValidTrap, C_EPS, equalTo,
} from "./trapezoid.js";
import type { SegmentT, TrapT } from "./trapezoid.js";

/** Fixed RNG seed — matches lib/ortho/partition.c:srand48(173) */
const SEED = 173;

export { SEED };

const NPOINTS = 4;

/** @see lib/ortho/partition.c:#define TR_FROM_UP/TR_FROM_DN */
const TR_FROM_UP = 1;
const TR_FROM_DN = 2;

class PartitionHelper {
  /** @see lib/common/geomprocs.h:perp — r.x = -p.y, r.y = p.x */
  static perp(p: OrthoPoint): OrthoPoint {
    return { x: -p.y, y: p.x };
  }

  static rectIntersect(r0: OrthoBox, r1: OrthoBox): OrthoBox | null {
    const llx = Math.max(r0.LL.x, r1.LL.x);
    const urx = Math.min(r0.UR.x, r1.UR.x);
    const lly = Math.max(r0.LL.y, r1.LL.y);
    const ury = Math.min(r0.UR.y, r1.UR.y);
    if (llx >= urx || lly >= ury) return null;
    return { LL: { x: llx, y: lly }, UR: { x: urx, y: ury } };
  }

  static convert(bb: OrthoBox, flip: boolean, ccw: boolean): OrthoPoint[] {
    const pts: OrthoPoint[] = [
      { ...bb.LL },
      ccw ? { x: bb.UR.x, y: bb.LL.y } : { x: bb.LL.x, y: bb.UR.y },
      { ...bb.UR },
      ccw ? { x: bb.LL.x, y: bb.UR.y } : { x: bb.UR.x, y: bb.LL.y },
    ];
    if (flip) return pts.map(PartitionHelper.perp);
    return pts;
  }

  static store(seg: SegmentT[], first: number, pts: OrthoPoint[]): number {
    const last = first + NPOINTS - 1;
    for (let i = first, j = 0; i <= last; i++, j++) {
      seg[i].next = i === first ? first + 1 : i === last ? first : i + 1;
      seg[i].prev = i === first ? last : i - 1;
      seg[i].isInserted = false;
      seg[i].v0 = { ...pts[j] };
      seg[seg[i].prev].v1 = { ...pts[j] };
    }
    return last + 1;
  }

  static genSegments(cells: Cell[], bb: OrthoBox, flip: boolean): SegmentT[] {
    const nsegs = 4 * (cells.length + 1);
    const seg: SegmentT[] = [];
    for (let i = 0; i <= nsegs; i++) {
      seg.push({
        v0: { x: 0, y: 0 }, v1: { x: 0, y: 0 },
        isInserted: false, root0: 0, root1: 0, next: 0, prev: 0,
      });
    }
    let i = 1;
    i = PartitionHelper.store(seg, i, PartitionHelper.convert(bb, flip, true));
    for (const cell of cells) {
      i = PartitionHelper.store(seg, i, PartitionHelper.convert(cell.bb, flip, false));
    }
    return seg;
  }

  /**
   * Generate a random permutation of the segments 1..n, drawing from the
   * process-global POSIX drand48 stream (seeded by partition's srand48).
   * @see lib/ortho/partition.c:generateRandomOrdering
   */
  static generateRandomOrdering(n: number): number[] {
    const permute: number[] = [];
    for (let i = 0; i < n; i++) permute.push(i + 1);
    for (let i = 0; i < n; i++) {
      // C: j = (size_t)((double)i + drand48() * (double)(n - i));
      const j = Math.floor(i + drand48() * (n - i));
      if (j !== i) {
        const tmp = permute[i]; permute[i] = permute[j]; permute[j] = tmp;
      }
    }
    return permute;
  }

  /**
   * Build the box for a rectangular trapezoid (un-flipping the perp frame
   * for the vertical pass). Caller has already verified the rect condition.
   * @see lib/ortho/partition.c:traverse_polygon (box block)
   */
  static mkTrapBox(t: TrapT, seg: SegmentT[], flip: boolean): OrthoBox {
    if (flip) {
      return {
        LL: { x: t.lo.y, y: -seg[t.rseg].v0.x },
        UR: { x: t.hi.y, y: -seg[t.lseg].v0.x },
      };
    }
    return {
      LL: { x: seg[t.lseg].v0.x, y: t.lo.y },
      UR: { x: seg[t.rseg].v0.x, y: t.hi.y },
    };
  }

  /**
   * True if the (triangular) trapezoid lies inside the polygon — used to
   * locate the traversal start trapezoid.
   * @see lib/ortho/partition.c:inside_polygon
   */
  static insidePolygon(t: TrapT, seg: SegmentT[]): boolean {
    if (!t.isValid) return false;
    if (t.lseg <= 0 || t.rseg <= 0) return false;
    const triangle =
      (!isValidTrap(t.u0) && !isValidTrap(t.u1)) ||
      (!isValidTrap(t.d0) && !isValidTrap(t.d1));
    if (triangle) return greaterThan(seg[t.rseg].v1, seg[t.rseg].v0);
    return false;
  }

  /**
   * Determines the ordered list of (child trapezoid, direction) pairs that
   * `traverse_polygon` recurses into for trapezoid `t`, given the `from`/
   * `dir` it was entered with. This is the C function's full branch table
   * (partition.c:400-621) minus the monotone-chain bookkeeping
   * (`make_new_monotone_poly`/`mcur`/`mnew`/`vert`/`mon`), which is provably
   * dead for box output — `decomp` boxes depend only on trap geometry and
   * `flip`, never on the chain state — but the CALL ORDER of children is
   * live: it determines maze-cell construction order downstream (mkMaze →
   * createSEdges → snode adjEdgeList), which is the tie-break for equal-cost
   * Dijkstra corridors in ortho edge routing.
   * @see lib/ortho/partition.c:traverse_polygon
   */
  static childOrder(t: TrapT, seg: SegmentT[], from: number, dir: number): [number, number][] {
    const UP = TR_FROM_UP; const DN = TR_FROM_DN;
    const { u0, u1, d0, d1 } = t;
    if (!isValidTrap(u0) && !isValidTrap(u1)) {
      if (isValidTrap(d0) && isValidTrap(d1)) { // downward opening triangle
        if (from === d1) return [[d1, UP], [d0, UP]];
        return [[d0, UP], [d1, UP]];
      }
      return [[u0, DN], [u1, DN], [d0, UP], [d1, UP]]; // just traverse all neighbours
    }
    if (!isValidTrap(d0) && !isValidTrap(d1)) {
      if (isValidTrap(u0) && isValidTrap(u1)) { // upward opening triangle
        if (from === u1) return [[u1, DN], [u0, DN]];
        return [[u0, DN], [u1, DN]];
      }
      return [[u0, DN], [u1, DN], [d0, UP], [d1, UP]]; // just traverse all neighbours
    }
    if (isValidTrap(u0) && isValidTrap(u1)) {
      if (isValidTrap(d0) && isValidTrap(d1)) { // downward + upward cusps
        if ((dir === DN && d1 === from) || (dir === UP && u1 === from)) {
          return [[u1, DN], [d1, UP], [u0, DN], [d0, UP]];
        }
        return [[u0, DN], [d0, UP], [u1, DN], [d1, UP]];
      }
      // only downward cusp
      if (equalTo(t.lo, seg[t.lseg].v1)) {
        if (dir === UP && u0 === from) return [[u0, DN], [d0, UP], [u1, DN], [d1, UP]];
        return [[u1, DN], [d0, UP], [d1, UP], [u0, DN]];
      }
      if (dir === UP && u1 === from) return [[u1, DN], [d1, UP], [d0, UP], [u0, DN]];
      return [[u0, DN], [d0, UP], [d1, UP], [u1, DN]];
    }
    // no downward cusp (is_valid_trap(u0) || is_valid_trap(u1), always true here)
    if (isValidTrap(d0) && isValidTrap(d1)) { // only upward cusp
      if (equalTo(t.hi, seg[t.lseg].v0)) {
        if (!(dir === DN && d0 === from)) return [[u1, DN], [d1, UP], [u0, DN], [d0, UP]];
        return [[d0, UP], [u0, DN], [u1, DN], [d1, UP]];
      }
      if (dir === DN && d1 === from) return [[d1, UP], [u1, DN], [u0, DN], [d0, UP]];
      return [[u0, DN], [d0, UP], [u1, DN], [d1, UP]];
    }
    // no cusp
    if (equalTo(t.hi, seg[t.lseg].v0) && equalTo(t.lo, seg[t.rseg].v0)) {
      if (dir === UP) return [[u0, DN], [u1, DN], [d1, UP], [d0, UP]];
      return [[d1, UP], [d0, UP], [u0, DN], [u1, DN]];
    }
    if (equalTo(t.hi, seg[t.rseg].v1) && equalTo(t.lo, seg[t.lseg].v1)) {
      if (dir === UP) return [[u0, DN], [u1, DN], [d1, UP], [d0, UP]];
      return [[d1, UP], [d0, UP], [u0, DN], [u1, DN]];
    }
    return [[u0, DN], [d0, UP], [u1, DN], [d1, UP]]; // no split possible
  }

  /**
   * Faithful port of monotonate_trapezoids' observable output: collect the
   * rectangle for every trapezoid reachable from the inside-polygon start
   * via u0/u1/d0/d1 adjacency, IN C's EXACT traverse_polygon call order.
   *
   * Realized as an explicit-stack DFS (not real recursion, to stay
   * stack-safe on large polygons per
   * .agent-notes/triangulation-recursion-stack-overflow.md) that preserves
   * C's preorder emission sequence: children are pushed in REVERSE of
   * `childOrder`'s call order so LIFO pop visits them in forward order,
   * fully exploring each child's subtree (via its own pushed descendants)
   * before returning to the next sibling — exactly mirroring recursive DFS.
   *
   * @see lib/ortho/partition.c:monotonate_trapezoids, traverse_polygon
   */
  static monotonateTrapezoids(tr: TrapT[], seg: SegmentT[], flip: boolean): OrthoBox[] {
    const decomp: OrthoBox[] = [];
    let trStart = -1;
    for (let j = 0; j < tr.length; j++) {
      if (PartitionHelper.insidePolygon(tr[j], seg)) { trStart = j; break; }
    }
    if (trStart < 0) return decomp;

    let startFrom: number; let startDir: number;
    if (isValidTrap(tr[trStart].u0)) { startFrom = tr[trStart].u0; startDir = TR_FROM_UP; }
    else if (isValidTrap(tr[trStart].d0)) { startFrom = tr[trStart].d0; startDir = TR_FROM_DN; }
    else return decomp;

    const visited = new Array<boolean>(tr.length).fill(false);
    // Stack items are [trnum, from, dir] — mirrors the recursive call's
    // (trnum, from, dir) parameters exactly.
    const stack: [number, number, number][] = [[trStart, startFrom, startDir]];
    while (stack.length > 0) {
      const [trnum, from, dir] = stack.pop()!;
      if (!isValidTrap(trnum) || visited[trnum]) continue;
      visited[trnum] = true;
      const t = tr[trnum];
      if (
        t.hi.y > t.lo.y + C_EPS &&
        fpEqual(seg[t.lseg].v0.x, seg[t.lseg].v1.x) &&
        fpEqual(seg[t.rseg].v0.x, seg[t.rseg].v1.x)
      ) {
        decomp.push(PartitionHelper.mkTrapBox(t, seg, flip));
      }
      const children = PartitionHelper.childOrder(t, seg, from, dir);
      for (let i = children.length - 1; i >= 0; i--) {
        const [child, childDir] = children[i];
        stack.push([child, trnum, childDir]);
      }
    }
    return decomp;
  }
}

/**
 * Partition free space around cells into rectangular tiles.
 * @see lib/ortho/partition.c:partition
 */
export function partition(cells: Cell[], bb: OrthoBox): OrthoBox[] {
  const h = PartitionHelper;
  const nsegs = 4 * (cells.length + 1);

  // C: srand48(173) once, then two generateRandomOrdering calls share the
  // continuing drand48 stream (partition.c:737-763).
  srand48(SEED);

  const hSeg = h.genSegments(cells, bb, false);
  const hPerm = h.generateRandomOrdering(nsegs);
  const hTr = constructTrapezoids(nsegs, hSeg, hPerm);
  const hDecomp = h.monotonateTrapezoids(hTr, hSeg, false);

  const vSeg = h.genSegments(cells, bb, true);
  const vPerm = h.generateRandomOrdering(nsegs);
  const vTr = constructTrapezoids(nsegs, vSeg, vPerm);
  const vDecomp = h.monotonateTrapezoids(vTr, vSeg, true);

  const result: OrthoBox[] = [];
  for (const v of vDecomp) {
    for (const hb of hDecomp) {
      const isect = h.rectIntersect(v, hb);
      if (isect) result.push(isect);
    }
  }
  return result;
}

/**
 * Test-only accessor for `PartitionHelper.childOrder` — exposes the
 * traverse_polygon branch-table transcription for direct unit testing
 * without requiring a full trapezoidation pipeline to exercise each branch.
 * @see PartitionHelper.childOrder
 */
export function traverseChildOrderForTest(
  t: TrapT, seg: SegmentT[], from: number, dir: number,
): [number, number][] {
  return PartitionHelper.childOrder(t, seg, from, dir);
}

export { TR_FROM_UP, TR_FROM_DN };
