// SPDX-License-Identifier: EPL-2.0

/**
 * DECISION GUARD — wedged node fills are "close enough" and do NOT conformant
 * C graphviz 15.0.0 / glibc. This is an accepted outcome, not a bug.
 *
 * Why: the elliptic-arc subdivision count differs by platform libm. The port's
 * `estimateError` lands at ~4.5e-6 under V8 vs >1e-5 under glibc, straddling
 * the 1e-5 threshold — so the port emits roughly half the Bézier cubics per
 * wedge (31 coord-pairs/wedge here vs 55 from glibc). The wedges are visually
 * equivalent; only the control points differ. A segment-count difference is
 * structural, not a numeric tolerance gap, so it cannot be tolerance-pinned —
 * hence there is NO wedged golden.
 *
 * This file PINS the port's own wedge geometry so the decision can't drift:
 *   - a regression that breaks wedged rendering fails here, AND
 *   - any change that alters the subdivision (e.g. a well-meaning attempt to
 *     match glibc's 55) trips this test, forcing a conscious re-review of the
 *     decision instead of silent drift.
 *
 * If a platform/runtime change legitimately shifts the port's subdivision,
 * update PORT_WEDGE_COORD_PAIRS deliberately and note it in the journal — do
 * NOT chase glibc parity by hand.
 *
 * @see plans/multicolor-paint/decision-journal.md (S1 WEDGED libm divergence)
 * @see .probes/wedged-comparison.html (side-by-side port vs C, when present)
 * @see src/render/svg-multicolor.test.ts (wedged structural assertions)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

/** The port's V8-subdivided wedge size for the canonical 3-equal-color case. */
const PORT_WEDGE_COORD_PAIRS = 31;
/** glibc's subdivision for the same case (what we intentionally do NOT match). */
const GLIBC_WEDGE_COORD_PAIRS = 55;

const WEDGED_3 = 'digraph { a [shape=ellipse style=wedged fillcolor="red:green:blue"] }';

/** Coordinate pairs ("x,y") in a path's `d` attribute — the subdivision metric. */
function coordPairs(pathEl: string): number {
  const d = /\bd="([^"]*)"/.exec(pathEl)?.[1] ?? '';
  return (d.match(/-?\d[\d.]*,-?\d[\d.]*/g) ?? []).length;
}

function wedgePaths(svg: string): string[] {
  return svg.match(/<path[^>]*\/>/g) ?? [];
}

describe('wedged fill — accepted divergence from C/glibc (decision guard)', () => {
  const paths = wedgePaths(renderSvg(WEDGED_3, 'dot'));

  it('renders three wedge paths (structural regression guard)', () => {
    expect(paths).toHaveLength(3);
    for (const p of paths) expect(p).toContain('d="M27,-18');
  });

  it('pins the port (V8) subdivision so it cannot silently drift', () => {
    for (const p of paths) {
      expect(coordPairs(p)).toBe(PORT_WEDGE_COORD_PAIRS);
    }
  });

  it('intentionally does NOT match glibc — wedged parity is out of scope', () => {
    for (const p of paths) {
      expect(coordPairs(p)).not.toBe(GLIBC_WEDGE_COORD_PAIRS);
    }
  });
});
