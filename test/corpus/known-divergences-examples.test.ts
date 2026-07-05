// SPDX-License-Identifier: EPL-2.0
//
// Prose-rot guard for docs/known-divergences.md.
//
// WHY THIS EXISTS. `accepted-divergences.test.ts` guards the machine-readable
// registry (accepted-divergences.json) — every REGISTERED accepted graph must
// stay non-conformant. But known-divergences.md also names specific graphs *in
// prose* as illustrative examples, and prose is not checked by that guard. That
// is exactly how `proc3d` rotted: it was cited in §A2 as the canonical
// structural-match example, was never added to the registry, and silently became
// conformant when the text-measurement work landed — the doc kept claiming it
// diverged for months while PARITY.md correctly showed it matching.
//
// This test encodes the doc's CURRENT per-graph claims as assertions against the
// live parity verdicts, so the prose cannot silently drift from reality.
//
// CONVENTION: when you cite a specific corpus graph in known-divergences.md as
// EITHER "now conformant / collapsed" OR "an active accepted divergence", add its
// id to the appropriate list below. Keep these lists in sync with the doc.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

interface Row { id: string; verdict: string }
const parityRows: Row[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('./parity.json', import.meta.url)), 'utf8'),
).results as Row[];
const verdictById = new Map(parityRows.map((r) => [r.id, r.verdict]));

// Graphs the doc now presents as CONFORMANT (former divergence examples that
// collapsed). If one of these regresses to non-conformant, the doc's "collapsed"
// claim is stale — fail so someone reconciles the prose. This is the assertion
// that would have caught proc3d.
const DOC_CLAIMS_CONFORMANT = [
  'graphs-proc3d', 'share-proc3d', 'windows-proc3d',
  // A2 closed 2026-07-01 (fix/nan-a2-retire): NaN family now conformant
  'graphs-NaN', 'share-NaN', 'windows-NaN',
];

// Graphs the doc cites as CURRENT accepted divergences (A2/A3 examples). If one
// becomes conformant, the doc example is stale — fail so someone removes it (and
// its registry entry). These are also guarded by accepted-divergences.test.ts;
// duplicated here to bind the PROSE claim, not just the registry.
const DOC_CLAIMS_DIVERGENT = [
  '2368',
  // A3 hypot-tie sibling of the oracle-pinned 241_0 (retired 2026-07-04)
  '241_1',
  // A4 init_rank/pathplan recovery family, sibling of 2471 (retired 2026-07-04)
  '2470',
  // A7 round()/box-wall rounding boundary in maximal_bbox (retired 2026-07-04)
  'graphs-honda-tokoro',
  // A3 hypot-tie family extension: label-vnode slit corridor (retired 2026-07-05)
  '2413_1',
  // A3 hypot-tie family extension: same corridor, 2 ties (retired 2026-07-05)
  '2413_2',
  // A3 hypot-tie family extension: intra-cluster labeled edge (retired 2026-07-05)
  'graphs-decorate',
  // A3 hypot-tie family extension: control-point mirror across 2 edges (retired 2026-07-05)
  '2371',
  // A8 new class: fp-contract/FMA knife-edge tangency in Proutespline (retired 2026-07-05)
  '2646',
];

describe('known-divergences.md prose ↔ parity verdicts', () => {
  it('every graph the doc calls conformant is actually conformant', () => {
    const stale = DOC_CLAIMS_CONFORMANT.filter(
      (id) => verdictById.get(id) !== 'conformant',
    ).map((id) => `${id} (${verdictById.get(id) ?? 'absent'})`);
    expect(
      stale,
      'doc claims these collapsed to conformant, but parity disagrees — reconcile known-divergences.md',
    ).toEqual([]);
  });

  it('every graph the doc cites as an active divergence is still non-conformant', () => {
    const stale = DOC_CLAIMS_DIVERGENT.filter((id) => {
      const v = verdictById.get(id);
      return v === undefined || v === 'conformant';
    }).map((id) => `${id} (${verdictById.get(id) ?? 'absent'})`);
    expect(
      stale,
      'doc cites these as accepted divergences, but they now conform (or are absent) — remove the stale example from known-divergences.md',
    ).toEqual([]);
  });
});
