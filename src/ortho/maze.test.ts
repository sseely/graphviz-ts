// SPDX-License-Identifier: EPL-2.0

/**
 * Oracle-pin test for maze.ts (mkMaze) — ortho P2, T2.
 *
 * Ground truth captured from instrumented native graphviz `dot` (gvmine
 * oracle, ADR-1): `maze.c:mkMazeGraph` was instrumented to dump, for each
 * `splines=ortho` fixture, the search graph after `gsave`: ncells, ngcells,
 * sg.nnodes, sg.nedges, every snode's `isVert` + the bbs of its two linked
 * cells (cells[0]=left/bottom, cells[1]=top/right), and every sedge's
 * v1/v2/weight. C reverted after mint.
 *
 * The TS `OrthoGraph` is built from the C-dumped gcell bbs (ADR-2): `nodeBb`
 * is idempotent on these (width/height >= 2), so the gcells reproduced by
 * `mkMaze` match C exactly, isolating maze logic from layout.
 *
 * Comparison is order-normalized (T2 acceptance): the maze graph is
 * geometry-determined, so snode/sedge indices differ from C (TS partition
 * emits rects in flood-fill order, not C's DFS order — decision journal T1
 * ORDER RISK), but the SETS must match. Each snode is keyed by
 * (isVert, cells[0].bb, cells[1].bb) — unique per boundary — and each sedge
 * by its two endpoint node-keys (sorted) + weight.
 *
 * @see lib/ortho/maze.c:mkMaze, mkMazeGraph
 */

import { describe, it, expect } from "vitest";
import { mkMaze } from "./maze.js";
import type { OrthoGraph, OrthoBox, SNode, SEdge, Cell } from "./types.js";

// --- C-dumped oracle (raw M2 lines from instrumented native dot) -------------

const F2PAIR_DUMP = `
M2 ncells 13 ngcells 2 nnodes 22 nedges 34
M2 node 0 isVert 1 c0 -63 -36 -27 0 c1 -27 -36 27 0
M2 node 1 isVert 0 c0 -63 -36 -27 0 c1 -63 0 -27 36
M2 node 2 isVert 1 c0 -63 0 -27 36 c1 -27 0 27 36
M2 node 3 isVert 0 c0 -63 0 -27 36 c1 -63 36 -27 72
M2 node 4 isVert 1 c0 -63 36 -27 72 c1 -27 36 27 72
M2 node 5 isVert 0 c0 -63 36 -27 72 c1 -63 72 -27 108
M2 node 6 isVert 1 c0 -63 72 -27 108 c1 -27 72 27 108
M2 node 7 isVert 0 c0 -63 72 -27 108 c1 -63 108 -27 144
M2 node 8 isVert 1 c0 -63 108 -27 144 c1 -27 108 27 144
M2 node 9 isVert 1 c0 -27 108 27 144 c1 27 108 63 144
M2 node 10 isVert 0 c0 -27 72 27 108 c1 -27 108 27 144
M2 node 11 isVert 0 c0 27 -36 63 0 c1 27 0 63 36
M2 node 12 isVert 1 c0 -27 -36 27 0 c1 27 -36 63 0
M2 node 13 isVert 0 c0 27 36 63 72 c1 27 72 63 108
M2 node 14 isVert 1 c0 -27 36 27 72 c1 27 36 63 72
M2 node 15 isVert 0 c0 27 0 63 36 c1 27 36 63 72
M2 node 16 isVert 0 c0 27 72 63 108 c1 27 108 63 144
M2 node 17 isVert 1 c0 -27 72 27 108 c1 27 72 63 108
M2 node 18 isVert 1 c0 -27 0 27 36 c1 27 0 63 36
M2 node 19 isVert 0 c0 -27 -36 27 0 c1 -27 0 27 36
M2 node 20 isVert 0 c0 -27 36 27 72 c1 -27 72 27 108
M2 node 21 isVert 0 c0 -27 0 27 36 c1 -27 36 27 72
M2 edge 0 v1 1 v2 0 wt 536
M2 edge 1 v1 3 v2 2 wt 536
M2 edge 2 v1 1 v2 2 wt 536
M2 edge 3 v1 3 v2 1 wt 36
M2 edge 4 v1 5 v2 4 wt 536
M2 edge 5 v1 3 v2 4 wt 536
M2 edge 6 v1 5 v2 3 wt 36
M2 edge 7 v1 7 v2 6 wt 536
M2 edge 8 v1 5 v2 6 wt 536
M2 edge 9 v1 7 v2 5 wt 36
M2 edge 10 v1 7 v2 8 wt 536
M2 edge 11 v1 8 v2 10 wt 545
M2 edge 12 v1 10 v2 9 wt 545
M2 edge 13 v1 8 v2 9 wt 54
M2 edge 14 v1 12 v2 11 wt 536
M2 edge 15 v1 14 v2 13 wt 536
M2 edge 16 v1 14 v2 15 wt 536
M2 edge 17 v1 13 v2 15 wt 36
M2 edge 18 v1 9 v2 16 wt 536
M2 edge 19 v1 17 v2 16 wt 536
M2 edge 20 v1 17 v2 13 wt 536
M2 edge 21 v1 16 v2 13 wt 36
M2 edge 22 v1 18 v2 15 wt 536
M2 edge 23 v1 18 v2 11 wt 536
M2 edge 24 v1 15 v2 11 wt 36
M2 edge 25 v1 0 v2 19 wt 545
M2 edge 26 v1 19 v2 12 wt 545
M2 edge 27 v1 0 v2 12 wt 54
M2 edge 28 v1 4 v2 20 wt 545
M2 edge 29 v1 20 v2 14 wt 545
M2 edge 30 v1 4 v2 21 wt 545
M2 edge 31 v1 21 v2 14 wt 545
M2 edge 32 v1 20 v2 21 wt 36
M2 edge 33 v1 4 v2 14 wt 54
`;
const F3CHAIN_DUMP = `
M2 ncells 18 ngcells 3 nnodes 32 nedges 52
M2 node 0 isVert 0 c0 27 -36 63 0 c1 27 0 63 36
M2 node 1 isVert 1 c0 -27 -36 27 0 c1 27 -36 63 0
M2 node 2 isVert 0 c0 27 36 63 72 c1 27 72 63 108
M2 node 3 isVert 1 c0 -27 36 27 72 c1 27 36 63 72
M2 node 4 isVert 0 c0 27 0 63 36 c1 27 36 63 72
M2 node 5 isVert 0 c0 27 108 63 144 c1 27 144 63 180
M2 node 6 isVert 1 c0 -27 108 27 144 c1 27 108 63 144
M2 node 7 isVert 0 c0 27 72 63 108 c1 27 108 63 144
M2 node 8 isVert 1 c0 -27 180 27 216 c1 27 180 63 216
M2 node 9 isVert 0 c0 27 144 63 180 c1 27 180 63 216
M2 node 10 isVert 1 c0 -27 144 27 180 c1 27 144 63 180
M2 node 11 isVert 1 c0 -27 72 27 108 c1 27 72 63 108
M2 node 12 isVert 1 c0 -27 0 27 36 c1 27 0 63 36
M2 node 13 isVert 0 c0 -27 -36 27 0 c1 -27 0 27 36
M2 node 14 isVert 1 c0 -63 -36 -27 0 c1 -27 -36 27 0
M2 node 15 isVert 0 c0 -63 -36 -27 0 c1 -63 0 -27 36
M2 node 16 isVert 1 c0 -63 0 -27 36 c1 -27 0 27 36
M2 node 17 isVert 0 c0 -63 0 -27 36 c1 -63 36 -27 72
M2 node 18 isVert 1 c0 -63 36 -27 72 c1 -27 36 27 72
M2 node 19 isVert 0 c0 -63 36 -27 72 c1 -63 72 -27 108
M2 node 20 isVert 1 c0 -63 72 -27 108 c1 -27 72 27 108
M2 node 21 isVert 0 c0 -63 72 -27 108 c1 -63 108 -27 144
M2 node 22 isVert 1 c0 -63 108 -27 144 c1 -27 108 27 144
M2 node 23 isVert 0 c0 -63 108 -27 144 c1 -63 144 -27 180
M2 node 24 isVert 1 c0 -63 144 -27 180 c1 -27 144 27 180
M2 node 25 isVert 0 c0 -63 144 -27 180 c1 -63 180 -27 216
M2 node 26 isVert 1 c0 -63 180 -27 216 c1 -27 180 27 216
M2 node 27 isVert 0 c0 -27 144 27 180 c1 -27 180 27 216
M2 node 28 isVert 0 c0 -27 36 27 72 c1 -27 72 27 108
M2 node 29 isVert 0 c0 -27 0 27 36 c1 -27 36 27 72
M2 node 30 isVert 0 c0 -27 108 27 144 c1 -27 144 27 180
M2 node 31 isVert 0 c0 -27 72 27 108 c1 -27 108 27 144
M2 edge 0 v1 1 v2 0 wt 536
M2 edge 1 v1 3 v2 2 wt 536
M2 edge 2 v1 3 v2 4 wt 536
M2 edge 3 v1 2 v2 4 wt 36
M2 edge 4 v1 6 v2 5 wt 536
M2 edge 5 v1 6 v2 7 wt 536
M2 edge 6 v1 5 v2 7 wt 36
M2 edge 7 v1 8 v2 9 wt 536
M2 edge 8 v1 10 v2 9 wt 536
M2 edge 9 v1 10 v2 5 wt 536
M2 edge 10 v1 9 v2 5 wt 36
M2 edge 11 v1 11 v2 7 wt 536
M2 edge 12 v1 11 v2 2 wt 536
M2 edge 13 v1 7 v2 2 wt 36
M2 edge 14 v1 12 v2 4 wt 536
M2 edge 15 v1 12 v2 0 wt 536
M2 edge 16 v1 4 v2 0 wt 36
M2 edge 17 v1 14 v2 13 wt 545
M2 edge 18 v1 13 v2 1 wt 545
M2 edge 19 v1 14 v2 1 wt 54
M2 edge 20 v1 15 v2 14 wt 536
M2 edge 21 v1 17 v2 16 wt 536
M2 edge 22 v1 15 v2 16 wt 536
M2 edge 23 v1 17 v2 15 wt 36
M2 edge 24 v1 19 v2 18 wt 536
M2 edge 25 v1 17 v2 18 wt 536
M2 edge 26 v1 19 v2 17 wt 36
M2 edge 27 v1 21 v2 20 wt 536
M2 edge 28 v1 19 v2 20 wt 536
M2 edge 29 v1 21 v2 19 wt 36
M2 edge 30 v1 23 v2 22 wt 536
M2 edge 31 v1 21 v2 22 wt 536
M2 edge 32 v1 23 v2 21 wt 36
M2 edge 33 v1 25 v2 24 wt 536
M2 edge 34 v1 23 v2 24 wt 536
M2 edge 35 v1 25 v2 23 wt 36
M2 edge 36 v1 25 v2 26 wt 536
M2 edge 37 v1 26 v2 27 wt 545
M2 edge 38 v1 27 v2 8 wt 545
M2 edge 39 v1 26 v2 8 wt 54
M2 edge 40 v1 18 v2 28 wt 545
M2 edge 41 v1 28 v2 3 wt 545
M2 edge 42 v1 18 v2 29 wt 545
M2 edge 43 v1 29 v2 3 wt 545
M2 edge 44 v1 28 v2 29 wt 36
M2 edge 45 v1 18 v2 3 wt 54
M2 edge 46 v1 22 v2 30 wt 545
M2 edge 47 v1 30 v2 6 wt 545
M2 edge 48 v1 22 v2 31 wt 545
M2 edge 49 v1 31 v2 6 wt 545
M2 edge 50 v1 30 v2 31 wt 36
M2 edge 51 v1 22 v2 6 wt 54
`;
const F3BRANCH_DUMP = `
M2 ncells 24 ngcells 3 nnodes 46 nedges 88
M2 node 0 isVert 0 c0 63 -36 99 0 c1 63 0 99 36
M2 node 1 isVert 1 c0 9 -36 63 0 c1 63 -36 99 0
M2 node 2 isVert 0 c0 63 36 99 72 c1 63 72 99 108
M2 node 3 isVert 1 c0 27 36 63 72 c1 63 36 99 72
M2 node 4 isVert 0 c0 63 0 99 36 c1 63 36 99 72
M2 node 5 isVert 1 c0 27 108 63 144 c1 63 108 99 144
M2 node 6 isVert 0 c0 63 72 99 108 c1 63 108 99 144
M2 node 7 isVert 1 c0 27 72 63 108 c1 63 72 99 108
M2 node 8 isVert 1 c0 9 0 63 36 c1 63 0 99 36
M2 node 9 isVert 0 c0 9 -36 63 0 c1 9 0 63 36
M2 node 10 isVert 1 c0 -9 -36 9 0 c1 9 -36 63 0
M2 node 11 isVert 0 c0 -9 -36 9 0 c1 -9 0 9 36
M2 node 12 isVert 1 c0 -63 -36 -9 0 c1 -9 -36 9 0
M2 node 13 isVert 1 c0 -9 36 9 72 c1 9 36 27 72
M2 node 14 isVert 0 c0 -9 36 9 72 c1 -27 72 27 108
M2 node 15 isVert 1 c0 -27 36 -9 72 c1 -9 36 9 72
M2 node 16 isVert 0 c0 -9 0 9 36 c1 -9 36 9 72
M2 node 17 isVert 1 c0 -9 0 9 36 c1 9 0 63 36
M2 node 18 isVert 1 c0 -63 0 -9 36 c1 -9 0 9 36
M2 node 19 isVert 0 c0 -63 -36 -9 0 c1 -63 0 -9 36
M2 node 20 isVert 1 c0 -99 -36 -63 0 c1 -63 -36 -9 0
M2 node 21 isVert 0 c0 -99 -36 -63 0 c1 -99 0 -63 36
M2 node 22 isVert 1 c0 -99 0 -63 36 c1 -63 0 -9 36
M2 node 23 isVert 0 c0 -99 0 -63 36 c1 -99 36 -63 72
M2 node 24 isVert 1 c0 -99 36 -63 72 c1 -63 36 -27 72
M2 node 25 isVert 0 c0 -99 36 -63 72 c1 -99 72 -63 108
M2 node 26 isVert 1 c0 -99 72 -63 108 c1 -63 72 -27 108
M2 node 27 isVert 0 c0 -99 72 -63 108 c1 -99 108 -63 144
M2 node 28 isVert 1 c0 -99 108 -63 144 c1 -63 108 -27 144
M2 node 29 isVert 1 c0 -63 36 -27 72 c1 -27 36 -9 72
M2 node 30 isVert 0 c0 -63 36 -27 72 c1 -63 72 -27 108
M2 node 31 isVert 0 c0 -63 0 -9 36 c1 -63 36 -27 72
M2 node 32 isVert 1 c0 -63 72 -27 108 c1 -27 72 27 108
M2 node 33 isVert 0 c0 -63 72 -27 108 c1 -63 108 -27 144
M2 node 34 isVert 1 c0 -63 108 -27 144 c1 -27 108 27 144
M2 node 35 isVert 1 c0 -27 108 27 144 c1 27 108 63 144
M2 node 36 isVert 0 c0 -27 72 27 108 c1 -27 108 27 144
M2 node 37 isVert 0 c0 27 36 63 72 c1 27 72 63 108
M2 node 38 isVert 1 c0 9 36 27 72 c1 27 36 63 72
M2 node 39 isVert 0 c0 9 0 63 36 c1 27 36 63 72
M2 node 40 isVert 0 c0 27 72 63 108 c1 27 108 63 144
M2 node 41 isVert 1 c0 -27 72 27 108 c1 27 72 63 108
M2 node 42 isVert 0 c0 9 36 27 72 c1 -27 72 27 108
M2 node 43 isVert 0 c0 9 0 63 36 c1 9 36 27 72
M2 node 44 isVert 0 c0 -27 36 -9 72 c1 -27 72 27 108
M2 node 45 isVert 0 c0 -63 0 -9 36 c1 -27 36 -9 72
M2 edge 0 v1 1 v2 0 wt 536
M2 edge 1 v1 3 v2 2 wt 536
M2 edge 2 v1 3 v2 4 wt 536
M2 edge 3 v1 2 v2 4 wt 36
M2 edge 4 v1 5 v2 6 wt 536
M2 edge 5 v1 7 v2 6 wt 536
M2 edge 6 v1 7 v2 2 wt 536
M2 edge 7 v1 6 v2 2 wt 36
M2 edge 8 v1 8 v2 4 wt 536
M2 edge 9 v1 8 v2 0 wt 536
M2 edge 10 v1 4 v2 0 wt 36
M2 edge 11 v1 10 v2 9 wt 545
M2 edge 12 v1 9 v2 1 wt 545
M2 edge 13 v1 10 v2 1 wt 54
M2 edge 14 v1 12 v2 11 wt 527
M2 edge 15 v1 11 v2 10 wt 527
M2 edge 16 v1 12 v2 10 wt 18
M2 edge 17 v1 15 v2 14 wt 527
M2 edge 18 v1 14 v2 13 wt 527
M2 edge 19 v1 15 v2 16 wt 527
M2 edge 20 v1 16 v2 13 wt 527
M2 edge 21 v1 14 v2 16 wt 36
M2 edge 22 v1 15 v2 13 wt 18
M2 edge 23 v1 18 v2 16 wt 527
M2 edge 24 v1 16 v2 17 wt 527
M2 edge 25 v1 18 v2 11 wt 527
M2 edge 26 v1 11 v2 17 wt 527
M2 edge 27 v1 16 v2 11 wt 36
M2 edge 28 v1 18 v2 17 wt 18
M2 edge 29 v1 20 v2 19 wt 545
M2 edge 30 v1 19 v2 12 wt 545
M2 edge 31 v1 20 v2 12 wt 54
M2 edge 32 v1 21 v2 20 wt 536
M2 edge 33 v1 23 v2 22 wt 536
M2 edge 34 v1 21 v2 22 wt 536
M2 edge 35 v1 23 v2 21 wt 36
M2 edge 36 v1 25 v2 24 wt 536
M2 edge 37 v1 23 v2 24 wt 536
M2 edge 38 v1 25 v2 23 wt 36
M2 edge 39 v1 27 v2 26 wt 536
M2 edge 40 v1 25 v2 26 wt 536
M2 edge 41 v1 27 v2 25 wt 36
M2 edge 42 v1 27 v2 28 wt 536
M2 edge 43 v1 24 v2 30 wt 536
M2 edge 44 v1 30 v2 29 wt 536
M2 edge 45 v1 24 v2 31 wt 536
M2 edge 46 v1 31 v2 29 wt 536
M2 edge 47 v1 30 v2 31 wt 36
M2 edge 48 v1 24 v2 29 wt 36
M2 edge 49 v1 26 v2 33 wt 536
M2 edge 50 v1 33 v2 32 wt 536
M2 edge 51 v1 26 v2 30 wt 536
M2 edge 52 v1 30 v2 32 wt 536
M2 edge 53 v1 33 v2 30 wt 36
M2 edge 54 v1 26 v2 32 wt 36
M2 edge 55 v1 28 v2 33 wt 536
M2 edge 56 v1 33 v2 34 wt 536
M2 edge 57 v1 28 v2 34 wt 36
M2 edge 58 v1 34 v2 36 wt 545
M2 edge 59 v1 36 v2 35 wt 545
M2 edge 60 v1 34 v2 35 wt 54
M2 edge 61 v1 38 v2 37 wt 536
M2 edge 62 v1 37 v2 3 wt 536
M2 edge 63 v1 38 v2 39 wt 536
M2 edge 64 v1 39 v2 3 wt 536
M2 edge 65 v1 37 v2 39 wt 36
M2 edge 66 v1 38 v2 3 wt 36
M2 edge 67 v1 35 v2 40 wt 536
M2 edge 68 v1 40 v2 5 wt 536
M2 edge 69 v1 35 v2 5 wt 36
M2 edge 70 v1 41 v2 40 wt 536
M2 edge 71 v1 40 v2 7 wt 536
M2 edge 72 v1 41 v2 37 wt 536
M2 edge 73 v1 37 v2 7 wt 536
M2 edge 74 v1 40 v2 37 wt 36
M2 edge 75 v1 41 v2 7 wt 36
M2 edge 76 v1 13 v2 42 wt 527
M2 edge 77 v1 42 v2 38 wt 527
M2 edge 78 v1 13 v2 43 wt 527
M2 edge 79 v1 43 v2 38 wt 527
M2 edge 80 v1 42 v2 43 wt 36
M2 edge 81 v1 13 v2 38 wt 18
M2 edge 82 v1 29 v2 44 wt 527
M2 edge 83 v1 44 v2 15 wt 527
M2 edge 84 v1 29 v2 45 wt 527
M2 edge 85 v1 45 v2 15 wt 527
M2 edge 86 v1 44 v2 45 wt 36
M2 edge 87 v1 29 v2 15 wt 18
`;

function box(LLx: number, LLy: number, URx: number, URy: number): OrthoBox {
  return { LL: { x: LLx, y: LLy }, UR: { x: URx, y: URy } };
}

function bbKey(c: Cell | null): string {
  if (!c) return "NULL";
  const b = c.bb;
  return `${b.LL.x},${b.LL.y},${b.UR.x},${b.UR.y}`;
}

function nodeKey(isVert: boolean, c0: string, c1: string): string {
  return `${isVert ? "V" : "H"}|${c0}|${c1}`;
}

function wtKey(w: number): string {
  return String(Math.round(w * 1e6) / 1e6);
}

function edgeKey(k1: string, k2: string, wt: number): string {
  return `${[k1, k2].sort().join("##")}##${wtKey(wt)}`;
}

interface ParsedDump {
  ncells: number; ngcells: number; nnodes: number; nedges: number;
  nodeKeys: string[]; edges: { v1: number; v2: number; wt: number }[];
}

function parseNodeLine(ln: string, nodeKeys: string[]): void {
  const m = ln.match(
    /M2 node (\d+) isVert (\d) c0 (NULL|[-\d. ]+?) c1 (NULL|[-\d. ]+)$/,
  )!;
  const isVert = m[2] === "1";
  const c0 = m[3] === "NULL" ? "NULL" : m[3]!.trim().split(/\s+/).join(",");
  const c1 = m[4] === "NULL" ? "NULL" : m[4]!.trim().split(/\s+/).join(",");
  nodeKeys[Number(m[1])] = nodeKey(isVert, c0, c1);
}

/** Parse a C M2 dump into counts, per-index node keys, and edge tuples. */
function parseDump(d: string): ParsedDump {
  const lines = d.trim().split("\n");
  const h = lines[0]!.match(
    /ncells (\d+) ngcells (\d+) nnodes (\d+) nedges (\d+)/,
  )!;
  const nodeKeys: string[] = [];
  const edges: { v1: number; v2: number; wt: number }[] = [];
  for (const ln of lines.slice(1)) {
    if (ln.startsWith("M2 node ")) parseNodeLine(ln, nodeKeys);
    else if (ln.startsWith("M2 edge ")) {
      const m = ln.match(/M2 edge \d+ v1 (\d+) v2 (\d+) wt ([-\d.]+)/)!;
      edges.push({ v1: Number(m[1]), v2: Number(m[2]), wt: Number(m[3]) });
    }
  }
  return {
    ncells: Number(h[1]), ngcells: Number(h[2]),
    nnodes: Number(h[3]), nedges: Number(h[4]), nodeKeys, edges,
  };
}

interface MazeFixture { name: string; gcells: OrthoBox[]; dump: string; }

const FIXTURES: MazeFixture[] = [
  {
    name: "f2pair: a -> b (2-node chain)",
    gcells: [
      box(-27,72,27,108),
      box(-27,0,27,36),
    ],
    dump: F2PAIR_DUMP,
  },
  {
    name: "f3chain: a -> b -> c (3-node chain)",
    gcells: [
      box(-27,144,27,180),
      box(-27,72,27,108),
      box(-27,0,27,36),
    ],
    dump: F3CHAIN_DUMP,
  },
  {
    name: "f3branch: a -> b, a -> c (branch)",
    gcells: [
      box(-27,72,27,108),
      box(-63,0,-9,36),
      box(9,0,63,36),
    ],
    dump: F3BRANCH_DUMP,
  },
];

function mkGraph(gcells: OrthoBox[]): OrthoGraph {
  return { nodes: gcells.map((bb) => ({ bb })), edges: [] };
}

/** Canonical key for every real snode in the maze search graph. */
function tsNodeKeys(nodes: SNode[], nnodes: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < nnodes; i++) {
    const np = nodes[i]!;
    keys[i] = nodeKey(np.isVert, bbKey(np.cells[0]), bbKey(np.cells[1]));
  }
  return keys;
}

describe("ortho mkMaze — oracle-pinned vs native C", () => {
  for (const fx of FIXTURES) {
    describe(fx.name, () => {
      const c = parseDump(fx.dump);

      it("matches ncells / ngcells / nnodes / nedges", () => {
        const mp = mkMaze(mkGraph(fx.gcells));
        expect(mp.ngcells).toBe(c.ngcells);
        expect(mp.ncells).toBe(c.ncells);
        expect(mp.sg.nnodes).toBe(c.nnodes);
        expect(mp.sg.nedges).toBe(c.nedges);
      });

      it("matches the cell bb set (free cells + gcells)", () => {
        const mp = mkMaze(mkGraph(fx.gcells));
        const known = new Set<string>([
          ...mp.cells.map((cp) => bbKey(cp)),
          ...mp.gcells.map((cp) => bbKey(cp)),
        ]);
        const cCells = new Set<string>();
        for (const k of c.nodeKeys) {
          const [, a, b] = k.split("|");
          if (a !== "NULL") cCells.add(a!);
          if (b !== "NULL") cCells.add(b!);
        }
        for (const cell of cCells) expect(known.has(cell)).toBe(true);
        expect(mp.cells.length).toBe(c.ncells);
      });

      it("matches the snode set (isVert + cell linkage)", () => {
        const mp = mkMaze(mkGraph(fx.gcells));
        const ts = tsNodeKeys(mp.sg.nodes, mp.sg.nnodes);
        expect(new Set(ts).size).toBe(ts.length);
        expect(new Set(c.nodeKeys).size).toBe(c.nodeKeys.length);
        expect([...ts].sort()).toEqual([...c.nodeKeys].sort());
      });

      it("matches the sedge set (endpoints + weight)", () => {
        const mp = mkMaze(mkGraph(fx.gcells));
        const ts = tsNodeKeys(mp.sg.nodes, mp.sg.nnodes);
        const tsEdges = (mp.sg.edges.slice(0, mp.sg.nedges) as SEdge[])
          .map((e) => edgeKey(ts[e.v1]!, ts[e.v2]!, e.weight))
          .sort();
        const cEdges = c.edges
          .map((e) => edgeKey(c.nodeKeys[e.v1]!, c.nodeKeys[e.v2]!, e.wt))
          .sort();
        expect(tsEdges).toEqual(cEdges);
      });

      it("is deterministic run-to-run", () => {
        const a = mkMaze(mkGraph(fx.gcells));
        const b = mkMaze(mkGraph(fx.gcells));
        expect(tsNodeKeys(a.sg.nodes, a.sg.nnodes).sort())
          .toEqual(tsNodeKeys(b.sg.nodes, b.sg.nnodes).sort());
      });
    });
  }
});
