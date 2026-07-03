// SPDX-License-Identifier: EPL-2.0

/**
 * T4 — end-to-end newrank rank-reconciliation parity (DONE).
 *
 * `newrank=true` now reconciles a cross-cluster `rank=same` set to match the
 * dot oracle. The two blockers the prior mission rescoped are fixed:
 *   1. `dotRank` reads `mapbool(agget(g,"newrank"))` (rank.c:523) — T2.
 *   2. `markClusters` treats undefined `ranktype` as NORMAL (cluster.c:317) so
 *      a cross-cluster rank=same node gets `ND_clust` and is installed once,
 *      not double-installed into the root rank array (which hung furthestNode)
 *      — T3. See docs/newrank-c-trace.md.
 *
 * Pins (1) non-regression invariants — renders without hanging, no placeholder
 * (`_new_rank` / `__fill_`) or anonymous node reaches the SVG, exactly five
 * real nodes; and (2) oracle parity — c reconciles onto b's rank, all centers
 * match the dot binary ≤0.5pt, the flag drives the change, plus a 2nd corpus
 * case.
 *
 * Oracle (GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot, 2026-06-17):
 * a=-178 (r0), b=-106 (r1), c=-106 (r1, =b), e=-34 (r2), d=-34 (r2).
 *
 * @see lib/dotgen/rank.c:dot_rank
 * @see lib/dotgen/cluster.c:mark_clusters
 * @see lib/dotgen/dotinit.c:removeFill
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const Q = String.fromCharCode(34);
// <title>NAME</title> ... <ellipse ... cy="N"> — node groups only.
const RE_NODE = new RegExp(
  '<title>([^<]+)</title>\\s*<ellipse[^>]*\\bcy=' + Q + '(-?[0-9.]+)' + Q,
  'g',
);
const RE_TITLE = /<title>([^<]+)<\/title>/g;

const REPRO_NEWRANK =
  'digraph{newrank=true; subgraph cluster0{a->b->e} ' +
  'subgraph cluster1{c->d} a->c; {rank=same; b; c}}';
const REPRO_PLAIN =
  'digraph{subgraph cluster0{a->b->e} ' +
  'subgraph cluster1{c->d} a->c; {rank=same; b; c}}';

/** Map of node-title → ellipse cy in the SVG frame. */
function nodeCenters(svg: string): Record<string, number> {
  RE_NODE.lastIndex = 0;
  const out: Record<string, number> = {};
  let m: RegExpExecArray | null;
  while ((m = RE_NODE.exec(svg)) !== null) out[m[1]] = parseFloat(m[2]);
  return out;
}

/** Every `<title>` text in the SVG (clusters, nodes, and edges). */
function allTitles(svg: string): string[] {
  RE_TITLE.lastIndex = 0;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = RE_TITLE.exec(svg)) !== null) out.push(m[1]);
  return out;
}

describe('newrank repro — non-regression invariants (T4)', () => {
  it('renders without hanging and exposes exactly 5 real nodes', () => {
    const c = nodeCenters(renderSvg(REPRO_NEWRANK, 'dot'));
    expect(Object.keys(c).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('emits no placeholder or anonymous node (removeFill / fill naming)', () => {
    const svg = renderSvg(REPRO_NEWRANK, 'dot');
    // removeFill must delete every `__fill_<rank>_<seq>` node in `_new_rank`.
    expect(svg).not.toContain('_new_rank');
    expect(svg).not.toContain('__fill_');
    const titles = allTitles(svg);
    expect(titles.some((t) => t.includes('%'))).toBe(false);
    expect(titles.filter((t) => /^[a-e]$/.test(t)).sort()).toEqual(
      ['a', 'b', 'c', 'd', 'e'],
    );
  });

  it('rank spacing is one rank (72pt) apart — geometry sanity', () => {
    const c = nodeCenters(renderSvg(REPRO_NEWRANK, 'dot'));
    expect(Math.abs(c.a - c.e)).toBeCloseTo(144, 1);
    expect(Math.abs(c.a - c.b)).toBeCloseTo(72, 1);
  });
});

// ORACLE PARITY — c reconciles onto b's rank, matching the dot binary ≤0.5pt.
// Oracle: a=-178, b=-106, c=-106 (=b), e=-34, d=-34.
const ORACLE = { a: -178, b: -106, c: -106, e: -34, d: -34 } as const;
const REPRO_CORPUS2 =
  'digraph{newrank=true; subgraph cluster0{a->b} ' +
  'subgraph cluster1{c->d} {rank=same; b; c}}';

describe('newrank repro — oracle parity (cross-cluster rank=same)', () => {
  it('every node center matches the dot oracle ≤0.5pt', () => {
    const c = nodeCenters(renderSvg(REPRO_NEWRANK, 'dot'));
    for (const k of Object.keys(ORACLE) as (keyof typeof ORACLE)[]) {
      expect(Math.abs(c[k] - ORACLE[k])).toBeLessThanOrEqual(0.5);
    }
    expect(Math.abs(c.c - c.b)).toBeLessThanOrEqual(0.5); // c reconciled onto b
    expect(Math.abs(c.c - c.a)).toBeGreaterThan(0.5); // c moved off a's rank
  });
});

describe('newrank — the flag drives the reconciliation', () => {
  // REPRO_PLAIN (no newrank=true) SEGFAULTS the native C oracle (exit 139,
  // reproducible: `GVBINDIR=/tmp/ghl dot -Tsvg` on this exact cross-cluster
  // rank=same topology without newrank). There is no defined C behavior to
  // match — F4's ufUnion faithfulness fix (decomp.ts) made the port's
  // union-find topology hit the same degenerate cluster/rankset state C's
  // native binary crashes on; the port throws a RenderError instead of
  // segfaulting, which is the correct browser-safe outcome. See
  // .agent-notes/decomp-ufunion-id-faithfulness.md.
  it('newrank moves c onto b (with flag); plain graph is a C-crash input', () => {
    const withFlag = nodeCenters(renderSvg(REPRO_NEWRANK, 'dot'));
    expect(withFlag.c).toBeCloseTo(withFlag.b, 1);
    expect(() => renderSvg(REPRO_PLAIN, 'dot')).toThrow();
  });
});

describe('newrank corpus — a second cross-cluster rank=same case', () => {
  it('cluster0{a->b} cluster1{c->d} rank=same b;c → c aligns with b', () => {
    const c = nodeCenters(renderSvg(REPRO_CORPUS2, 'dot'));
    expect(c.a).toBeCloseTo(-178, 1);
    expect(c.b).toBeCloseTo(-106, 1);
    expect(c.c).toBeCloseTo(-106, 1); // oracle: c aligns with b
    expect(c.d).toBeCloseTo(-34, 1);
  });
});
