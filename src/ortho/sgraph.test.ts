// SPDX-License-Identifier: EPL-2.0
/**
 * Oracle-pinned tests for the ortho search graph + Dijkstra shortPath.
 *
 * Ground truth captured from a tiny C harness linking prebuilt libortho.a +
 * libcgraph (zero C-tree modification), exercising lib/ortho/sgraph.c directly.
 *
 * @see lib/ortho/sgraph.c
 */

import { describe, it, expect } from "vitest";
import {
  createSGraph,
  createSNode,
  createSEdge,
  initSEdges,
  gsave,
  reset,
  shortPath,
} from "./sgraph.js";
import { pqGen } from "./fpq.js";
import type { SNode } from "./types.js";

/** Build the diamond fixture from the C harness:
 *  0-1(1) 0-2(4) 1-2(1) 1-3(5) 2-3(1). Shortest 0->3 = 0-1-2-3 (cost 3). */
function diamond() {
  const g = createSGraph(4);
  const n0 = createSNode(g);
  const n1 = createSNode(g);
  const n2 = createSNode(g);
  const n3 = createSNode(g);
  initSEdges(g, 4);
  createSEdge(g, n0, n1, 1.0);
  createSEdge(g, n0, n2, 4.0);
  createSEdge(g, n1, n2, 1.0);
  createSEdge(g, n1, n3, 5.0);
  createSEdge(g, n2, n3, 1.0);
  return { g, n0, n1, n2, n3 };
}

describe("sgraph — shortPath (C-oracle pinned)", () => {
  it("diamond 0->3: finalized n_val, n_dad, n_edge match C exactly", () => {
    // C: node{0,1,2,3} n_val={0,1,2,3} n_dad={-1,0,1,2} n_edge_wt={-,1,1,1}
    const { g, n0, n3 } = diamond();
    const pq = pqGen(g.nnodes + 2);
    const rc = shortPath(pq, g, n0, n3);
    expect(rc).toBe(0);

    // Map only the real nodes (initSEdges appends 2 dummy slots). Normalize -0:
    // C int 0*-1=0; JS float 0*-1=-0 (numerically identical) for the `from` node.
    const real = g.nodes.slice(0, g.nnodes);
    expect(real.map((s) => (s.nVal === 0 ? 0 : s.nVal))).toEqual([0, 1, 2, 3]);
    expect(real.map((s) => (s.nDad ? s.nDad.index : -1))).toEqual([-1, 0, 1, 2]);
    expect(real.map((s) => (s.nEdge ? s.nEdge.weight : -1))).toEqual([
      -1, 1, 1, 1,
    ]);
  });

  it("n_dad back-chain reconstructs the path 3->2->1->0 (cost 3)", () => {
    // C: path: 3 2 1 0
    const { g, n0, n3 } = diamond();
    shortPath(pqGen(g.nnodes + 2), g, n0, n3);
    const path: number[] = [];
    for (let p: SNode | null = n3; p !== null; p = p.nDad) path.push(p.index);
    expect(path).toEqual([3, 2, 1, 0]);
    expect(n3.nVal).toBe(3); // total weight of the min path
  });
});

describe("sgraph — gsave / reset (C-oracle pinned)", () => {
  it("reset restores nnodes/nedges to the gsave snapshot", () => {
    // C: gsave nnodes=3 nedges=1; after-mutate 4/2; after-reset 3/1
    const g = createSGraph(8);
    createSNode(g);
    createSNode(g);
    createSNode(g);
    initSEdges(g, 4);
    createSEdge(g, g.nodes[0], g.nodes[1], 1.0);
    gsave(g);
    expect([g.nnodes, g.nedges, g.saveNnodes, g.saveNedges]).toEqual([
      3, 1, 3, 1,
    ]);

    createSNode(g);
    createSEdge(g, g.nodes[1], g.nodes[2], 2.0);
    expect([g.nnodes, g.nedges]).toEqual([4, 2]);

    reset(g);
    expect([g.nnodes, g.nedges]).toEqual([3, 1]);
  });
});

describe("sgraph — shortPath relax truncates toward zero (2361 fix)", () => {
  it("finalizes a fractional-weight neighbor to the C int-truncated distance", () => {
    // C sgraph.c:142 `int d`; :165 `d = -(N_VAL(n)+E_WT(e))` truncates the sum
    // toward zero every relax step. weight=2.7 from a nVal=0 source: C computes
    // int d = -(0+2.7) = -2 (truncated toward zero), finalizes to n_val=2. A
    // double-accumulating port would finalize to 2.7 (or, with Math.floor,
    // wrongly to 3 — floor rounds away from zero for negatives).
    const g = createSGraph(2);
    const n0 = createSNode(g);
    const n1 = createSNode(g);
    initSEdges(g, 2);
    createSEdge(g, n0, n1, 2.7);
    const pq = pqGen(g.nnodes + 2);
    const rc = shortPath(pq, g, n0, n1);
    expect(rc).toBe(0);
    expect(n1.nVal).toBe(2);
  });

  it("two DIFFERENT-real-cost corridors truncate to the same integer distance", () => {
    // Per-step truncation (not a single truncation of the final float sum)
    // means two corridors with different real costs can still tie in the
    // integer distance C actually compares — this is the mechanism behind the
    // AC->IW 700.2/700.2 corridor tie in corpus 2361 (there the real costs
    // matched; here they deliberately don't, to isolate that truncation
    // — not equal input weights — is what produces the tie).
    //   corridor A: src-viaA(200.3) + viaA-dst(260.6), real sum 460.9
    //   corridor B: src-viaB(300.7) + viaB-dst(160.9), real sum 461.6
    // finalize(viaA)=200 (trunc(-200.3)), finalize(viaB)=300 (trunc(-300.7));
    // dst-via-A pending = trunc(-(200+260.6)) = -460;
    // dst-via-B pending = trunc(-(300+160.9)) = -460 — a true tie despite
    // differing real costs. viaA finalizes strictly before viaB (200 < 300,
    // not a queue tie), so viaA reaches dst first and, on the tie, keeps dad
    // (relax only overwrites on strict `adjn.nVal < d`).
    const g = createSGraph(4);
    const src = createSNode(g);
    const viaA = createSNode(g);
    const viaB = createSNode(g);
    const dst = createSNode(g);
    initSEdges(g, 4);
    createSEdge(g, src, viaA, 200.3);
    createSEdge(g, viaA, dst, 260.6);
    createSEdge(g, src, viaB, 300.7);
    createSEdge(g, viaB, dst, 160.9);
    const pq = pqGen(g.nnodes + 2);
    const rc = shortPath(pq, g, src, dst);
    expect(rc).toBe(0);
    expect(viaA.nVal).toBe(200);
    expect(viaB.nVal).toBe(300);
    expect(dst.nVal).toBe(460);
    // first-arrival tie-break: the strictly-earlier-finalized corridor (A)
    // keeps the dad link; B's equal-after-truncation relax does not overwrite.
    expect(dst.nDad).toBe(viaA);
  });
});

describe("sgraph — createSEdge wiring", () => {
  it("records endpoints by index and appends to both adjacency lists", () => {
    const g = createSGraph(2);
    const a = createSNode(g);
    const b = createSNode(g);
    initSEdges(g, 2);
    const e = createSEdge(g, a, b, 2.5);
    expect(e.v1).toBe(a.index);
    expect(e.v2).toBe(b.index);
    expect(e.weight).toBe(2.5);
    expect(a.adjEdgeList).toContain(0);
    expect(b.adjEdgeList).toContain(0);
    expect([a.nAdj, b.nAdj]).toEqual([1, 1]);
  });
});
