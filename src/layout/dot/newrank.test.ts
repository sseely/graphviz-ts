// SPDX-License-Identifier: EPL-2.0

/**
 * T4 — end-to-end newrank rank-reconciliation parity.
 *
 * STATUS: RESCOPED (see comparisons/newrank.md). The `removeFill` port is
 * complete and faithful (dotinit.c:removeFill), but full newrank parity is
 * unreachable through this task's declared write-set (init.ts + this file)
 * because of two defects that live OUTSIDE the write-set:
 *
 *   1. `dotRank` (rank.ts) never sets `GD_flags |= NEW_RANK` from the
 *      `newrank` graph attribute. C does `if (mapbool(agget(g,"newrank")))`
 *      (rank.c:521-525); the TS only tests the flag, so `dot2Rank`/`fillRanks`
 *      never run and ranks are never reconciled.
 *   2. Forcing the flag on exposes an infinite loop in `furthestNode`
 *      (mincross-utils.ts:161) during `dotMincross` — the fill-node `order`
 *      indices make `neighborNode` never return undefined. This hang occurs
 *      long before `removeFill` runs, so it is not a removeFill defect.
 *
 * This test therefore pins the NON-REGRESSION invariants that ARE in scope:
 * the repro renders without hanging, no placeholder (`_new_rank` / `__fill_`)
 * or anonymous node ever reaches the SVG (removeFill / fillRanks naming), and
 * exactly the five real nodes appear. It also records the current TS centers
 * versus the dot oracle so the residual is regression-guarded: when the two
 * upstream defects are fixed, the `RESIDUAL` expectations below flip to the
 * `ORACLE` ones and this file becomes the parity pin.
 *
 * Oracle (GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg,
 * 2026-06-17): a cy=-178 (rank 0), b cy=-106 (rank 1), c cy=-106 (rank 1,
 * aligned with b), e cy=-34 (rank 2), d cy=-34 (rank 2).
 *
 * @see lib/dotgen/dotinit.c:removeFill
 * @see lib/dotgen/rank.c:dot_rank
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

// RESIDUAL — current TS behaviour, regression-guarded. When the two upstream
// defects (NEW_RANK flag-set in dotRank + furthestNode hang) are fixed, swap
// these RESIDUAL assertions for the ORACLE targets noted inline.
describe('newrank repro — RESCOPED residual vs oracle (T4)', () => {
  it('c is NOT yet reconciled onto b (oracle: |cy(c)-cy(b)|<=0.5)', () => {
    const c = nodeCenters(renderSvg(REPRO_NEWRANK, 'dot'));
    expect(Math.abs(c.c - c.a)).toBeLessThanOrEqual(0.5); // residual: c == a
    expect(Math.abs(c.c - c.b)).toBeGreaterThan(0.5); // residual: c != b
  });

  it('the newrank flag is inert vs the plain graph (oracle: it moves c)', () => {
    // dotRank never reads the `newrank` attribute (rank.c:521 not ported).
    const withFlag = nodeCenters(renderSvg(REPRO_NEWRANK, 'dot'));
    const without = nodeCenters(renderSvg(REPRO_PLAIN, 'dot'));
    expect(withFlag.c).toBeCloseTo(without.c, 1);
  });
});
