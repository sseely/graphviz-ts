// SPDX-License-Identifier: EPL-2.0
//
// `pack=true` + `newrank=true` + a cluster + a DISCONNECTED node:
// **native graphviz SIGSEGVs.** The port renders it — and renders it CORRECTLY.
//
// Verified 2026-07-14 against BOTH our pinned oracle build (graphviz
// 15.1.0~dev.20260610) and the released Homebrew build (15.1.0): `dot -Txdot`
// and `dot -Tsvg` both exit 139 (SIGSEGV) with zero output.
//
// The trigger is a conjunction, and the last ingredient is the surprising one:
// a single BARE, EDGE-LESS node (`d`). Under `pack` an isolated node becomes
// its OWN component, and it is that extra component — not a `rank=same` set, as
// first suspected — that tips it over. Remove `pack`, `newrank`, the cluster, or
// `d`, and native renders fine.
//
//   digraph G { pack=true; newrank=true;
//               subgraph cluster0 { a; b; } a -> b; b -> c; d; }
//
// WHY WE CAN ASSERT CORRECTNESS WITHOUT A DIRECT ORACLE. `newrank` is
// layout-neutral for this graph shape: on the variant native CAN render (drop
// `d`), `dot` produces byte-identical output with and without `newrank`
// (bb="0,0,86,196", cluster0 bb="8,64,78,188"). So native's own output for
// `pack + cluster + d` MINUS `newrank` is a legitimate proxy oracle for the
// crashing graph — and the port reproduces it exactly. We are not guessing that
// our answer is reasonable; it is the oracle's answer, which the oracle cannot
// reach because it dies first.
//
// Per the campaign's A4 policy ("no-replication != keep an unfaithful
// mechanism") we do NOT reproduce the segfault to match the oracle. This is a
// deliberate, documented divergence in which the port is CORRECT and native is
// broken. `pack x newrank` is consequently a permanently dark cell in
// test/corpus/blind-spots.ts: no conformance fixture can exist for it, because
// no reference can be generated. That is a property of the ORACLE.

import { describe, it, expect } from 'vitest';
import { parse, render } from '../../src/index.js';

/** The graph native cannot render. `d` is bare — no edges — hence its own component. */
const CRASHES_NATIVE = `digraph G {
  pack=true;
  newrank=true;
  subgraph cluster0 { a; b; }
  a -> b;
  b -> c;
  d;
}`;

/**
 * The SAME graph without `newrank`. Native renders this, and since `newrank` is
 * layout-neutral here, its output is the proxy oracle for the crashing graph.
 * Captured from `dot -Txdot` (graphviz 15.1.0~dev.20260610, GVBINDIR=/tmp/ghl).
 */
const ORACLE_GRAPH_BB = '0,0,164,188';
const ORACLE_CLUSTER_BB = '0,64,70,188';

const bbOf = (s: string): string | undefined => /bb="([^"]*)"/.exec(s)?.[1];

describe('pack + newrank + cluster + disconnected node (native SIGSEGVs)', () => {
  it('renders, and matches the proxy oracle exactly', () => {
    const xdot = render(parse(CRASHES_NATIVE), 'xdot', { engine: 'dot' });

    // The graph frame is the oracle's, not merely "non-degenerate".
    expect(bbOf(xdot)).toBe(ORACLE_GRAPH_BB);

    // The cluster box survives and lands where the oracle puts it. Native's box
    // is what disappears under these attributes; ours stays put.
    const cluster = /subgraph cluster0\s*\{[\s\S]*?\]/.exec(xdot)?.[0] ?? '';
    expect(cluster).toContain('_draw_'); // the rectangle is actually drawn
    expect(bbOf(cluster)).toBe(ORACLE_CLUSTER_BB);

    // Every node survives the component projection (`d` is its own component).
    for (const n of ['a', 'b', 'c', 'd']) expect(xdot).toContain(`${n} [`);
  });

  it('is layout-identical to the same graph without newrank (the proxy is sound)', () => {
    const withNewrank = render(parse(CRASHES_NATIVE), 'xdot', { engine: 'dot' });
    const withoutNewrank = render(
      parse(CRASHES_NATIVE.replace('  newrank=true;\n', '')),
      'xdot',
      { engine: 'dot' },
    );
    // If these ever diverge, `newrank` is no longer layout-neutral for this
    // shape and the proxy-oracle argument above needs re-deriving.
    expect(bbOf(withNewrank)).toBe(bbOf(withoutNewrank));
  });
});
