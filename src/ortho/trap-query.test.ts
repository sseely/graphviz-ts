// SPDX-License-Identifier: EPL-2.0

/**
 * Guard tests for unported ortho trap-query surfaces.
 *
 * locateEndpoint degenerate case: NOT reachable from the public API.
 *
 * The public orthoEdges → seidel trapezoidation pipeline only constructs
 * QNodes with nodetype ∈ {T_X=1, T_Y=2, T_SINK=3}.  A nodetype value
 * outside that set requires manually constructing a corrupt QNode array;
 * there is no DOT attribute or graph topology that can produce it.
 *
 * Tested via direct call to locateEndpoint with a hand-crafted QNode
 * array that contains an invalid nodetype at the query root.
 */

import { describe, it, expect } from 'vitest';
import { locateEndpoint } from './trap-query.js';
import { T_SINK } from './trap-types.js';
import type { SegPoint, SegmentT, QNode } from './trap-types.js';

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

const ORIGIN: SegPoint = { x: 0, y: 0 };

/** Minimal 1-element segment array — content is irrelevant for T_SINK paths. */
function makeDummySeg(): SegmentT[] {
  return [{ v0: ORIGIN, v1: { x: 1, y: 1 } } as unknown as SegmentT];
}

/** Single T_SINK node at index 0; locateEndpoint(…, 0, …) returns trnum. */
function makeSinkQs(trnum: number): QNode[] {
  return [{ nodetype: T_SINK, segnum: 0, yval: ORIGIN, trnum, parent: 0, left: 0, right: 0 }];
}

/** Root node with given nodetype; left/right both point to a T_SINK leaf. */
function makeInvalidRootQs(rootNodetype: number): QNode[] {
  const leaf: QNode = { nodetype: T_SINK, segnum: 0, yval: ORIGIN, trnum: 0, parent: 0, left: 0, right: 0 };
  const root: QNode = { nodetype: rootNodetype, segnum: 0, yval: ORIGIN, trnum: 0, parent: 0, left: 1, right: 1 };
  return [root, leaf];
}

const QUERY_PT: SegPoint = { x: 0.5, y: 0.5 };

// ---------------------------------------------------------------------------
// Guard: locateEndpoint default case  (direct-call — not reachable via API)
// ---------------------------------------------------------------------------

describe('locateEndpoint degenerate guard (direct call)', () => {
  it('throws when nodetype is 0 (uninitialized)', () => {
    expect(() => locateEndpoint(QUERY_PT, QUERY_PT, 0, makeDummySeg(), makeInvalidRootQs(0)))
      .toThrow('locateEndpoint: unreachable');
  });

  it('throws when nodetype is 99 (arbitrary invalid value)', () => {
    expect(() => locateEndpoint(QUERY_PT, QUERY_PT, 0, makeDummySeg(), makeInvalidRootQs(99)))
      .toThrow('locateEndpoint: unreachable');
  });

  it('does not throw for T_SINK and returns trnum', () => {
    const result = locateEndpoint(QUERY_PT, QUERY_PT, 0, makeDummySeg(), makeSinkQs(7));
    expect(result).toBe(7);
  });
});
