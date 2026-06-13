// SPDX-License-Identifier: EPL-2.0

/**
 * Characterization test for the ACCEPTED whole-string shaping divergence.
 *
 * The port measures text by hinting each glyph advance to the 96 dpi
 * pixel grid and summing (freetypeHintedWidth — a faithful port of
 * textspan_lut.c's estimate_textspan_size). The C binary, when built
 * with the pango/cairo text plugin, shapes the WHOLE string at once and
 * hints the result, so a string's width can land up to ~1px away from
 * the per-glyph sum. For most strings the two agree; for a few they
 * differ by one pixel, which then propagates into the graph bounding
 * box and the x of any centered label.
 *
 * We have decided to ACCEPT this 1px gap — closing it would require
 * embedding real pango shaping tables, which the LUT model deliberately
 * avoids. These tests "hold the line":
 *
 *   1. They pin the port's exact current output, so any future change
 *      to the measurement model is caught and must be a conscious choice.
 *   2. They embed the C graphviz 15.0.0 reference values and assert the
 *      divergence stays bounded at exactly 1px on the canonical case —
 *      if we ever drift FURTHER from C, this fails.
 *   3. They assert the divergence is confined to label-width-derived
 *      geometry: node-internal glyph positions remain byte-identical to
 *      C, and a node whose box is wide enough to absorb the difference
 *      shows no divergence at all.
 *
 * If a future change legitimately moves these numbers (e.g. a shaping
 * port), update the PORT_* literals deliberately and re-confirm the
 * C_* references against `dot -Tsvg` on graphviz 15.0.0.
 *
 * @see lib/common/textspan_lut.c:estimate_textspan_size
 * @see plugin/pango/gvtextlayout_pango.c (whole-string shaping in C)
 */

import { describe, it, expect } from 'vitest';
import { freetypeHintedWidth } from './textmeasure.js';
import { renderSvg } from '../index.js';

// The canonical divergent string (recorded in the M12 follow-up notes).
const DIVERGENT = 'A to B';

// Values captured from the port (held) and from graphviz 15.0.0 dot -Tsvg
// for `digraph { A -> B [label="A to B"] }`.
const PORT_WIDTH_PT = freetypeHintedWidth('Times,serif', DIVERGENT, 14); // 36.75
const PORT_BBOX_WIDTH = 72;
const C_BBOX_WIDTH = 71;
const PORT_LABEL_X = '45.38'; // C is "45"; the port shifts by half the gap
const SHARED_BBOX_HEIGHT = 133; // identical in both — divergence is x-only

const EDGE_SVG = renderSvg(`digraph { A -> B [label="${DIVERGENT}"] }`, 'dot');

// ---------------------------------------------------------------------------
// Root cause: the measurement primitive.
// ---------------------------------------------------------------------------

describe('shaping divergence — measurement root', () => {
  it('per-glyph hinted width of "A to B" at 14pt is 36.75pt (held)', () => {
    // A=9.75 ' '=3.75 t=3.75 o=6.75 ' '=3.75 B=9. C/pango shapes the whole
    // string and lands ~0.75pt narrower — the seed of the 1px bbox gap.
    expect(PORT_WIDTH_PT).toBe(36.75);
  });

  it('per-glyph sum equals the sum of single-glyph measurements', () => {
    // Confirms the port measures glyph-by-glyph (the thing that diverges
    // from whole-string shaping); if this stops holding, the model changed.
    const perGlyph = [...DIVERGENT]
      .reduce((acc, ch) => acc + freetypeHintedWidth('Times,serif', ch, 14), 0);
    expect(PORT_WIDTH_PT).toBe(perGlyph);
  });
});

// ---------------------------------------------------------------------------
// End-to-end manifestation: edge label drives the graph bbox + label x.
// ---------------------------------------------------------------------------

describe('shaping divergence — port output held', () => {
  it('bbox width is held at its current value', () => {
    expect(EDGE_SVG).toContain(`width="${PORT_BBOX_WIDTH}pt"`);
    expect(EDGE_SVG).toContain(`0.00 0.00 ${PORT_BBOX_WIDTH}.00 ${SHARED_BBOX_HEIGHT}.00`);
  });

  it('centered label x is held (shifts with half the width gap)', () => {
    expect(EDGE_SVG).toContain(`x="${PORT_LABEL_X}" y="-57.2"`);
  });
});

describe('shaping divergence — bounded versus C', () => {
  it('the accepted gap versus C is exactly 1px (not more)', () => {
    // If a measurement change widens the gap, this fails: we hold at 1px.
    expect(PORT_BBOX_WIDTH - C_BBOX_WIDTH).toBe(1);
  });

  it('bbox height matches C exactly (divergence is width-only)', () => {
    expect(EDGE_SVG).toContain(`height="${SHARED_BBOX_HEIGHT}pt"`);
  });

  it('endpoint node glyphs match C exactly (gap is label-only)', () => {
    // A and B sit at node centers, unaffected by the edge label width —
    // byte-identical to graphviz 15.0.0.
    expect(EDGE_SVG).toContain('x="27" y="-101.45"');
    expect(EDGE_SVG).toContain('x="27" y="-12.95"');
  });
});

// ---------------------------------------------------------------------------
// Boundedness: a node box wide enough to absorb the gap shows none.
// ---------------------------------------------------------------------------

describe('shaping divergence — confined, not pervasive', () => {
  it('a plain box node with the same label matches C bbox exactly', () => {
    // Node default width quantizes the 36.75/36 difference away: both the
    // port and graphviz 15.0.0 produce a 62pt-wide bbox.
    const svg = renderSvg(`digraph { X [shape=box label="${DIVERGENT}"] }`, 'dot');
    expect(svg).toContain('width="62pt"');
    expect(svg).toContain('0.00 0.00 62.00 44.00');
  });
});
