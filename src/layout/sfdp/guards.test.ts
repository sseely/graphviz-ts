// SPDX-License-Identifier: EPL-2.0

/**
 * Guard tests for unported sfdp surfaces.
 *
 * Each guard that is reachable from the public API is exercised via
 * sfdpLayout with a crafted graph attribute (trigger test) plus the
 * same graph with default attributes (control test).
 *
 * Guards that are not reachable from the public API are tested via
 * direct calls with the triggering input.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/index.js';
import { sfdpLayout } from './index.js';
import { springElectricalControlNew } from './spring-electrical.js';
import { smFromCoordinateArrays, MATRIX_TYPE_REAL } from './sparse-matrix.js';
import { removeOverlapScalingOnly } from './spring-driver.js';
import { sfdpInitGraph, tuneControl } from './init.js';

/** Inline copy of test/golden/inputs/sfdp-simple.dot */
const SFDP_SIMPLE = `graph G {
  n0 -- n1; n1 -- n2; n2 -- n3; n3 -- n4;
  n4 -- n5; n5 -- n6; n6 -- n7; n7 -- n8;
  n8 -- n9; n9 -- n0; n0 -- n5; n2 -- n7;
}`;

// ---------------------------------------------------------------------------
// Guard 1: sfdp smoothing != none  (public API — via sfdpLayout)
// ---------------------------------------------------------------------------

describe('sfdp smoothing guard', () => {
  it('throws when smoothing="spring" is set on a graph', () => {
    const g = parse(SFDP_SIMPLE);
    g.attrs.set('smoothing', 'spring');
    expect(() => sfdpLayout(g)).toThrow('sfdp smoothing="spring"');
  });

  it('does not throw with default attrs (no smoothing attribute)', () => {
    const g = parse(SFDP_SIMPLE);
    expect(() => sfdpLayout(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Guard 2: sfdp overlap != prism0 (public API — via sfdpLayout)
// Two branches in resolveAdjustPrism0:
//   - overlap not in {prism0, prism} → "only the default prism0 adjust mode"
//   - overlap === "prism"            → "prism OverlapSmoother (ntry=1000)"
// ---------------------------------------------------------------------------

describe('sfdp overlap (non-prism0) guard', () => {
  it('throws when overlap="false" is set (unrecognised mode)', () => {
    const g = parse(SFDP_SIMPLE);
    g.attrs.set('overlap', 'false');
    expect(() => sfdpLayout(g)).toThrow(
      'sfdp overlap="false": only the default prism0 adjust mode is ported',
    );
  });

  it('throws when overlap="prism" is set (ntry=1000 smoother path)', () => {
    const g = parse(SFDP_SIMPLE);
    g.attrs.set('overlap', 'prism');
    expect(() => sfdpLayout(g)).toThrow(
      'sfdp overlap="prism": the prism OverlapSmoother',
    );
  });

  it('does not throw with default attrs (no overlap attribute)', () => {
    const g = parse(SFDP_SIMPLE);
    expect(() => sfdpLayout(g)).not.toThrow();
  });

  it('does not throw with overlap="prism0" (the ported default)', () => {
    const g = parse(SFDP_SIMPLE);
    g.attrs.set('overlap', 'prism0');
    expect(() => sfdpLayout(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// beautifyLeaves (SFDP-1, ported): beautify="true" fans degree-1 leaves
// radially. tuneControl maps beautify="true" → ctrl.beautifyLeaves = true,
// applied per multilevel level. Oracle parity is pinned in
// spring-electrical.test.ts; here we just assert it renders (no longer throws).
// ---------------------------------------------------------------------------

describe('sfdp beautify_leaves', () => {
  it('renders (no throw) when beautify="true" is set on the graph', () => {
    const g = parse(SFDP_SIMPLE);
    g.attrs.set('beautify', 'true');
    expect(() => sfdpLayout(g)).not.toThrow();
    for (const n of g.nodes.values()) expect(n.info.pos).toBeDefined();
  });

  it('does not throw with default attrs (no beautify attribute)', () => {
    const g = parse(SFDP_SIMPLE);
    expect(() => sfdpLayout(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Guard 4: sfdp remove_overlap ntry>0  (direct-call test — not reachable via
// public API).
//
// The public API resolves overlap via resolveAdjustPrism0: any overlap value
// other than "prism0" / "prism" throws before reaching removeOverlapScalingOnly.
// The "prism0" path always sets ctrl.overlap = 0 (ntry=0).  The only way to
// reach the ntry>0 branch is to call removeOverlapScalingOnly directly.
// ---------------------------------------------------------------------------

describe('sfdp remove_overlap ntry>0 guard (direct call)', () => {
  function makeMinimalMatrix(): ReturnType<typeof smFromCoordinateArrays> {
    return smFromCoordinateArrays(
      /* nz= */ 2,
      /* m= */ 2,
      /* n= */ 2,
      { irn: [0, 1], jcn: [1, 0], val: [1, 1] },
      MATRIX_TYPE_REAL,
    );
  }

  it('throws when ntry > 0 is passed directly', () => {
    const A = makeMinimalMatrix();
    const x = [0, 0, 1, 1];
    const labelSizes = [10, 10, 10, 10];
    expect(() =>
      removeOverlapScalingOnly(2, A, x, labelSizes, /* ntry= */ 1, /* initialScaling= */ 0),
    ).toThrow('sfdp remove_overlap ntry=1');
  });

  it('does not throw when ntry = 0 (the default prism0 path)', () => {
    const A = makeMinimalMatrix();
    const x = [0, 0, 1, 1];
    const labelSizes = [10, 10, 10, 10];
    expect(() =>
      removeOverlapScalingOnly(2, A, x, labelSizes, /* ntry= */ 0, /* initialScaling= */ 0),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Control: tuneControl does not throw when no special attributes are present
// ---------------------------------------------------------------------------

describe('tuneControl control', () => {
  it('does not throw on a graph with no sfdp-specific attrs', () => {
    const g = parse(SFDP_SIMPLE);
    sfdpInitGraph(g);
    const ctrl = springElectricalControlNew();
    expect(() => tuneControl(g, ctrl)).not.toThrow();
  });
});
