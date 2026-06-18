// SPDX-License-Identifier: EPL-2.0
/**
 * Oracle-pinned tests for Seidel trapezoidal decomposition.
 *
 * Ground truth captured from a tiny C harness linking prebuilt libortho.a +
 * libcgraph (zero C-tree modification), calling construct_trapezoids directly
 * with an identity permute. Fixtures build segments exactly as
 * partition.c:store does (circular next/prev; v1 shared with the next v0).
 *
 * Serialized form uses tokens that erase the C-vs-JS sentinel printf gap:
 *   MAX  = unset trap index   (C SIZE_MAX  / TS Number.MAX_SAFE_INTEGER)
 *   INF  = +infinity y-bound  (C DBL_MAX   / TS Number.MAX_VALUE)
 *   -INF = -infinity y-bound
 *
 * @see lib/ortho/trapezoid.c:construct_trapezoids
 */

import { describe, it, expect } from "vitest";
import { constructTrapezoids, isValidTrap } from "./trapezoid.js";
import { TRAP_MAX } from "./trap-types.js";
import type { SegmentT, TrapT } from "./trap-types.js";
import type { SegPoint } from "./trap-types.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtCoord(x: number): string {
  if (x === Number.MAX_VALUE) return "INF";
  if (x === -Number.MAX_VALUE) return "-INF";
  return String(x);
}
function fmtIdx(v: number): string {
  return v === TRAP_MAX ? "MAX" : String(v);
}
function serialize(tr: TrapT[]): string[] {
  return tr.map((t, i) => {
    const hi = `(${fmtCoord(t.hi.x)},${fmtCoord(t.hi.y)})`;
    const lo = `(${fmtCoord(t.lo.x)},${fmtCoord(t.lo.y)})`;
    const links = `u0=${fmtIdx(t.u0)} u1=${fmtIdx(t.u1)} d0=${fmtIdx(t.d0)} d1=${fmtIdx(t.d1)}`;
    return (
      `t${i} valid=${t.isValid ? 1 : 0} lseg=${t.lseg} rseg=${t.rseg} ` +
      `hi=${hi} lo=${lo} ${links} ` +
      `sink=${fmtIdx(t.sink)} usave=${fmtIdx(t.usave)} uside=${t.uside}`
    );
  });
}

/** Closed polygon: seg[1..n], index 0 dummy. Mirrors partition.c:store. */
function buildPoly(points: SegPoint[]): SegmentT[] {
  const n = points.length;
  const seg: SegmentT[] = [];
  for (let i = 0; i <= n; i++) {
    seg.push({ v0: { x: 0, y: 0 }, v1: { x: 0, y: 0 }, isInserted: false, root0: 0, root1: 0, next: 0, prev: 0 });
  }
  for (let i = 1; i <= n; i++) {
    seg[i].next = i === n ? 1 : i + 1;
    seg[i].prev = i === 1 ? n : i - 1;
  }
  for (let i = 1; i <= n; i++) {
    seg[i].v0 = { ...points[i - 1] };
    seg[seg[i].prev].v1 = { ...points[i - 1] };
  }
  return seg;
}

/** Single open segment fixture (degenerate, not a closed polygon). */
function buildOneSeg(): SegmentT[] {
  const seg: SegmentT[] = [
    { v0: { x: 0, y: 0 }, v1: { x: 0, y: 0 }, isInserted: false, root0: 0, root1: 0, next: 0, prev: 0 },
    { v0: { x: 0, y: 0 }, v1: { x: 2, y: 4 }, isInserted: false, root0: 0, root1: 0, next: 1, prev: 1 },
  ];
  return seg;
}

function identity(nseg: number): number[] {
  return Array.from({ length: nseg }, (_, i) => i + 1);
}

// ─── expected C dumps (token form) ───────────────────────────────────────────

const EXPECT_ONE_SEG = [
  "t0 valid=0 lseg=0 rseg=0 hi=(0,0) lo=(0,0) u0=0 u1=0 d0=0 d1=0 sink=0 usave=0 uside=0",
  "t1 valid=1 lseg=0 rseg=1 hi=(2,4) lo=(0,0) u0=4 u1=0 d0=3 d1=0 sink=5 usave=0 uside=0",
  "t2 valid=1 lseg=1 rseg=0 hi=(2,4) lo=(0,0) u0=4 u1=0 d0=3 d1=0 sink=6 usave=0 uside=0",
  "t3 valid=1 lseg=0 rseg=0 hi=(0,0) lo=(-INF,-INF) u0=1 u1=2 d0=0 d1=0 sink=3 usave=0 uside=0",
  "t4 valid=1 lseg=0 rseg=0 hi=(INF,INF) lo=(2,4) u0=0 u1=0 d0=1 d1=2 sink=1 usave=0 uside=0",
];

const EXPECT_TRIANGLE = [
  "t0 valid=0 lseg=0 rseg=0 hi=(0,0) lo=(0,0) u0=0 u1=0 d0=0 d1=0 sink=0 usave=0 uside=0",
  "t1 valid=0 lseg=0 rseg=3 hi=(4,0) lo=(0,0) u0=5 u1=MAX d0=3 d1=0 sink=13 usave=0 uside=0",
  "t2 valid=1 lseg=1 rseg=0 hi=(4,0) lo=(0,0) u0=6 u1=MAX d0=3 d1=0 sink=6 usave=0 uside=0",
  "t3 valid=1 lseg=0 rseg=0 hi=(0,0) lo=(-INF,-INF) u0=5 u1=2 d0=0 d1=0 sink=3 usave=0 uside=0",
  "t4 valid=1 lseg=0 rseg=0 hi=(INF,INF) lo=(2,4) u0=0 u1=0 d0=5 d1=6 sink=7 usave=0 uside=0",
  "t5 valid=1 lseg=0 rseg=3 hi=(2,4) lo=(0,0) u0=4 u1=MAX d0=3 d1=0 sink=11 usave=0 uside=0",
  "t6 valid=1 lseg=2 rseg=0 hi=(2,4) lo=(4,0) u0=4 u1=0 d0=2 d1=MAX sink=10 usave=0 uside=0",
  "t7 valid=1 lseg=3 rseg=2 hi=(2,4) lo=(4,0) u0=MAX u1=MAX d0=8 d1=MAX sink=12 usave=0 uside=0",
  "t8 valid=1 lseg=3 rseg=1 hi=(4,0) lo=(0,0) u0=7 u1=MAX d0=MAX d1=MAX sink=14 usave=0 uside=0",
];

const EXPECT_RECTANGLE = [
  "t0 valid=0 lseg=0 rseg=0 hi=(0,0) lo=(0,0) u0=0 u1=0 d0=0 d1=0 sink=0 usave=0 uside=0",
  "t1 valid=0 lseg=0 rseg=4 hi=(6,0) lo=(0,0) u0=7 u1=MAX d0=3 d1=0 sink=17 usave=0 uside=0",
  "t2 valid=1 lseg=1 rseg=0 hi=(6,0) lo=(0,0) u0=6 u1=MAX d0=3 d1=0 sink=6 usave=0 uside=0",
  "t3 valid=1 lseg=0 rseg=0 hi=(0,0) lo=(-INF,-INF) u0=7 u1=2 d0=0 d1=0 sink=3 usave=0 uside=0",
  "t4 valid=1 lseg=0 rseg=0 hi=(INF,INF) lo=(6,3) u0=0 u1=0 d0=5 d1=6 sink=7 usave=0 uside=0",
  "t5 valid=1 lseg=0 rseg=3 hi=(6,3) lo=(0,3) u0=4 u1=MAX d0=7 d1=0 sink=13 usave=0 uside=0",
  "t6 valid=1 lseg=2 rseg=0 hi=(6,3) lo=(6,0) u0=4 u1=0 d0=2 d1=MAX sink=10 usave=0 uside=0",
  "t7 valid=1 lseg=0 rseg=4 hi=(0,3) lo=(0,0) u0=5 u1=MAX d0=3 d1=0 sink=15 usave=0 uside=0",
  "t8 valid=1 lseg=3 rseg=2 hi=(6,3) lo=(0,3) u0=MAX u1=MAX d0=9 d1=0 sink=14 usave=0 uside=0",
  "t9 valid=1 lseg=4 rseg=2 hi=(0,3) lo=(6,0) u0=8 u1=MAX d0=10 d1=MAX sink=16 usave=0 uside=0",
  "t10 valid=1 lseg=4 rseg=1 hi=(6,0) lo=(0,0) u0=9 u1=MAX d0=MAX d1=MAX sink=18 usave=0 uside=0",
];

// ─── tests ───────────────────────────────────────────────────────────────────

describe("trapezoid — construct_trapezoids (C-oracle pinned, identity permute)", () => {
  it("one segment: full trap table byte-matches C", () => {
    const tr = constructTrapezoids(1, buildOneSeg(), identity(1));
    expect(serialize(tr)).toEqual(EXPECT_ONE_SEG);
  });

  it("triangle (3 segments): full trap table byte-matches C", () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 4 }];
    const tr = constructTrapezoids(3, buildPoly(pts), identity(3));
    expect(serialize(tr)).toEqual(EXPECT_TRIANGLE);
  });

  it("rectangle (4 segments): full trap table byte-matches C", () => {
    const pts = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 0, y: 3 }];
    const tr = constructTrapezoids(4, buildPoly(pts), identity(4));
    expect(serialize(tr)).toEqual(EXPECT_RECTANGLE);
  });
});

describe("trapezoid — determinism + sentinels", () => {
  it("identical inputs produce identical output (ADR-3)", () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 4 }];
    const a = serialize(constructTrapezoids(3, buildPoly(pts), identity(3)));
    const b = serialize(constructTrapezoids(3, buildPoly(pts), identity(3)));
    expect(a).toEqual(b);
  });

  it("isValidTrap: 0 and SIZE_MAX are invalid, 1 is valid", () => {
    expect(isValidTrap(0)).toBe(false);
    expect(isValidTrap(TRAP_MAX)).toBe(false);
    expect(isValidTrap(Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(isValidTrap(1)).toBe(true);
  });
});
