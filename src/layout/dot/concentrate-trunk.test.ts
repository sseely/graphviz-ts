// SPDX-License-Identifier: EPL-2.0

/**
 * Regression: a concentrate-merged virtual chain must route the shared trunk.
 *
 * For `digraph { concentrate=true; a->b [label="1"]; c->b; d->b }` the `c->b`
 * and `d->b` virtual chains merge at a rank-1 node `vMERGE` (in.size==2,
 * out.size==1, so `spline_merge(vMERGE)` is true). Native dot (15.1.0) routes
 * `c->b` (edge2, the merge representative) as a TWO-piece spline: the lead-in
 * `c -> vMERGE` plus the shared trunk `vMERGE -> b` that carries the arrowhead;
 * `d->b` (edge3) draws only its lead-in `d -> vMERGE` (the trunk belongs to the
 * representative, `getMainEdge(vMERGE->b) == c->b`).
 *
 * C gathers the merge node's out-edge as its own segment and `clip_and_install`
 * appends it as a second bezier on the representative (one `<path>` per bezier,
 * emit.c:1997). The port previously routed each original edge's whole chain as a
 * single spline, so `c->b` emitted only one `<path>`. This pins the 2-piece
 * trunk (corpus 2559).
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (spline_merge gather + clip_and_install)
 * @see plans/fix-concentrate-2559/comparisons/T1-investigation.md
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOT_2559 =
  'digraph {\n  concentrate=true\n  a -> b [label="1"]\n  c -> b\n  d -> b\n}\n';

/** Count `<path>` elements inside each `<g id="edgeN" class="edge">` group. */
function edgePathCounts(svg: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of svg.matchAll(
    /<g id="(edge\d+)" class="edge">([\s\S]*?)<\/g>/g,
  )) {
    out[m[1]] = (m[2].match(/<path/g) ?? []).length;
  }
  return out;
}

describe('concentrate merged-trunk routing (corpus 2559)', () => {
  it('routes c->b as a 2-piece trunk; d->b draws only its lead-in', () => {
    const svg = renderSvg(DOT_2559, 'dot');
    const counts = edgePathCounts(svg);
    // edge1 a->b: plain multi-rank chain through the label node (1 spline).
    expect(counts['edge1']).toBe(1);
    // edge2 c->b: lead-in (c->vMERGE) + shared trunk (vMERGE->b) = 2 paths.
    expect(counts['edge2']).toBe(2);
    // edge3 d->b: lead-in only (the trunk is owned by the representative c->b).
    expect(counts['edge3']).toBe(1);
  });

  it('matches the headless 15.1.0 golden ref trunk structure', () => {
    const ref = readFileSync(
      join(__dirname, '../../../test/golden/refs/concentrate-2559.svg'),
      'utf8',
    );
    const refCounts = edgePathCounts(ref);
    // Pin the reference baseline so the assertion above tracks native, not a
    // hand-picked number (ADR-2: headless 15.1.0 oracle).
    expect(refCounts).toEqual({ edge1: 1, edge2: 2, edge3: 1 });
  });
});
