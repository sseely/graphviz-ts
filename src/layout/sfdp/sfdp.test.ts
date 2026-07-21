// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for the sfdp pipeline (15.0.0 spec).
 *
 * The end-to-end expectation is full-precision ND_pos dumped from the
 * installed graphviz 15.0.0 binary (sfdp-oracle C probe). Parity is
 * asserted to 6 decimal digits, not bit-exact: the port uses ARM
 * optimized-routines pow (the legally clean libm), which differs from
 * the proprietary Apple libm pow that produced the oracle by ~1 ULP on
 * some arguments — ≤2e-7 in here (see the mission 8 decision journal).
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/index.js';
import {
  SFDP_LAYOUT_ENGINE,
  sfdpLayout,
  sfdpInitGraph,
  tuneControl,
  makeMatrix,
  getSizes,
  getPos,
} from './index.js';
import {
  springElectricalControlNew,
  AUTOP,
  QUAD_TREE_NONE,
  QUAD_TREE_NORMAL,
} from './spring-electrical.js';
import { multilevelSpringElectricalEmbedding } from './spring-driver.js';
import { smFromCoordinateArrays, MATRIX_TYPE_REAL } from './sparse-matrix.js';

/** test/golden/inputs/sfdp-simple.dot */
const SIMPLE = `graph G {
  n0 -- n1; n1 -- n2; n2 -- n3; n3 -- n4;
  n4 -- n5; n5 -- n6; n6 -- n7; n7 -- n8;
  n8 -- n9; n9 -- n0; n0 -- n5; n2 -- n7;
}`;

const WEIGHTED = `graph G {
  a -- b [weight=2]; b -- c; a -- c [weight=3];
}`;

describe('makeMatrix', () => {
  it('builds the weighted CSR in node/out-edge order with ND_id assigned', () => {
    const g = parse(WEIGHTED);
    const A = makeMatrix(g);
    // ids in node order: a=0, b=1, c=2
    const ids = [...g.nodes.values()].map((n) => n.info.id);
    expect(ids).toEqual([0, 1, 2]);
    // rows: a → (b,2), (c,3); b → (c,1); c → (none)
    expect(A.m).toBe(3);
    expect(A.n).toBe(3);
    expect(A.ia).toEqual([0, 2, 3, 3]);
    expect(A.ja).toEqual([1, 2, 2]);
    expect(A.a).toEqual([2, 3, 1]);
  });
});

describe('getSizes', () => {
  it('returns half node sizes plus pad, in inches, by ND_id', () => {
    const g = parse(WEIGHTED);
    makeMatrix(g); // assign ids
    for (const n of g.nodes.values()) {
      n.info.width = 0.75;
      n.info.height = 0.5;
    }
    const pad = { x: 4 / 72, y: 4 / 72 };
    const sizes = getSizes(g, pad);
    expect(sizes).toHaveLength(6);
    for (let i = 0; i < 3; i++) {
      expect(sizes[i * 2]).toBeCloseTo(0.375 + 4 / 72, 15);
      expect(sizes[i * 2 + 1]).toBeCloseTo(0.25 + 4 / 72, 15);
    }
  });
});

describe('getPos', () => {
  it('returns zeros when no node carries a pos attribute', () => {
    const g = parse(WEIGHTED);
    makeMatrix(g);
    expect(getPos(g, 2)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('tuneControl', () => {
  it('applies the C defaults for an attribute-less graph', () => {
    const g = parse(SIMPLE);
    const ctrl = springElectricalControlNew();
    tuneControl(g, ctrl);
    expect(ctrl.randomSeed).toBe(123);
    expect(ctrl.K).toBe(-1);
    expect(ctrl.p).toBe(AUTOP);
    expect(ctrl.multilevels).toBe(2147483647);
    expect(ctrl.tscheme).toBe(QUAD_TREE_NORMAL);
    expect(ctrl.smoothing).toBe(0);
    expect(ctrl.doShrinking).toBe(true);
    expect(ctrl.edgeLabelingScheme).toBe(0);
  });

  it('reads start, K, levels and quadtree attributes', () => {
    const g = parse('graph G { start=42; K=2; levels=1; quadtree=none; a -- b; }');
    const ctrl = springElectricalControlNew();
    tuneControl(g, ctrl);
    expect(ctrl.randomSeed).toBe(42);
    expect(ctrl.K).toBe(2);
    expect(ctrl.multilevels).toBe(1);
    expect(ctrl.tscheme).toBe(QUAD_TREE_NONE);
  });
});

describe('multilevelSpringElectricalEmbedding', () => {
  it('restores ctrl after embedding (C *ctrl = ctrl0)', () => {
    const ctrl = springElectricalControlNew();
    ctrl.K = 42;
    // 5-ring
    const irn = [0, 1, 2, 3, 4];
    const jcn = [1, 2, 3, 4, 0];
    const val = [1, 1, 1, 1, 1];
    const A = smFromCoordinateArrays(5, 5, 5, { irn, jcn, val }, MATRIX_TYPE_REAL);
    const x = new Array<number>(10).fill(0);
    multilevelSpringElectricalEmbedding(2, A, ctrl, null, x);
    expect(ctrl.K).toBe(42);
    expect(ctrl.p).toBe(AUTOP);
  });
});

// Full-precision ND_pos from graphviz 15.0.0 (sfdp-oracle probe)
const SIMPLE_ORACLE_POS: Record<string, [number, number]> = {
  n0: [2.6489907187904627, 3.8157984945435084],
  n1: [3.2894319921803703, 1.9430679642753241],
  n2: [4.9988611306428812, 0.24999999999999978],
  n3: [7.3805064339105755, 0.93373778118151707],
  n4: [7.5060296675535945, 3.051410823550591],
  n5: [5.233578132135599, 3.8174158910238436],
  n6: [4.5909338270114555, 1.9482791283555252],
  n7: [2.8830169370318552, 0.25248852066482907],
  n8: [0.50154855945821142, 0.93462689786614428],
  n9: [0.37499999999999956, 3.051423933691038],
};

describe('sfdpLayout oracle parity', () => {
  it('reproduces the C binary positions for sfdp-simple (inches)', () => {
    const g = parse(SIMPLE);
    sfdpLayout(g);
    for (const [name, [x, y]] of Object.entries(SIMPLE_ORACLE_POS)) {
      const n = g.nodes.get(name)!;
      expect(n.info.pos![0]).toBeCloseTo(x, 6);
      expect(n.info.pos![1]).toBeCloseTo(y, 6);
    }
  });

  it('is deterministic across repeated layouts in one process', () => {
    const g1 = parse(SIMPLE);
    sfdpLayout(g1);
    const g2 = parse(SIMPLE);
    sfdpLayout(g2);
    for (const n of g1.nodes.values()) {
      const m = g2.nodes.get(n.name)!;
      expect(m.info.pos).toEqual(n.info.pos);
    }
  });

  // Regression: ratio=fill must not have its scaled bb clobbered by the
  // single-component postprocess. neatoSetAspect scales node POSITIONS by the
  // fill factor but (matching C) not node half-sizes, and grows GD_bb to the
  // scaled target; C's gv_postprocess never recomputes GD_bb. The old port
  // recomputed it geometrically (node-box ∪ curve), landing short of the
  // scaled box by node_size*(f-1) on the stretched axis. With pinned positions
  // (deterministic), the stretched (Y) axis must keep the scaled height.
  // @see src/layout/sfdp/index.ts postprocess, batch-4/findings.md
  it('preserves the ratio=fill scaled bb on the stretched axis (single component)', () => {
    const g = parse(`graph G {
      size="4,6"; ratio=fill;
      a [pos="0,0", shape=box, width=1, height=1];
      b [pos="2,0", shape=box, width=1, height=1];
      c [pos="1,2", shape=box, width=1, height=1];
      a -- b; b -- c; c -- a;
    }`);
    sfdpLayout(g);
    const width = g.info.bb.ur.x - g.info.bb.ll.x;
    const height = g.info.bb.ur.y - g.info.bb.ll.y;
    // Y is the fill-stretched axis; the geometric-recompute bug shortened it to
    // ~418.4 (short by node_height*(yf-1)). The scaled box keeps ~446.3.
    expect(height).toBeCloseTo(446.335, 1);
    expect(width).toBeCloseTo(297.557, 1);
    expect(height).toBeGreaterThan(440); // fails on the pre-fix ~418.4
  });
});

describe('SFDP_LAYOUT_ENGINE', () => {
  it('has type "sfdp" and clears layout state on cleanup', () => {
    expect(SFDP_LAYOUT_ENGINE.type).toBe('sfdp');
    const g = parse(WEIGHTED);
    sfdpInitGraph(g);
    SFDP_LAYOUT_ENGINE.layout(g);
    SFDP_LAYOUT_ENGINE.cleanup?.(g);
    for (const n of g.nodes.values()) {
      expect(n.info.pos).toBeUndefined();
      expect(n.info.id).toBeUndefined();
    }
  });
});
