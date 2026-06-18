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
  constructTrapezoids, fpEqual, greaterThan, isValidTrap, C_EPS,
} from "./trapezoid.js";
import type { SegmentT, TrapT } from "./trapezoid.js";

/** Fixed RNG seed — matches lib/ortho/partition.c:srand48(173) */
const SEED = 173;

export { SEED };

const NPOINTS = 4;

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
   * Faithful port of monotonate_trapezoids' observable output: collect the
   * rectangle for every trapezoid reachable from the inside-polygon start
   * via u0/u1/d0/d1 adjacency. Obstacle-interior trapezoids are unreachable
   * from the free-region start and so are excluded (matching C).
   *
   * The C monotone-chain bookkeeping (make_new_monotone_poly / vert / mon)
   * is provably dead for box output — `decomp` boxes depend only on trap
   * geometry and `flip`, never on mcur/mnew — and every traverse_polygon
   * branch recurses into all valid neighbours, so the visited SET equals the
   * connected component of the start trapezoid. The recursive DFS is realized
   * iteratively here; emission order is therefore not bit-identical to C
   * (order-normalized comparison, T1 acceptance).
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
    // C starts the walk at the start trapezoid's u0 (or d0) neighbour.
    let start: number;
    if (isValidTrap(tr[trStart].u0)) start = tr[trStart].u0;
    else if (isValidTrap(tr[trStart].d0)) start = tr[trStart].d0;
    else return decomp;

    const visited = new Array<boolean>(tr.length).fill(false);
    const stack: number[] = [start];
    while (stack.length > 0) {
      const trnum = stack.pop()!;
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
      stack.push(t.u0, t.u1, t.d0, t.d1);
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
