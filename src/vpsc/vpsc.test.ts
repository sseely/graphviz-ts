// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the VPSC (Variable Placement with Separation Constraints) port.
 *
 * Covers:
 *  1. Two overlapping rectangles: after genX + genY + solveVPSC, no overlap.
 *  2. IncVPSC.solve() convergence: |Δcost| ≤ 0.0001.
 *  3. X and Y variable blocks are independent after solving.
 *  4. Teardown order: deleteVPSC → deleteConstraints → deleteVariable does not throw.
 *  5. Cycle guard throws Error("Cycle Error!") on a cyclic constraint setup.
 */

import { describe, it, expect } from "vitest";
import {
  newVariable,
  deleteVariable,
  newConstraint,
  deleteConstraints,
  newIncVPSC,
  deleteVPSC,
  satisfyVPSC,
  solveVPSC,
  genXConstraints,
  genYConstraints,
  Rectangle,
  IncVPSC,
} from "./index.js";

// ---------------------------------------------------------------------------
// Helpers shared across tests
// ---------------------------------------------------------------------------

function twoOverlappingRects(): Rectangle[] {
  return [new Rectangle(0, 10, 0, 10), new Rectangle(0, 10, 0, 10)];
}

function solveAxis(
  rects: Rectangle[],
  gen: (rs: Rectangle[], vs: ReturnType<typeof newVariable>[]) => ReturnType<typeof newConstraint>[],
): { vars: ReturnType<typeof newVariable>[]; cs: ReturnType<typeof newConstraint>[] } {
  const vars = rects.map((_, i) => newVariable(i, 5, 1));
  const cs = gen(rects, vars);
  solveVPSC(newIncVPSC(vars, cs));
  return { vars, cs };
}

function computeCost(vs: ReturnType<typeof newVariable>[]): number {
  return vs.reduce((s, v) => {
    const d = v.position() - v.desiredPosition;
    return s + v.weight * d * d;
  }, 0);
}

// ---------------------------------------------------------------------------
// Test 1: Two overlapping rectangles — no overlap after solving
// ---------------------------------------------------------------------------

describe("genXConstraints + genYConstraints + solveVPSC", () => {
  it("resolves overlap: all constraint slack >= -1e-7", () => {
    const rects = twoOverlappingRects();
    const { cs: xCs } = solveAxis(rects, (rs, vs) => genXConstraints(rs, vs, false));
    const { cs: yCs } = solveAxis(rects, genYConstraints);
    for (const c of [...xCs, ...yCs]) {
      expect(c.slack()).toBeGreaterThanOrEqual(-1e-7);
    }
  });

  it("resolves overlap: positions differ after solving", () => {
    const rects = twoOverlappingRects();
    const { vars } = solveAxis(rects, (rs, vs) => genXConstraints(rs, vs, false));
    expect(Math.abs(vars[0]!.position() - vars[1]!.position())).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2a: IncVPSC.solve() convergence — |Δcost| ≤ 0.0001
// ---------------------------------------------------------------------------

describe("IncVPSC convergence: two iterations give |Δcost| <= 0.0001", () => {
  it("converges after satisfy + splitBlocks cycle", () => {
    const vs = [newVariable(0, 0, 1), newVariable(1, 1, 1), newVariable(2, 2, 1)];
    const cs = [newConstraint(vs[0]!, vs[1]!, 1.5), newConstraint(vs[1]!, vs[2]!, 1.5)];
    const vpsc = new IncVPSC(vs, cs);
    vpsc.satisfy(); vpsc.splitBlocks();
    const cost1 = computeCost(vs);
    vpsc.satisfy(); vpsc.splitBlocks();
    const cost2 = computeCost(vs);
    expect(Math.abs(cost1 - cost2)).toBeLessThanOrEqual(0.0001);
  });
});

// ---------------------------------------------------------------------------
// Test 2b: solveVPSC completes on a simple chain
// ---------------------------------------------------------------------------

describe("IncVPSC convergence: simple chain satisfies constraints", () => {
  it("solveVPSC completes and all constraints satisfied", () => {
    const vs = [newVariable(0, 0, 1), newVariable(1, 0, 1), newVariable(2, 0, 1)];
    const cs = [newConstraint(vs[0]!, vs[1]!, 2), newConstraint(vs[1]!, vs[2]!, 2)];
    expect(() => solveVPSC(newIncVPSC(vs, cs))).not.toThrow();
    for (const c of cs) expect(c.slack()).toBeGreaterThanOrEqual(-1e-7);
  });
});

// ---------------------------------------------------------------------------
// Test 3: X and Y variable blocks are independent
// ---------------------------------------------------------------------------

describe("X and Y variable blocks are independent", () => {
  it("xVars[i].block !== yVars[i].block for all i after solving", () => {
    const rects = [new Rectangle(0, 10, 0, 10), new Rectangle(5, 15, 5, 15)];
    const { vars: xVars } = solveAxis(rects, (rs, vs) => genXConstraints(rs, vs, false));
    const { vars: yVars } = solveAxis(rects, genYConstraints);
    for (let i = 0; i < rects.length; i++) {
      expect(xVars[i]!.block).not.toBe(yVars[i]!.block);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 4: Teardown order does not throw
// ---------------------------------------------------------------------------

describe("Teardown order", () => {
  it("deleteVPSC → deleteConstraints → deleteVariable does not throw", () => {
    const vs = [newVariable(0, 0, 1), newVariable(1, 5, 1)];
    const cs = [newConstraint(vs[0]!, vs[1]!, 3)];
    const vpsc = newIncVPSC(vs, cs);
    satisfyVPSC(vpsc);
    expect(() => {
      deleteVPSC(vpsc);
      deleteConstraints(cs);
      deleteVariable(vs[0]!);
      deleteVariable(vs[1]!);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test 5: Cycle guard
// ---------------------------------------------------------------------------

describe("Cycle guard", () => {
  it('throws Error("Cycle Error!") on A < B < A cyclic constraints', () => {
    const vA = newVariable(0, 0, 1);
    const vB = newVariable(1, 0, 1);
    const cAB = newConstraint(vA, vB, 1); // B >= A + 1
    const cBA = newConstraint(vB, vA, 1); // A >= B + 1  (cycle)
    const vpsc = newIncVPSC([vA, vB], [cAB, cBA]);
    expect(() => vpsc.satisfy()).toThrow("Cycle Error!");
  });
});
