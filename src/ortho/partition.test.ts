// SPDX-License-Identifier: EPL-2.0

/**
 * Oracle-pin test for partition.ts (ortho P2, T1).
 *
 * Ground truth captured from instrumented native graphviz `dot` via the
 * gvmine plugin oracle (ADR-1): `partition.c` was instrumented to dump, for
 * `splines=ortho` fixtures, the gcell obstacle boxes, the bounding box BB
 * (node coords ± size/2, expanded by MARGIN=36), the two drand48-generated
 * segment permutations, and the output rectangle set. C reverted after mint.
 *
 * Each fixture drives `partition` with the EXACT C-dumped gcells + BB
 * (ADR-2: isolate pipeline logic from layout). The drand48 permute is
 * reproduced internally by partition's srand48(173) — verified equal to the
 * C-dumped permute below.
 *
 * Comparison is order-normalized by (LL.x, LL.y, UR.x, UR.y): C emits boxes
 * in monotonate_trapezoids DFS order; the TS port emits in trapezoid-index
 * order. The SET must match exactly.
 *
 * @see lib/ortho/partition.c:partition
 */

import { describe, it, expect } from "vitest";
import {
  partition, SEED, traverseChildOrderForTest, TR_FROM_UP, TR_FROM_DN,
} from "./partition.js";
import { srand48, drand48 } from "../common/random.js";
import type { Cell, OrthoBox } from "./types.js";
import type { SegmentT, TrapT } from "./trapezoid.js";

/** Build a partition input Cell from a bounding box (only bb is read). */
function mkCell(LLx: number, LLy: number, URx: number, URy: number): Cell {
  return {
    flags: 0,
    nedges: 0,
    edges: [],
    nsides: 0,
    sides: [],
    bb: { LL: { x: LLx, y: LLy }, UR: { x: URx, y: URy } },
  };
}

function box(LLx: number, LLy: number, URx: number, URy: number): OrthoBox {
  return { LL: { x: LLx, y: LLy }, UR: { x: URx, y: URy } };
}

/** Normalize a box list to a sorted key set for order-independent equality. */
function boxKeys(boxes: OrthoBox[]): string[] {
  return boxes
    .map((b) => `${b.LL.x},${b.LL.y},${b.UR.x},${b.UR.y}`)
    .sort();
}

/** Reproduce C generateRandomOrdering for permute verification. */
function genOrder(n: number): number[] {
  const p: number[] = [];
  for (let i = 0; i < n; i++) p.push(i + 1);
  for (let i = 0; i < n; i++) {
    const j = Math.floor(i + drand48() * (n - i));
    if (j !== i) {
      const t = p[i]!;
      p[i] = p[j]!;
      p[j] = t;
    }
  }
  return p;
}

interface Fixture {
  name: string;
  bb: OrthoBox;
  cells: Cell[];
  hperm: number[];
  vperm: number[];
  rects: OrthoBox[];
}

// --- C-dumped fixtures (ORTHO_DUMP from instrumented native dot) -------------

const FIXTURES: Fixture[] = [
  {
    name: "f2pair: a -> b (2-node chain)",
    bb: box(-63, -36, 63, 144),
    cells: [mkCell(-27, 72, 27, 108), mkCell(-27, 0, 27, 36)],
    hperm: [10, 9, 11, 7, 2, 4, 5, 12, 3, 1, 6, 8],
    vperm: [12, 5, 9, 1, 11, 3, 6, 8, 7, 2, 10, 4],
    rects: [
      box(-63, -36, -27, 0),
      box(-63, 0, -27, 36),
      box(-63, 36, -27, 72),
      box(-63, 72, -27, 108),
      box(-63, 108, -27, 144),
      box(-27, 108, 27, 144),
      box(27, -36, 63, 0),
      box(27, 36, 63, 72),
      box(27, 108, 63, 144),
      box(27, 72, 63, 108),
      box(27, 0, 63, 36),
      box(-27, -36, 27, 0),
      box(-27, 36, 27, 72),
    ],
  },
  {
    name: "f3chain: a -> b -> c (3-node chain)",
    bb: box(-63, -36, 63, 216),
    cells: [
      mkCell(-27, 144, 27, 180),
      mkCell(-27, 72, 27, 108),
      mkCell(-27, 0, 27, 36),
    ],
    hperm: [14, 11, 1, 9, 2, 7, 10, 16, 13, 5, 6, 4, 8, 15, 12, 3],
    vperm: [13, 8, 9, 4, 7, 12, 10, 16, 1, 2, 5, 15, 6, 11, 3, 14],
    rects: [
      box(27, -36, 63, 0),
      box(27, 36, 63, 72),
      box(27, 108, 63, 144),
      box(27, 180, 63, 216),
      box(27, 144, 63, 180),
      box(27, 72, 63, 108),
      box(27, 0, 63, 36),
      box(-27, -36, 27, 0),
      box(-63, -36, -27, 0),
      box(-63, 0, -27, 36),
      box(-63, 36, -27, 72),
      box(-63, 72, -27, 108),
      box(-63, 108, -27, 144),
      box(-63, 144, -27, 180),
      box(-63, 180, -27, 216),
      box(-27, 180, 27, 216),
      box(-27, 36, 27, 72),
      box(-27, 108, 27, 144),
    ],
  },
  {
    name: "f3branch: a -> b, a -> c (branch)",
    bb: box(-99, -36, 99, 144),
    cells: [
      mkCell(-27, 72, 27, 108),
      mkCell(-63, 0, -9, 36),
      mkCell(9, 0, 63, 36),
    ],
    hperm: [14, 11, 1, 9, 2, 7, 10, 16, 13, 5, 6, 4, 8, 15, 12, 3],
    vperm: [13, 8, 9, 4, 7, 12, 10, 16, 1, 2, 5, 15, 6, 11, 3, 14],
    rects: [
      box(63, -36, 99, 0),
      box(63, 36, 99, 72),
      box(63, 108, 99, 144),
      box(63, 72, 99, 108),
      box(63, 0, 99, 36),
      box(9, -36, 63, 0),
      box(-9, -36, 9, 0),
      box(-9, 36, 9, 72),
      box(-9, 0, 9, 36),
      box(-63, -36, -9, 0),
      box(-99, -36, -63, 0),
      box(-99, 0, -63, 36),
      box(-99, 36, -63, 72),
      box(-99, 72, -63, 108),
      box(-99, 108, -63, 144),
      box(-63, 36, -27, 72),
      box(-63, 72, -27, 108),
      box(-63, 108, -27, 144),
      box(-27, 108, 27, 144),
      box(27, 36, 63, 72),
      box(27, 108, 63, 144),
      box(27, 72, 63, 108),
      box(9, 36, 27, 72),
      box(-27, 36, -9, 72),
    ],
  },
];

describe("ortho partition — oracle-pinned vs native C", () => {
  it("SEED matches C srand48(173)", () => {
    expect(SEED).toBe(173);
  });

  for (const fx of FIXTURES) {
    describe(fx.name, () => {
      const nsegs = 4 * (fx.cells.length + 1);

      it("reproduces the C drand48 permutes (hperm, vperm)", () => {
        srand48(SEED);
        expect(genOrder(nsegs)).toEqual(fx.hperm);
        expect(genOrder(nsegs)).toEqual(fx.vperm);
      });

      it("produces the C rectangle set", () => {
        const got = partition(fx.cells, fx.bb);
        expect(got).toHaveLength(fx.rects.length);
        expect(boxKeys(got)).toEqual(boxKeys(fx.rects));
      });

      it("is deterministic run-to-run", () => {
        const a = partition(fx.cells, fx.bb);
        const b = partition(fx.cells, fx.bb);
        expect(boxKeys(a)).toEqual(boxKeys(b));
      });
    });
  }
});

// ---------------------------------------------------------------------------
// traverse_polygon branch-table transcription (F1) — direct unit tests
//
// C's traverse_polygon (partition.c:400-621) is a preorder DFS over the
// trapezoid u0/u1/d0/d1 adjacency whose recursive CALL ORDER varies per
// branch based on (from, dir) and a handful of `equal_to` geometry checks.
// The prior port's iterative form used a fixed push order (u0,u1,d0,d1,
// popped LIFO) and skipped the true DFS entry point (`tr_start` itself),
// which is provably box-SET-correct (order-normalized, see the oracle-pinned
// tests above) but not order-faithful to C. `childOrder` is the literal
// branch-table transcription; these tests pin its output against hand-built
// TrapT/SegmentT fixtures chosen to hit each branch, citing the C line the
// branch corresponds to — a regression net for the transcription itself,
// independent of whether a given real-world maze geometry currently
// exercises the branch (per F1 investigation: on the corpus tested, box
// SETS never depend on traversal order, so `partition()`'s output is
// unchanged by this fix on every fixture tried — see decisions.md).
// ---------------------------------------------------------------------------

const ORIGIN = { x: 0, y: 0 };

/** Minimal TrapT — only the fields childOrder reads are meaningful. */
function mkTrap(over: Partial<TrapT>): TrapT {
  return {
    lseg: 0, rseg: 0, hi: ORIGIN, lo: ORIGIN,
    u0: 0, u1: 0, d0: 0, d1: 0,
    sink: 0, usave: 0, uside: 0, isValid: true,
    ...over,
  };
}

/** seg[] indexed from 1 (index 0 unused, matches C's 1-based segment array). */
function mkSegArray(entries: Record<number, Partial<SegmentT>>): SegmentT[] {
  const seg: SegmentT[] = [];
  const max = Math.max(0, ...Object.keys(entries).map(Number));
  for (let i = 0; i <= max; i++) {
    seg.push({
      v0: ORIGIN, v1: ORIGIN, isInserted: false, root0: 0, root1: 0, next: 0, prev: 0,
      ...entries[i],
    });
  }
  return seg;
}

describe("traverse_polygon childOrder — C branch-table transcription", () => {
  it("no u-neighbours, single d-neighbour: 'just traverse all neighbours' fallback (partition.c:419-426)", () => {
    const t = mkTrap({ u0: 0, u1: 0, d0: 5, d1: 0, lseg: 1, rseg: 2 });
    const seg = mkSegArray({});
    expect(traverseChildOrderForTest(t, seg, 0, TR_FROM_DN))
      .toEqual([[0, TR_FROM_DN], [0, TR_FROM_DN], [5, TR_FROM_UP], [0, TR_FROM_UP]]);
  });

  it("downward opening triangle, from === d1 (partition.c:406-411)", () => {
    const t = mkTrap({ u0: 0, u1: 0, d0: 5, d1: 7, lseg: 1, rseg: 2 });
    const seg = mkSegArray({});
    expect(traverseChildOrderForTest(t, seg, 7, TR_FROM_UP))
      .toEqual([[7, TR_FROM_UP], [5, TR_FROM_UP]]);
  });

  it("downward opening triangle, from !== d1 (partition.c:412-417)", () => {
    const t = mkTrap({ u0: 0, u1: 0, d0: 5, d1: 7, lseg: 1, rseg: 2 });
    const seg = mkSegArray({});
    expect(traverseChildOrderForTest(t, seg, 99, TR_FROM_UP))
      .toEqual([[5, TR_FROM_UP], [7, TR_FROM_UP]]);
  });

  it("upward opening triangle, from === u1 (partition.c:433-437)", () => {
    const t = mkTrap({ u0: 5, u1: 7, d0: 0, d1: 0, lseg: 1, rseg: 2 });
    const seg = mkSegArray({});
    expect(traverseChildOrderForTest(t, seg, 7, TR_FROM_DN))
      .toEqual([[7, TR_FROM_DN], [5, TR_FROM_DN]]);
  });

  it("downward+upward cusps, tie-break condition true (partition.c:460-468)", () => {
    const t = mkTrap({ u0: 5, u1: 7, d0: 9, d1: 11, lseg: 1, rseg: 2 });
    expect(traverseChildOrderForTest(t, mkSegArray({}), 11, TR_FROM_DN))
      .toEqual([[7, TR_FROM_DN], [11, TR_FROM_UP], [5, TR_FROM_DN], [9, TR_FROM_UP]]);
  });

  it("downward+upward cusps, tie-break condition false (partition.c:469-476)", () => {
    const t = mkTrap({ u0: 5, u1: 7, d0: 9, d1: 11, lseg: 1, rseg: 2 });
    expect(traverseChildOrderForTest(t, mkSegArray({}), 99, TR_FROM_DN))
      .toEqual([[5, TR_FROM_DN], [9, TR_FROM_UP], [7, TR_FROM_DN], [11, TR_FROM_UP]]);
  });

  it("only downward cusp, equal_to(lo, lseg.v1) true, dir=UP && u0===from (partition.c:484-491)", () => {
    const t = mkTrap({
      u0: 5, u1: 7, d0: 9, d1: 0, lseg: 1, rseg: 2, lo: { x: 10, y: 20 },
    });
    const seg = mkSegArray({ 1: { v1: { x: 10, y: 20 } } });
    expect(traverseChildOrderForTest(t, seg, 5, TR_FROM_UP))
      .toEqual([[5, TR_FROM_DN], [9, TR_FROM_UP], [7, TR_FROM_DN], [0, TR_FROM_UP]]);
  });

  it("only downward cusp, equal_to(lo, lseg.v1) true, else branch (partition.c:492-499)", () => {
    const t = mkTrap({
      u0: 5, u1: 7, d0: 9, d1: 0, lseg: 1, rseg: 2, lo: { x: 10, y: 20 },
    });
    const seg = mkSegArray({ 1: { v1: { x: 10, y: 20 } } });
    expect(traverseChildOrderForTest(t, seg, 99, TR_FROM_DN))
      .toEqual([[7, TR_FROM_DN], [9, TR_FROM_UP], [0, TR_FROM_UP], [5, TR_FROM_DN]]);
  });

  it("only upward cusp, equal_to(hi, lseg.v0) true, condition true (partition.c:529-536)", () => {
    const t = mkTrap({
      u0: 5, u1: 0, d0: 9, d1: 11, lseg: 1, rseg: 2, hi: { x: 30, y: 40 },
    });
    const seg = mkSegArray({ 1: { v0: { x: 30, y: 40 } } });
    expect(traverseChildOrderForTest(t, seg, 99, TR_FROM_UP))
      .toEqual([[0, TR_FROM_DN], [11, TR_FROM_UP], [5, TR_FROM_DN], [9, TR_FROM_UP]]);
  });

  it("no cusp, first split-point pair matches, dir=UP (partition.c:571-581)", () => {
    const t = mkTrap({
      u0: 5, u1: 0, d0: 9, d1: 0, lseg: 1, rseg: 2,
      hi: { x: 30, y: 40 }, lo: { x: 0, y: 0 },
    });
    const seg = mkSegArray({
      1: { v0: { x: 30, y: 40 } },
      2: { v0: { x: 0, y: 0 } },
    });
    expect(traverseChildOrderForTest(t, seg, 0, TR_FROM_UP))
      .toEqual([[5, TR_FROM_DN], [0, TR_FROM_DN], [0, TR_FROM_UP], [9, TR_FROM_UP]]);
  });

  it("no cusp, no split possible → fallback (partition.c:613-619)", () => {
    const t = mkTrap({
      u0: 5, u1: 0, d0: 9, d1: 0, lseg: 1, rseg: 2,
      hi: { x: 1, y: 1 }, lo: { x: 2, y: 2 },
    });
    const seg = mkSegArray({
      1: { v0: { x: 99, y: 99 }, v1: { x: 66, y: 66 } },
      2: { v0: { x: 88, y: 88 }, v1: { x: 77, y: 77 } },
    });
    expect(traverseChildOrderForTest(t, seg, 0, TR_FROM_UP))
      .toEqual([[5, TR_FROM_DN], [9, TR_FROM_UP], [0, TR_FROM_DN], [0, TR_FROM_UP]]);
  });
});
