// SPDX-License-Identifier: EPL-2.0
//
// `pack=true` + `newrank=true` + a cluster + a `rank=same` set:
// **native graphviz SIGSEGVs on this input.** The port renders it.
//
// Verified 2026-07-14 against BOTH our pinned oracle build
// (graphviz 15.1.0~dev.20260610) and the released Homebrew build
// (graphviz 15.1.0) — `dot -Txdot` exits 139 (SIGSEGV) with zero output on
// each. Removing EITHER `pack` or `newrank` makes native render normally, so
// the crash needs the conjunction.
//
// Consequence for the corpus: `pack x newrank` is a **permanently dark cell**
// (see test/corpus/blind-spots.ts). It can never become a golden conformance
// fixture, because no oracle reference can be generated for it. That is not a
// gap we can close — it is a property of the oracle.
//
// What we CAN lock in is that the port stays robust where native does not.
// Per the campaign's A4 policy ("no-replication != keep an unfaithful
// mechanism"), we do NOT reproduce a segfault to match the oracle.
//
// This test asserts only what is defensible without a reference: the port
// completes and produces a well-formed, non-degenerate drawing.

import { describe, it, expect } from 'vitest';
import { parse, render } from '../../src/index.js';

/** Minimal trigger. Both `pack` and `newrank` are required; `d` has no edges. */
const ORACLE_SEGFAULT_INPUT = `digraph G {
  pack=true;
  newrank=true;
  subgraph cluster0 { a; b; }
  a -> b;
  b -> c;
  { rank=same; c; d; }
}`;

describe('pack + newrank + cluster + rank=same (native SIGSEGVs)', () => {
  it('renders instead of crashing, and produces a non-degenerate bb', () => {
    const g = parse(ORACLE_SEGFAULT_INPUT);
    const xdot = render(g, 'xdot', { engine: 'dot' });

    const bb = /bb="([^"]*)"/.exec(xdot)?.[1];
    expect(bb).toBeDefined();

    const [llx, lly, urx, ury] = bb!.split(',').map(Number);
    expect(llx).toBe(0);
    expect(lly).toBe(0);
    // A real drawing, not a collapsed or NaN frame — the failure modes that
    // would make "it didn't throw" a vacuous assertion.
    expect(urx).toBeGreaterThan(0);
    expect(ury).toBeGreaterThan(0);
    expect(Number.isFinite(urx)).toBe(true);
    expect(Number.isFinite(ury)).toBe(true);

    // All four nodes must survive the component projection.
    for (const n of ['a', 'b', 'c', 'd']) {
      expect(xdot).toContain(`${n} [`);
    }
  });
});
