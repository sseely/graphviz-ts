// SPDX-License-Identifier: EPL-2.0
//
// Regression tests for dot_concentrate cluster vlist rebuilding
// (mission fix-2183-ortho-concentrate).
//
// The repro shape: concentrate=true and a cluster whose internal edge spans
// several ranks, so intermediate ranks are populated ONLY by that edge's
// chain vnodes. rebuild_vlists must infuse those vnodes as rankleaders
// (C walks the cluster's ORIGINAL out-edges through ED_to_virt,
// conc.c:146-155); feeding it fast-graph segments instead left the ranks
// leaderless, dot_concentrate returned -1, and dotPosition aborted before
// the x-solve — collapsing the layout and leaving cluster bbs degenerate
// (corpus 2183).

import { describe, it, expect, vi } from 'vitest';
import { renderSvg } from '../../index.js';

// Verbatim corpus 2183 (BPMN swimlanes): edge labels double the ranks, so
// cluster rank spans contain vnode-only ranks — the failing condition.
// (splines=ortho removed: this test targets the concentrate/vlist layer.)
const REPRO = `strict digraph Production {
  concentrate=true
  stylesheet="bpmn.css"
  node [shape=rectangle, style=rounded, class="task"]
  edge [class="sequenceFlow"]

  subgraph cluster_A {
    label="A"
    class="swimlane"

    a [xlabel="a", shape=circle, label="", class="event start"]
    a -> "b" -> "c" -> d
    d [shape=circle, label="", class="event end escalation"]

    e [xlabel="e", shape=doublecircle, label="",
       class="event intermediate message catching"]
    e -> "f" -> g
    g [label="g"]

    h [class="event message catching", shape=doublecircle]
  }
  subgraph cluster_B {
    label="B"
    class="swimlane"

    i [xlabel="i", shape=circle, label="", class="event start timer"]
    i -> "j" -> "k" -> l
    l [shape=doublecircle, label="",
       class="event intermediate message throwing"]
  }
  "c" -> m -> e [style=dotted, class="association"]
  m [label="m", shape="note", class="dataObject"]
  l -> e [style=dashed, class="messageFlow"]

  subgraph cluster_C {
    label="C"
    class="swimlane"

    n [class="event intermediate message catching", shape=doublecircle]
    n -> o
    o [class="gate exclusive", label="X", shape=diamond]
    o -> q [label="Z"]
    q [class="event intermediate message throwing"]
    o -> "p" [label="Y"]
    "p" -> q
  }
  //Budgeting
  r [class="dataObject", shape=note]
  g -> n [class="messageFlow", style=dashed]
  g -> r -> n [class="association", style=dotted]
  o -> h [class="messageFlow", style=dashed]
  o -> r -> h [class="association", style=dotted]

  subgraph cluster_D {
    class="swimlane"
    label="D"
  }

}
`;

function clusterPolyPoints(svg: string): string {
  const m = /class="cluster[^"]*">\s*<title>cluster_A<\/title>\s*<polygon[^>]*points="([^"]*)"/.exec(svg);
  expect(m, 'cluster_A polygon present').toBeTruthy();
  return m![1];
}

describe('concentrate + multi-rank intra-cluster edge (corpus 2183 class)', () => {
  const svg = renderSvg(REPRO, 'dot');

  it('renders a non-degenerate cluster box', () => {
    const pts = clusterPolyPoints(svg).split(' ').map((p) => p.split(',').map(Number));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(10);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(10);
  });

  it('places the cluster label', () => {
    expect(svg).toMatch(/>A</);
  });

  it('keeps the concentrated intra-cluster edge', () => {
    expect(svg).toContain('<title>a&#45;&gt;b</title>');
  });
});

// Corpus 2825: cross-cluster rank=same plus a rankset-conflict deletion
// leaves cluster_inner rank 1 with no rankleader. C's rebuild_vlists
// (conc.c:158-161) errors, dot_concentrate (conc.c:239-242) reports a
// continuation warning and returns -1, and dot_position propagates that
// failure so dotLayout (dotinit.c:322-325) never reaches dot_splines or
// dotneato_postprocess. The port must reach and report the identical
// failure, then skip the identical downstream phases.
const REPRO_2825 = `digraph CrashPOC {
  concentrate=true

  subgraph cluster_outer {
    subgraph cluster_inner {
      A -> B -> C -> D
      B -> E
      I -> H -> C -> F
      D -> G

      P [shape=point style=invis]
      {B C D E F} -> P [constraint="false" style=invis]
    }

    H -> A
    {rank=same; H; B}
  }
}
`;

describe('rebuild_vlists failure propagation (corpus 2825 class)', () => {
  it('reports the same error/warning sequence as C, in order', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderSvg(REPRO_2825, 'dot');
    const msgs = spy.mock.calls.map((c) => c[0]).filter((m) => typeof m === 'string');
    spy.mockRestore();
    expect(msgs).toContain('Warning: B was already in a rankset, deleted from cluster cluster_outer');
    expect(msgs).toContain('Warning: H was already in a rankset, deleted from cluster cluster_outer');
    expect(msgs).toContain('Error: rebuild_vlists: lead is null for rank 1');
    expect(msgs).toContain('concentrate=true may not work correctly.');
    // @see lib/dotgen/conc.c:158-161,239-242 for the message ordering.
    const errIdx = msgs.indexOf('Error: rebuild_vlists: lead is null for rank 1');
    const warnIdx = msgs.indexOf('concentrate=true may not work correctly.');
    expect(errIdx).toBeLessThan(warnIdx);
  });

  it('skips dot_splines/dotneato_postprocess: no edges or point node emitted', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const svg = renderSvg(REPRO_2825, 'dot');
    spy.mockRestore();
    expect(svg).not.toMatch(/class="edge"/);
    expect(svg).not.toContain('<title>P</title>');
  });

  it('leaves cluster boxes degenerate: set_aspect never ran', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const svg = renderSvg(REPRO_2825, 'dot');
    spy.mockRestore();
    const m = /<title>cluster_outer<\/title>\s*<polygon[^>]*points="([^"]*)"/.exec(svg);
    expect(m, 'cluster_outer polygon present').toBeTruthy();
    expect(m![1]).toBe('0,0 0,0 0,0 0,0 0,0');
  });
});
