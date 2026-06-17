// SPDX-License-Identifier: EPL-2.0

/**
 * T5 — expand_leaves / LEAFSET leaf packing parity.
 *
 * Faithful-port finding (verify-first): upstream `expand_leaves`
 * (lib/dotgen/position.c:1015) is, in effect, `make_leafslots(g)` only. Its
 * per-node loop body is unreachable because of a dormant self-subtraction bug:
 *
 *   position.c:1025  if ((d = ND_rank(aghead(e)) - ND_rank(aghead(e))) == 0)
 *                       continue;
 *
 * `d` is `headRank - headRank`, identically 0, so `continue` always fires and
 * the `zapinlist`/`fast_edge` body never runs. The bug has existed since the
 * 2004 initial revision and is never fixed upstream; the oracle binary is built
 * from this exact tree, so reproducing it (doing nothing beyond
 * `makeLeafslots`) is the faithful behavior.
 *
 * Furthermore, the `LEAFSET` ranktype is NEVER assigned anywhere in the upstream
 * tree — const.h:39 defines `LEAFSET 6` and it is only ever read
 * (position.c:985, rank.c:486). The leaf-collapse codepath that would set
 * `ND_ranktype = LEAFSET` does not exist in this Graphviz version, so
 * `makeLeafslots`' expand branch is itself a no-op for every possible input.
 *
 * Consequence for this test: real LEAFSET packing cannot be triggered from any
 * DOT input. Per AD-4 the task is RESCOPED — we keep the faithful no-op
 * implementation and pin two properties:
 *
 *   1. `expandLeaves` does not move node positions on a built graph (unit).
 *   2. A leaf-heavy graph rendered end-to-end still matches the dot oracle to
 *      within 0.5pt (proves switching the stub to call `makeLeafslots` did not
 *      perturb output / goldens).
 *
 * Oracle captured 2026-06-17 via:
 *   GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg leafy.dot
 *
 * @see lib/dotgen/position.c:1015 expand_leaves
 * @see lib/dotgen/position.c:1025 dormant headRank-headRank bug
 * @see lib/common/const.h:39 LEAFSET (defined, never assigned)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import type { RankEntry } from '../../model/rankEntry.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { expandLeaves, makeLeafslots } from './position.js';
import { graphMinrank, graphMaxrank } from './position-aux.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Leaf-heavy graph: a root, three internal nodes, nine leaves. */
const LEAFY_DOT = `digraph {
  root -> a; root -> b; root -> c;
  a -> l1; a -> l2; a -> l3;
  b -> m1; b -> m2;
  c -> n1; c -> n2; c -> n3; c -> n4;
}`;

/** Oracle node centers (SVG frame; cy already negated y-up). */
const ORACLE_CENTERS: Readonly<Record<string, { cx: number; cy: number }>> = {
  root: { cx: 279, cy: -162 },
  a: { cx: 135, cy: -90 },
  b: { cx: 279, cy: -90 },
  c: { cx: 459, cy: -90 },
  l1: { cx: 27, cy: -18 },
  l2: { cx: 99, cy: -18 },
  l3: { cx: 171, cy: -18 },
  m1: { cx: 243, cy: -18 },
  m2: { cx: 315, cy: -18 },
  n1: { cx: 387, cy: -18 },
  n2: { cx: 459, cy: -18 },
  n3: { cx: 531, cy: -18 },
  n4: { cx: 603, cy: -18 },
};

const TOL = 0.5;

const Q = String.fromCharCode(34);
const RE_NODE = new RegExp(
  '<title>([^<]+)</title>\\s*<ellipse[^>]*cx=' + Q + '(-?[0-9.]+)' + Q +
    '\\s+cy=' + Q + '(-?[0-9.]+)' + Q,
  'g',
);

/** Parse `<title>name</title> ... <ellipse cx cy>` node centers from SVG. */
function svgNodeCenters(svg: string): Record<string, { cx: number; cy: number }> {
  const out: Record<string, { cx: number; cy: number }> = {};
  RE_NODE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_NODE.exec(svg)) !== null) {
    out[m[1]] = { cx: Number(m[2]), cy: Number(m[3]) };
  }
  return out;
}

function makeRankEntry(): RankEntry {
  return {
    n: 0, v: [], an: 0, av: [],
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
  };
}

/**
 * Build a minimal two-rank graph wired through the rank-array structure that
 * `makeLeafslots`/`expandLeaves` read. No node carries LEAFSET ranktype (none
 * can — see file header), so the expand branch must not fire.
 */
function makeRankedGraph(): { g: Graph; nodes: Node[] } {
  const g = new Graph('test', 'directed');
  const nodes: Node[] = [];
  for (let i = 0; i < 5; i++) {
    const n = new Node(i, `n${i}`, g);
    n.info = makeNodeInfo();
    g.nodes.set(n.name, n);
    nodes.push(n);
  }
  // rank 0: n0 ; rank 1: n1..n4
  const r0 = makeRankEntry();
  r0.v = [nodes[0]];
  r0.n = 1;
  nodes[0].info.rank = 0;
  nodes[0].info.order = 0;
  nodes[0].info.coord = { x: 100, y: 200 };

  const r1 = makeRankEntry();
  r1.v = [nodes[1], nodes[2], nodes[3], nodes[4]];
  r1.n = 4;
  for (let i = 1; i < 5; i++) {
    nodes[i].info.rank = 1;
    nodes[i].info.order = i - 1;
    nodes[i].info.coord = { x: (i - 1) * 72, y: 100 };
  }
  g.info.rank = [r0, r1];
  g.info.minrank = 0;
  g.info.maxrank = 1;
  return { g, nodes };
}

/** Flatten rank-slot state to a comparable signature: name@order per slot. */
function rankSlotSignature(g: Graph): string {
  const parts: string[] = [];
  for (let r = graphMinrank(g); r <= graphMaxrank(g); r++) {
    const rk = g.info.rank![r];
    parts.push(`r${r}:${rk.n}`);
    for (let i = 0; i < rk.n; i++) {
      const v = rk.v[i];
      parts.push(`${v?.name ?? '_'}@${v?.info.order ?? '_'}`);
    }
  }
  return parts.join(',');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('expandLeaves — coordinates unchanged', () => {
  it('does not move nodes on a non-LEAFSET graph', () => {
    const { g, nodes } = makeRankedGraph();
    const before = nodes.map(n => ({ x: n.info.coord.x, y: n.info.coord.y }));
    expandLeaves(g);
    for (let i = 0; i < nodes.length; i++) {
      expect(nodes[i].info.coord.x).toBe(before[i].x);
      expect(nodes[i].info.coord.y).toBe(before[i].y);
    }
  });
});

describe('expandLeaves — rank-slot state unchanged', () => {
  it('keeps dense slot order on a non-LEAFSET graph', () => {
    // No ranktype is LEAFSET, so makeLeafslots assigns j = i+1 and never
    // expands: orders stay dense 0..n-1 and rank.n is unchanged.
    const { g } = makeRankedGraph();
    expandLeaves(g);
    expect(rankSlotSignature(g)).toBe('r0:1,n0@0,r1:4,n1@0,n2@1,n3@2,n4@3');
  });

  it('is equivalent to makeLeafslots (loop body is dead upstream)', () => {
    const a = makeRankedGraph();
    const b = makeRankedGraph();
    expandLeaves(a.g);
    makeLeafslots(b.g);
    expect(rankSlotSignature(a.g)).toBe(rankSlotSignature(b.g));
  });
});

describe('leaf-heavy graph — oracle parity (positions unmoved)', () => {
  it('matches dot node centers within 0.5pt', () => {
    const svg = renderSvg(LEAFY_DOT, 'dot');
    const centers = svgNodeCenters(svg);

    for (const [name, oracle] of Object.entries(ORACLE_CENTERS)) {
      const got = centers[name];
      expect(got, `missing node ${name}`).toBeDefined();
      expect(Math.abs(got.cx - oracle.cx), `${name}.cx`).toBeLessThanOrEqual(TOL);
      expect(Math.abs(got.cy - oracle.cy), `${name}.cy`).toBeLessThanOrEqual(TOL);
    }
  });
});
