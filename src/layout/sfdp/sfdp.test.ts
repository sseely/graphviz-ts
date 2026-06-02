// SPDX-License-Identifier: EPL-2.0
/**
 * Acceptance tests for the sfdp layout engine (T47).
 */

import { describe, it, expect } from 'vitest';
import { AUTOP } from './spring-types.js';
import {
  springElectricalControlNew,
  multilevelSpringElectricalEmbedding,
} from './spring.js';
import { SFDP_LAYOUT_ENGINE } from './index.js';
import { buildHierarchy } from './hierarchy.js';
import { makeRingGraph, makeRingMatrix } from './sfdp-test-helpers.js';

describe('sfdp constants', () => {
  it('AUTOP equals -1.0001234', () => {
    expect(AUTOP).toBe(-1.0001234);
  });
});

describe('multilevelSpringElectricalEmbedding', () => {
  it('preserves ctrl.K after embedding a 5-node ring', () => {
    const ctrl = springElectricalControlNew();
    ctrl.K = 42;
    const n = 5;
    const A = makeRingMatrix(n);
    const x = new Float64Array(n * 2);
    const flag = { value: 0 };
    multilevelSpringElectricalEmbedding(2, A, ctrl, null, x, 0, [], flag);
    expect(ctrl.K).toBe(42);
  });
});

describe('SFDP_LAYOUT_ENGINE', () => {
  it('has type "sfdp"', () => {
    expect(SFDP_LAYOUT_ENGINE.type).toBe('sfdp');
  });
});

describe('buildHierarchy', () => {
  it('produces at least one coarser level for a 10-node ring', () => {
    const A = makeRingMatrix(10);
    const { levels } = buildHierarchy(A, 10);
    expect(levels.length).toBeGreaterThan(1);
    const coarsest = levels[levels.length - 1]!;
    expect(coarsest.n).toBeLessThan(10);
  });
});

describe('sfdpLayout', () => {
  it('produces non-zero coord for at least one node on a 10-node ring', () => {
    const g = makeRingGraph(10);
    SFDP_LAYOUT_ENGINE.layout(g);
    const coords = Array.from(g.nodes.values()).map(nd => nd.info.coord);
    const hasNonZero = coords.some(c => c.x !== 0 || c.y !== 0);
    expect(hasNonZero).toBe(true);
  });
});
