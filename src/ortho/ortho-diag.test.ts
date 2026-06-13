// SPDX-License-Identifier: EPL-2.0
/**
 * Temporary diagnostic test — delete after debugging.
 */
import { describe, it, expect } from "vitest";
import { mkMaze } from "./maze.js";
import { addNodeEdges, shortPath, pqGenForGraph } from "./sgraph.js";

describe("ortho-diag", () => {
  it("traces maze and dijkstra state", () => {
    const nodeA = { bb: { LL: { x: 0, y: 0 }, UR: { x: 20, y: 20 } } };
    const nodeB = { bb: { LL: { x: 100, y: 0 }, UR: { x: 120, y: 20 } } };
    const g = { nodes: [nodeA, nodeB], edges: [{ tail: nodeA, head: nodeB }] };

    const mp = mkMaze(g);
    const sg = mp.sg;

    // Diagnostic: dump ncells and first few cell bbs
    console.log("ncells:", mp.ncells);
    for (let i = 0; i < Math.min(5, mp.ncells); i++) {
      const c = mp.cells[i];
      console.log(`cell[${i}] bb:`, JSON.stringify(c.bb), "nsides:", c.nsides);
    }
    console.log("gcell[0] bb:", JSON.stringify(mp.gcells[0].bb));
    console.log("gcell[1] bb:", JSON.stringify(mp.gcells[1].bb));
    console.log("sg.nnodes:", sg.nnodes);

    // Check what side-nodes exist near gcell[0]
    const gstart = sg.nnodes;
    for (let i = 0; i < Math.min(gstart, 10); i++) {
      const n = sg.nodes[i];
      console.log(`snode[${i}] isVert:${n.isVert} cells:[${n.cells[0]?.bb.LL.x??'?'},${n.cells[1]?.bb.LL.x??'?'}]`);
    }
    expect(mp.ncells).toBeGreaterThan(0);
  });
});
