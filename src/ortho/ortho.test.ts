// SPDX-License-Identifier: EPL-2.0
/**
 * Acceptance tests for the ortho edge router.
 *
 * Expected values are derived from the C source; tests are written
 * before implementation and must not be changed to match code output.
 *
 * Acceptance criteria:
 *   1. SEED constant equals 173.
 *   2. Two calls on identical graphs produce identical routing results.
 *   3. Maze Dijkstra finds shortest orthogonal path in a simple two-node graph.
 *   4. useLbls=true triggers console.warn and does not throw.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SEED } from "./partition.js";
import { orthoEdges } from "./index.js";
import type { OrthoGraph, OrthoEdge, OrthoPoint, ClipAndInstallFn } from "./index.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Two non-overlapping nodes separated by a clear horizontal gap. */
function makeTwoNodeGraph(): OrthoGraph {
  const nodeA = { bb: { LL: { x: 0, y: 0 }, UR: { x: 20, y: 20 } } };
  const nodeB = { bb: { LL: { x: 100, y: 0 }, UR: { x: 120, y: 20 } } };
  const edge: OrthoEdge = { tail: nodeA, head: nodeB };
  return { nodes: [nodeA, nodeB], edges: [edge] };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ortho acceptance", () => {
  // ── AC1: SEED constant ────────────────────────────────────────────────────
  it("SEED constant equals 173", () => {
    expect(SEED).toBe(173);
  });

  // ── AC2: Determinism ─────────────────────────────────────────────────────
  it("two identical calls produce identical routing results", () => {
    const paths1: OrthoPoint[][] = [];
    const paths2: OrthoPoint[][] = [];

    const capture =
      (acc: OrthoPoint[][]): ClipAndInstallFn =>
      (_g, _e, path) => {
        acc.push(path.map((p) => ({ x: p.x, y: p.y })));
      };

    orthoEdges(makeTwoNodeGraph(), false, capture(paths1));
    orthoEdges(makeTwoNodeGraph(), false, capture(paths2));

    expect(paths1.length).toBeGreaterThan(0);
    expect(paths1).toEqual(paths2);
  });

  // ── AC3: Dijkstra finds shortest orthogonal path ──────────────────────────
  it("routes a simple two-node graph without entering node bounding boxes", () => {
    const g = makeTwoNodeGraph();
    const [nodeA, nodeB] = g.nodes;
    const routedPaths: OrthoPoint[][] = [];

    const capture: ClipAndInstallFn = (_g, _e, path) => {
      routedPaths.push(path.map((p) => ({ x: p.x, y: p.y })));
    };

    orthoEdges(g, false, capture);

    expect(routedPaths.length).toBe(1);
    const pts = routedPaths[0];
    expect(pts.length).toBeGreaterThan(0);

    // No routed point should land inside nodeA or nodeB bounding boxes
    for (const pt of pts) {
      const inA =
        pt.x > nodeA.bb.LL.x && pt.x < nodeA.bb.UR.x &&
        pt.y > nodeA.bb.LL.y && pt.y < nodeA.bb.UR.y;
      const inB =
        pt.x > nodeB.bb.LL.x && pt.x < nodeB.bb.UR.x &&
        pt.y > nodeB.bb.LL.y && pt.y < nodeB.bb.UR.y;
      expect(inA).toBe(false);
      expect(inB).toBe(false);
    }
  });

  // ── AC4: useLbls warning ──────────────────────────────────────────────────
  describe("useLbls=true", () => {
    // vitest spy — typed loosely to avoid MockInstance parameter variance issues
    let warnSpy: { mockRestore: () => void; mock: { calls: unknown[][] } };

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("triggers console.warn and does not throw", () => {
      expect(() => {
        orthoEdges(makeTwoNodeGraph(), true);
      }).not.toThrow();

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        "Orthogonal edges do not currently handle edge labels. Try using xlabels.\n",
      );
    });
  });
});
