// SPDX-License-Identifier: EPL-2.0

/**
 * Oracle-pin test for the ortho routing stage — P2, T3.
 *
 * Ground truth captured from instrumented native graphviz `dot` (gvmine
 * oracle, ADR-1): `ortho.c:attachOrthoEdges` was instrumented to dump, per
 * edge, the tail/head node coords + ports, p1/q1, every route segment
 * (isVert, comm_coord, p1/p2, track_no, vtrack/htrack value), and the full
 * installed orthogonal point list (`ispline`). C reverted after mint.
 *
 * The TS `OrthoGraph` is built from the C-dumped gcell bbs (ADR-2); node
 * centres equal `ND_coord` (ports are 0 for these edges), so `orthoEdges`
 * reproduces C's maze + routing. Routes are compared EXACTLY (acceptance:
 * routing is deterministic given the maze).
 *
 * @see lib/ortho/ortho.c:orthoEdges, attachOrthoEdges, convertSPtoRoute,
 *      assignSegs, assignTracks, vtrack, htrack
 */

import { describe, it, expect } from "vitest";
import { orthoEdges } from "./index.js";
import type { OrthoGraph, OrthoEdge, OrthoPoint, ClipAndInstallFn } from "./index.js";
import type { OrthoNode } from "./types.js";

function node(LLx: number, LLy: number, URx: number, URy: number): OrthoNode {
  return { bb: { LL: { x: LLx, y: LLy }, UR: { x: URx, y: URy } } };
}

/** Centre of a node bb — equals C ND_coord for these fixtures (port 0). */
function centre(n: OrthoNode): { x: number; y: number } {
  return {
    x: (n.bb.LL.x + n.bb.UR.x) / 2,
    y: (n.bb.LL.y + n.bb.UR.y) / 2,
  };
}

function ptList(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

interface EdgeExpect {
  tail: number; // node index
  head: number;
  pts: [number, number][]; // C ispline points (exact)
}

interface RouteFixture {
  name: string;
  nodes: OrthoNode[];
  edges: [number, number][]; // [tailIdx, headIdx]
  expect: EdgeExpect[];
}

// --- C-dumped fixtures (R3 dump from instrumented native dot) -----------------

const FIXTURES: RouteFixture[] = [
  {
    name: "f2pair: a -> b",
    nodes: [node(-27, 72, 27, 108), node(-27, 0, 27, 36)],
    edges: [[0, 1]],
    expect: [
      { tail: 0, head: 1, pts: [[0, 90], [0, 90], [0, 18], [0, 18]] },
    ],
  },
  {
    name: "f3chain: a -> b -> c",
    nodes: [node(-27, 144, 27, 180), node(-27, 72, 27, 108), node(-27, 0, 27, 36)],
    edges: [[0, 1], [1, 2]],
    expect: [
      { tail: 0, head: 1, pts: [[0, 162], [0, 162], [0, 90], [0, 90]] },
      { tail: 1, head: 2, pts: [[0, 90], [0, 90], [0, 18], [0, 18]] },
    ],
  },
  {
    name: "f3branch: a -> b, a -> c",
    nodes: [node(-27, 72, 27, 108), node(-63, 0, -9, 36), node(9, 0, 63, 36)],
    edges: [[0, 1], [0, 2]],
    expect: [
      { tail: 0, head: 1, pts: [[-18, 90], [-18, 90], [-18, 18], [-18, 18]] },
      { tail: 0, head: 2, pts: [[18, 90], [18, 90], [18, 18], [18, 18]] },
    ],
  },
];

function mkGraph(fx: RouteFixture): { g: OrthoGraph; edges: OrthoEdge[] } {
  const edges: OrthoEdge[] = fx.edges.map(([t, h]) => ({
    tail: fx.nodes[t]!,
    head: fx.nodes[h]!,
  }));
  return { g: { nodes: fx.nodes, edges }, edges };
}

/** Run orthoEdges, capturing route points keyed by (tail centre|head centre). */
function route(fx: RouteFixture): Map<string, OrthoPoint[]> {
  const { g } = mkGraph(fx);
  const got = new Map<string, OrthoPoint[]>();
  const capture: ClipAndInstallFn = (_g, e, path) => {
    const k = `${ptList([centre(e.tail)])}->${ptList([centre(e.head)])}`;
    got.set(k, path.map((p) => ({ x: p.x, y: p.y })));
  };
  orthoEdges(g, false, capture);
  return got;
}

describe("ortho routing — oracle-pinned vs native C", () => {
  for (const fx of FIXTURES) {
    describe(fx.name, () => {
      it("installs the exact C route point list for every edge", () => {
        const got = route(fx);
        expect(got.size).toBe(fx.expect.length);
        for (const ex of fx.expect) {
          const k =
            `${ptList([centre(fx.nodes[ex.tail]!)])}->` +
            `${ptList([centre(fx.nodes[ex.head]!)])}`;
          const gotPts = got.get(k);
          expect(gotPts, `route for edge ${ex.tail}->${ex.head}`).toBeDefined();
          const want = ex.pts.map(([x, y]) => ({ x, y }));
          expect(ptList(gotPts!)).toBe(ptList(want));
        }
      });

      it("is deterministic run-to-run", () => {
        const a = route(fx);
        const b = route(fx);
        const keys = [...a.keys()].sort();
        expect(keys).toEqual([...b.keys()].sort());
        for (const k of keys) expect(ptList(a.get(k)!)).toBe(ptList(b.get(k)!));
      });
    });
  }
});
