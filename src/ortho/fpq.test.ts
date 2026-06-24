// SPDX-License-Identifier: EPL-2.0
/**
 * Oracle-pinned tests for the fPQ binary-heap priority queue.
 *
 * Ground truth captured from a tiny C harness linking prebuilt libortho.a +
 * libcgraph (zero C-tree modification), exercising lib/ortho/fPQ.c directly.
 *
 * Domain note: fPQ is a MAX-heap whose guard sentinel (index 0) has n_val=0,
 * which therefore acts as +infinity. The valid value domain is <= 0 — exactly
 * the negated distances shortPath stores. Feeding positive values makes
 * PQupheap never terminate (verified: the brief's [5,1,3,2,4] example violates
 * the invariant), so all fixtures below use negated values, as in real use.
 *
 * @see lib/ortho/fPQ.c
 */

import { describe, it, expect } from "vitest";
import { pqGen, pqInsert, pqRemove, pqUpdate } from "./fpq.js";
import type { Pq } from "./fpq.js";
import type { SNode } from "./types.js";

/** Build a bare SNode carrying a value and identifying index. */
function snode(nVal: number, index: number): SNode {
  return {
    nVal,
    nIdx: 0,
    nDad: null,
    nEdge: null,
    nAdj: 0,
    saveNAdj: 0,
    cells: [null, null],
    adjEdgeList: [],
    index,
    isVert: false,
    x: 0,
    y: 0,
  };
}

/** Insert each value (with its array index as identity), pop all, return
 *  the pop sequence as `[value, index]` pairs — mirrors the C harness dump. */
function insertThenDrain(vals: number[]): [number, number][] {
  const pq: Pq = pqGen(vals.length + 2);
  vals.forEach((v, i) => pqInsert(pq, snode(v, i)));
  const out: [number, number][] = [];
  let x: SNode | null;
  while ((x = pqRemove(pq)) !== null) out.push([x.nVal, x.index]);
  return out;
}

describe("fPQ — pop order (C-oracle pinned, negated domain)", () => {
  it("pq_basic [-5,-1,-3,-2,-4] pops max-first, identical to C", () => {
    // C: pq_basic pop: -1(i1) -2(i3) -3(i2) -4(i4) -5(i0)
    expect(insertThenDrain([-5, -1, -3, -2, -4])).toEqual([
      [-1, 1],
      [-2, 3],
      [-3, 2],
      [-4, 4],
      [-5, 0],
    ]);
  });

  it("pq_ties [-3,-3,-1,-3,-2,-3] reproduces C's exact tie order", () => {
    // C: pq_ties pop: -1(i2) -2(i4) -3(i1) -3(i3) -3(i0) -3(i5)
    // The order among the four -3 entries (i1,i3,i0,i5) is load-bearing:
    // it is the precise heap structure, not insertion order.
    expect(insertThenDrain([-3, -3, -1, -3, -2, -3])).toEqual([
      [-1, 2],
      [-2, 4],
      [-3, 1],
      [-3, 3],
      [-3, 0],
      [-3, 5],
    ]);
  });
});

describe("fPQ — PQupdate (C-oracle pinned)", () => {
  it("improving a node to 0 bubbles it to the top, matching C", () => {
    // Insert [-5,-1,-3,-2,-4]; PQupdate(node i0) -5 -> 0; then drain.
    // C: pq_update pop: 0(i0) -1(i1) -2(i3) -3(i2) -4(i4)
    const vals = [-5, -1, -3, -2, -4];
    const nodes = vals.map((v, i) => snode(v, i));
    const pq = pqGen(vals.length + 2);
    nodes.forEach((nd) => pqInsert(pq, nd));
    pqUpdate(pq, nodes[0], 0);
    const out: [number, number][] = [];
    let x: SNode | null;
    while ((x = pqRemove(pq)) !== null) out.push([x.nVal, x.index]);
    expect(out).toEqual([
      [0, 0],
      [-1, 1],
      [-2, 3],
      [-3, 2],
      [-4, 4],
    ]);
  });
});

describe("fPQ — empty queue", () => {
  it("pqRemove on an empty queue returns null", () => {
    const pq = pqGen(4);
    expect(pqRemove(pq)).toBeNull();
  });
});
