// SPDX-License-Identifier: EPL-2.0
/**
 * Oracle-pinned tests for the rawgraph adjacency graph + topological sort.
 *
 * Ground truth captured from a tiny C harness linking the prebuilt
 * `libortho.a` (zero C-tree modification), exercising
 * `lib/ortho/rawgraph.c` directly. Recipe:
 *   cc -I lib -I build -I build/lib h_rawgraph.c \
 *      build/lib/ortho/libortho.a build/lib/util/libutil.a -o h_rawgraph
 * The DFS reverse-finish-order topsort values below (esp. B_branch6's
 * v1=2, v2=1) are load-bearing — they are exactly the C dump.
 *
 * @see lib/ortho/rawgraph.c
 */

import { describe, it, expect } from "vitest";
import {
  makeGraph,
  insertEdge,
  removeRedge,
  edgeExists,
  topSort,
} from "./rawgraph.js";

describe("rawgraph — edge ops (C-oracle pinned)", () => {
  it("insertEdge is directed v1->v2; edgeExists tests that direction", () => {
    // C: edge_exists(0,1)=1 (1,0)=0 (1,2)=1 (0,2)=1
    const g = makeGraph(3);
    insertEdge(g, 0, 1);
    insertEdge(g, 1, 2);
    insertEdge(g, 0, 2);
    expect(edgeExists(g, 0, 1)).toBe(true);
    expect(edgeExists(g, 1, 0)).toBe(false);
    expect(edgeExists(g, 1, 2)).toBe(true);
    expect(edgeExists(g, 0, 2)).toBe(true);
  });

  it("insertEdge ignores duplicates (adj list unchanged)", () => {
    const g = makeGraph(3);
    insertEdge(g, 0, 1);
    insertEdge(g, 0, 1); // dup ignored by C insert_edge
    expect(g.vertices[0].adjList).toEqual([1]);
  });

  it("removeRedge removes an edge regardless of direction", () => {
    // C: C_remove edge_exists(0,1)=0 after remove_redge(1,0)
    const g = makeGraph(2);
    insertEdge(g, 0, 1);
    removeRedge(g, 1, 0);
    expect(edgeExists(g, 0, 1)).toBe(false);
  });
});

describe("rawgraph — top_sort (C-oracle pinned)", () => {
  it("A_triangle 0->1,1->2,0->2 matches C adj + topsort", () => {
    // C dump:
    //   v0 topsort=0 adj=[1,2]
    //   v1 topsort=1 adj=[2]
    //   v2 topsort=2 adj=[]
    const g = makeGraph(3);
    insertEdge(g, 0, 1);
    insertEdge(g, 1, 2);
    insertEdge(g, 0, 2);
    topSort(g);
    expect(g.vertices.map((v) => v.adjList)).toEqual([[1, 2], [2], []]);
    expect(g.vertices.map((v) => v.topsortOrder)).toEqual([0, 1, 2]);
  });

  it("B_branch6 matches C adj + DFS reverse-finish topsort exactly", () => {
    // C dump:
    //   v0 topsort=0 adj=[1,2]
    //   v1 topsort=2 adj=[3,4]
    //   v2 topsort=1 adj=[3,5]
    //   v3 topsort=3 adj=[4]
    //   v4 topsort=4 adj=[5]
    //   v5 topsort=5 adj=[]
    const g = makeGraph(6);
    insertEdge(g, 0, 1);
    insertEdge(g, 0, 2);
    insertEdge(g, 1, 3);
    insertEdge(g, 2, 3);
    insertEdge(g, 3, 4);
    insertEdge(g, 1, 4);
    insertEdge(g, 2, 5);
    insertEdge(g, 4, 5);
    topSort(g);
    expect(g.vertices.map((v) => v.adjList)).toEqual([
      [1, 2],
      [3, 4],
      [3, 5],
      [4],
      [5],
      [],
    ]);
    expect(g.vertices.map((v) => v.topsortOrder)).toEqual([0, 2, 1, 3, 4, 5]);
  });

  it("single-vertex graph: topsort_order = 0 (C n==1 fast path)", () => {
    const g = makeGraph(1);
    topSort(g);
    expect(g.vertices[0].topsortOrder).toBe(0);
  });

  it("topsort yields a valid topological order for the DAG", () => {
    const g = makeGraph(6);
    insertEdge(g, 0, 1);
    insertEdge(g, 0, 2);
    insertEdge(g, 1, 3);
    insertEdge(g, 2, 3);
    insertEdge(g, 3, 4);
    insertEdge(g, 1, 4);
    insertEdge(g, 2, 5);
    insertEdge(g, 4, 5);
    topSort(g);
    const ord = g.vertices.map((v) => v.topsortOrder);
    // every edge u->v must have ord[u] < ord[v]
    const edges: [number, number][] = [
      [0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [1, 4], [2, 5], [4, 5],
    ];
    for (const [u, v] of edges) expect(ord[u]).toBeLessThan(ord[v]);
  });
});
