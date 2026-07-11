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
// sfdp overlap dispatch (public API — via sfdpLayout). graphAdjustMode's GTS
// default is "prism0" (AM_PRISM value 0). On the GTS reference build every
// supported mode is now wired: prism*/false → AM_PRISM (in-sfdp OverlapSmoother),
// scale → AM_NSCALE (post-layout scAdjust), true → AM_NONE. All render.
// @see lib/sfdpgen/sfdpinit.c:sfdp_layout / lib/neatogen/adjust.c:getAdjustMode
// ---------------------------------------------------------------------------

describe('sfdp overlap dispatch', () => {
  for (const mode of ['false', 'prism', 'prism0', 'scale', 'true']) {
    it(`renders (no throw) with overlap="${mode}"`, () => {
      const g = parse(SFDP_SIMPLE);
      g.attrs.set('overlap', mode);
      expect(() => sfdpLayout(g)).not.toThrow();
      for (const n of g.nodes.values()) expect(n.info.pos).toBeDefined();
    });
  }

  it('does not throw with default attrs (no overlap attribute)', () => {
    const g = parse(SFDP_SIMPLE);
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
