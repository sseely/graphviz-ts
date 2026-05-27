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

import { rkNewState, rkSeed, rkRandom } from "../util/mt19937.js";
import type { OrthoBox, OrthoPoint, Cell } from "./types.js";
import { constructTrapezoids, fpEqual } from "./trapezoid.js";
import type { SegmentT, TrapT } from "./trapezoid.js";

/** Fixed RNG seed — matches lib/ortho/partition.c:srand48(173) */
const SEED = 173;

export { SEED };

const NPOINTS = 4;

class PartitionHelper {
  static perp(p: OrthoPoint): OrthoPoint {
    return { x: p.y, y: p.x };
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

  static generateRandomOrdering(n: number, rng: { next: () => number }): number[] {
    const permute: number[] = [];
    for (let i = 0; i < n; i++) permute.push(i + 1);
    for (let i = 0; i < n; i++) {
      const f = rng.next() / 0x100000000;
      const j = Math.floor(i + f * (n - i));
      if (j !== i) {
        const tmp = permute[i]; permute[i] = permute[j]; permute[j] = tmp;
      }
    }
    return permute;
  }

  static makeRng(): { next: () => number } {
    const state = rkNewState();
    rkSeed(SEED, state);
    return { next: () => rkRandom(state) };
  }

  static trapToBox(t: TrapT, seg: SegmentT[], flip: boolean): OrthoBox | null {
    if (t.hi.y <= t.lo.y) return null;
    if (!fpEqual(seg[t.lseg].v0.x, seg[t.lseg].v1.x)) return null;
    if (!fpEqual(seg[t.rseg].v0.x, seg[t.rseg].v1.x)) return null;
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

  static collectBoxes(tr: TrapT[], seg: SegmentT[], flip: boolean): OrthoBox[] {
    const result: OrthoBox[] = [];
    for (let j = 1; j < tr.length; j++) {
      const t = tr[j];
      if (!t.isValid || t.lseg <= 0 || t.rseg <= 0) continue;
      const box = PartitionHelper.trapToBox(t, seg, flip);
      if (box) result.push(box);
    }
    return result;
  }
}

/**
 * Partition free space around cells into rectangular tiles.
 * @see lib/ortho/partition.c:partition
 */
export function partition(cells: Cell[], bb: OrthoBox): OrthoBox[] {
  const h = PartitionHelper;
  const rng = h.makeRng();
  const nsegs = 4 * (cells.length + 1);

  const hSeg = h.genSegments(cells, bb, false);
  const hPerm = h.generateRandomOrdering(nsegs, rng);
  const hTr = constructTrapezoids(nsegs, hSeg, hPerm);
  const hDecomp = h.collectBoxes(hTr, hSeg, false);

  const vSeg = h.genSegments(cells, bb, true);
  const vPerm = h.generateRandomOrdering(nsegs, rng);
  const vTr = constructTrapezoids(nsegs, vSeg, vPerm);
  const vDecomp = h.collectBoxes(vTr, vSeg, true);

  const result: OrthoBox[] = [];
  for (const v of vDecomp) {
    for (const hb of hDecomp) {
      const isect = h.rectIntersect(v, hb);
      if (isect) result.push(isect);
    }
  }
  return result;
}
