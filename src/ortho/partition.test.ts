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
import { partition, SEED } from "./partition.js";
import { srand48, drand48 } from "../common/random.js";
import type { Cell, OrthoBox } from "./types.js";

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
