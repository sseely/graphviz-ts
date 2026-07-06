// SPDX-License-Identifier: EPL-2.0
/**
 * Regression test for edgeLen (src/ortho/index.ts): must read ND_coord
 * directly when the caller has plumbed `coord` on OrthoNode, mirroring
 * C's `edgeLen` (lib/ortho/ortho.c:1124-1129), which uses ND_coord(tail) /
 * ND_coord(head) + DIST2 — never re-deriving the centre from the bounding
 * box.
 *
 * The bb round-trip ((c - lw) + (c + rw)) / 2 loses low bits relative to a
 * direct read of `coord` when |c| is much larger than the node size. This
 * test picks values where the bb-center reconstruction is provably lossy
 * (large coordinate, small half-width) and asserts edgeLen uses the exact
 * `coord` value instead of the reconstructed (and different) bb center.
 *
 * @see lib/ortho/ortho.c:1124 (edgeLen)
 */

import { describe, it, expect } from "vitest";
import { edgeLen } from "./index.js";
import type { OrthoEdge, OrthoNode } from "./index.js";

describe("edgeLen", () => {
  it("reads node.coord directly rather than reconstructing from bb", () => {
    // bb is intentionally inconsistent with coord: a faithful port must key
    // off `coord` (ND_coord) exactly as C's edgeLen does (ortho.c:1124), and
    // must NOT re-derive a centre from LL/UR. If the fix regresses to the
    // bb-center reconstruction, this test fails because the two centres are
    // deliberately different (not merely different in low bits, so the
    // assertion is robust rather than depending on a fragile float
    // coincidence).
    const bbCenterX = 10;
    const bbCenterY = 10;
    const trueCoordX = 15;
    const trueCoordY = 23;

    const tail: OrthoNode = {
      bb: { LL: { x: 0, y: 0 }, UR: { x: bbCenterX * 2, y: bbCenterY * 2 } },
      coord: { x: trueCoordX, y: trueCoordY },
    };
    const head: OrthoNode = {
      bb: { LL: { x: -1, y: -1 }, UR: { x: 1, y: 1 } },
      coord: { x: 0, y: 0 },
    };
    const edge: OrthoEdge = { tail, head };

    const expectedUsingCoord = trueCoordX * trueCoordX + trueCoordY * trueCoordY;
    const expectedUsingBbCenter = bbCenterX * bbCenterX + bbCenterY * bbCenterY;
    expect(expectedUsingCoord).not.toBe(expectedUsingBbCenter);

    const d = edgeLen(edge);

    expect(d).toBe(expectedUsingCoord);
    expect(d).not.toBe(expectedUsingBbCenter);
  });

  it("falls back to the bb center when coord is absent (port-less caller)", () => {
    const tail: OrthoNode = { bb: { LL: { x: 0, y: 0 }, UR: { x: 20, y: 20 } } };
    const head: OrthoNode = { bb: { LL: { x: 100, y: 0 }, UR: { x: 120, y: 20 } } };
    const edge: OrthoEdge = { tail, head };

    // Centers: (10,10) and (110,10) -> dx=100, dy=0 -> d = 10000
    expect(edgeLen(edge)).toBe(10000);
  });
});
