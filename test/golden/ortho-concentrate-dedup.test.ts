// SPDX-License-Identifier: EPL-2.0

/**
 * Structural test for the splines=ortho + concentrate edge dedup
 * (corpus 2361). C's ortho gather (lib/ortho/ortho.c:1207-1228) maintains a
 * point-set keyed by the UNORDERED node pair: the first edge between a pair
 * (in either direction) is routed, and any later edge sharing that pair — the
 * reverse leg of a 2-cycle, or a parallel multi-edge — is skipped. This is
 * ortho's own concentrate mechanism, separate from class2's edge_type=IGNORED.
 *
 * Before the fix, the port's ortho adapter routed every non-self edge, so the
 * seven 2-cycles in 2361 each drew BOTH directions — 32 edge groups vs native's
 * 25. This is a structure-strict guard (edge-group count + absence of the seven
 * concentrated-away reverse legs); it deliberately does not assert coordinates,
 * because 2361 is an HTML-free ortho graph whose residual is ortho maze
 * channel-assignment fidelity (structural-match, not conformant).
 *
 * @see lib/ortho/ortho.c:1207-1228 (orthoEdges Concentrate point-set)
 * @see src/layout/dot/ortho-adapter.ts buildEdges
 */

import { describe, test, expect } from 'vitest';
import { renderSvg } from '../../src/index.js';

// Corpus 2361 (graphviz/tests/2361.dot), inlined so the test is self-contained
// and browser-safe (no filesystem dependency on the C test tree).
const DOT_2361 = `digraph G {
    splines=ortho;
    concentrate=true;
    fontname=Arial;
    node [shape=box];
    rankdir="LR";
    SW -> AC; IW -> AC; IV -> AC;
    FF -> AF; FF -> IK; FF -> IV;
    AC -> CI; AC -> FS; AC -> FW; AC -> IV; AC -> IW; AC -> MF; AC -> PF; AC -> PG;
    PF -> FF; IK -> FF; IK -> FS; IK -> FW; IK -> GF; IK -> MF; IK -> PF; IK -> PG;
    PG -> GF; MF -> IK; MF -> IV; GF -> IK; GF -> IV;
    FS -> IK; FS -> IV; FW -> IK; FW -> IV; CI -> IK;
}`;

/** Count `<g ... class="edge">` groups in an SVG. */
function edgeGroupCount(svg: string): number {
  return (svg.match(/class="edge"/g) ?? []).length;
}

/** Collect edge titles (TAIL->HEAD) from the SVG. */
function edgeTitles(svg: string): Set<string> {
  const titles = new Set<string>();
  const re = /<title>([^<]*?)(?:&#45;&gt;|->)([^<]*?)<\/title>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) titles.add(`${m[1]}->${m[2]}`);
  return titles;
}

describe('splines=ortho + concentrate edge dedup (corpus 2361)', () => {
  const svg = renderSvg(DOT_2361, 'dot');

  test('draws exactly 25 edge groups (native count), not 32', () => {
    expect(edgeGroupCount(svg)).toBe(25);
  });

  test('the reverse leg of each 2-cycle is concentrated away', () => {
    // The seven 2-cycles are AC<->IV, AC<->IW, FF<->IK, IK<->FS, IK<->FW,
    // IK<->GF, IK<->MF. C keeps the first edge per pair in agfstnode/agfstout
    // order; the reverse legs below must NOT be emitted as separate edges.
    const titles = edgeTitles(svg);
    for (const dropped of ['IV->AC', 'IW->AC', 'IK->FF', 'FS->IK', 'FW->IK', 'GF->IK', 'MF->IK']) {
      expect(titles.has(dropped), `${dropped} should be concentrated away`).toBe(false);
    }
    // The kept legs survive.
    for (const kept of ['AC->IV', 'AC->IW', 'FF->IK', 'IK->FS', 'IK->FW', 'IK->GF', 'IK->MF']) {
      expect(titles.has(kept), `${kept} should be drawn`).toBe(true);
    }
  });
});
