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
  // The unclipped route emitted to clip_and_install starts/ends at the node
  // CENTRES (C ortho.c:1075-1076: p1 = ND_coord(tail) + port, port 0 here);
  // clip_and_install — the caller's job, not modelled here — clips those
  // endpoints to the node boundary. So the endpoints legitimately sit at the
  // node centres; only the interior bend points must avoid node interiors.
  it("routes a two-node graph: endpoints at node centres, bends clear of nodes", () => {
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

    const centre = (n: typeof nodeA) => ({
      x: (n.bb.LL.x + n.bb.UR.x) / 2,
      y: (n.bb.LL.y + n.bb.UR.y) / 2,
    });
    // first/last points are the tail/head centres (faithful to C)
    expect(pts[0]).toEqual(centre(nodeA));
    expect(pts[pts.length - 1]).toEqual(centre(nodeB));

    // interior bend points (excluding the duplicated endpoint pairs) must not
    // land inside either node bounding box
    for (let i = 2; i < pts.length - 2; i++) {
      const pt = pts[i];
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

  // ── T13 fix 2: compass-port endpoints (1856) ──────────────────────────────
  // C attachOrthoEdges anchors at ND_coord(tail) + ED_tail_port.p and
  // ND_coord(head) + ED_head_port.p (ortho.c:1075-1076), not always the node
  // centre. tailPoint/headPoint let the adapter plumb that offset through;
  // when absent, buildSpline must fall back to the bb centre (proven by the
  // AC3 test above, which sets neither field).
  it("uses tailPoint/headPoint as the attach points when set (compass port offset)", () => {
    // C only keeps the p1/q1 component on the axis PARALLEL to the attach
    // segment's own fixed coordinate; the perpendicular axis comes from
    // vtrack/htrack (ortho.c:1075-1076, 1080-1081 — ported verbatim above).
    // makeTwoNodeGraph's two centres share the same y (10), so the maze
    // routes a single HORIZONTAL segment: p.x = p1.x (preserved), p.y =
    // htrack(...) (track-assigned, NOT p1.y). Offset the x axis so the
    // preserved component is directly observable.
    const g = makeTwoNodeGraph();
    const [nodeA, nodeB] = g.nodes;
    const tailPoint: OrthoPoint = { x: 6, y: 10 }; // west of nodeA's centre
    const headPoint: OrthoPoint = { x: 114, y: 10 }; // east of nodeB's centre
    g.edges[0] = { ...g.edges[0], tailPoint, headPoint };

    const routedPaths: OrthoPoint[][] = [];
    const capture: ClipAndInstallFn = (_g, _e, path) => {
      routedPaths.push(path.map((p) => ({ x: p.x, y: p.y })));
    };
    orthoEdges(g, false, capture);

    expect(routedPaths.length).toBe(1);
    const pts = routedPaths[0];
    expect(pts[0].x).toBe(tailPoint.x);
    expect(pts[pts.length - 1].x).toBe(headPoint.x);
    // and NOT the bb centres' x (proves the offset was actually applied)
    const centreA = { x: (nodeA.bb.LL.x + nodeA.bb.UR.x) / 2, y: (nodeA.bb.LL.y + nodeA.bb.UR.y) / 2 };
    const centreB = { x: (nodeB.bb.LL.x + nodeB.bb.UR.x) / 2, y: (nodeB.bb.LL.y + nodeB.bb.UR.y) / 2 };
    expect(pts[0].x).not.toBe(centreA.x);
    expect(pts[pts.length - 1].x).not.toBe(centreB.x);
  });

  it("falls back to the bb centre when tailPoint/headPoint are unset", () => {
    // Same shape as AC3 but stated explicitly for the fix: the port-less case
    // must reproduce the pre-fix behaviour bit-for-bit.
    const g = makeTwoNodeGraph();
    const [nodeA, nodeB] = g.nodes;
    expect(g.edges[0].tailPoint).toBeUndefined();
    expect(g.edges[0].headPoint).toBeUndefined();

    const routedPaths: OrthoPoint[][] = [];
    const capture: ClipAndInstallFn = (_g, _e, path) => {
      routedPaths.push(path.map((p) => ({ x: p.x, y: p.y })));
    };
    orthoEdges(g, false, capture);

    const centreA = { x: (nodeA.bb.LL.x + nodeA.bb.UR.x) / 2, y: (nodeA.bb.LL.y + nodeA.bb.UR.y) / 2 };
    const centreB = { x: (nodeB.bb.LL.x + nodeB.bb.UR.x) / 2, y: (nodeB.bb.LL.y + nodeB.bb.UR.y) / 2 };
    const pts = routedPaths[0];
    expect(pts[0]).toEqual(centreA);
    expect(pts[pts.length - 1]).toEqual(centreB);
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
