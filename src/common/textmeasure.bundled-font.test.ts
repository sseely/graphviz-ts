// SPDX-License-Identifier: EPL-2.0
//
// Measurement-layer tests (mission: text-measurement architecture, T2.1).
//
// Validates that real-font shaping (kerning, GSUB substitution, charset,
// monospace) is handled correctly and DETERMINISTICALLY — the values derive only
// from the committed fonts in test/fonts/ + the bundled `fontkit` shaper, so they
// are identical on every platform. This is the layer the deterministic
// EstimateTextMeasurer (a per-char table) cannot represent, which is why
// production measures with the host font (system canvas) — see DESIGN.md §5.2.

import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';

import { EstimateTextMeasurer } from './textmeasure.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const FONTS = fileURLToPath(new URL('../../test/fonts/', import.meta.url));
const dv: any = (fontkit as any).openSync(FONTS + 'DejaVuSans.ttf');
const fc: any = (fontkit as any).openSync(FONTS + 'FiraCode-Regular.ttf');

/** Shaped advance width of `s` in points (kerning + GSUB applied). */
const advPt = (f: any, s: string, size = 14): number =>
  (f.layout(s).advanceWidth / f.unitsPerEm) * size;
/** Per-glyph advance sum (no kerning/shaping across the boundary). */
const unkernedPt = (f: any, s: string, size = 14): number =>
  ([...s].reduce((a, ch) => a + f.layout(ch).advanceWidth, 0) / f.unitsPerEm) * size;

describe('bundled-font measurement: real shaping vs deterministic estimate', () => {
  // ── kerning (width-affecting) ──────────────────────────────────────────────
  it('kerning narrows width: DejaVu "VA" shaped < unkerned sum', () => {
    expect(advPt(dv, 'VA')).toBeLessThan(unkernedPt(dv, 'VA'));
    expect(advPt(dv, 'To')).toBeLessThan(unkernedPt(dv, 'To'));
  });

  it('the deterministic estimate does NOT kern (VA == V + A)', () => {
    const est = new EstimateTextMeasurer();
    const va = est.measure('VA', 'DejaVu', 14).w;
    const v = est.measure('V', 'DejaVu', 14).w;
    const a = est.measure('A', 'DejaVu', 14).w;
    expect(va).toBeCloseTo(v + a, 9); // no GPOS kerning in the per-char table
  });

  // ── GSUB substitution ──────────────────────────────────────────────────────
  it('GSUB ligature: DejaVu "fi" shapes to a single glyph', () => {
    expect(dv.layout('fi').glyphs.length).toBe(1);
    expect(dv.layout('f').glyphs.length + dv.layout('i').glyphs.length).toBe(2);
  });

  // ── charset (estimate cannot cover non-ASCII) ──────────────────────────────
  it('charset: non-ASCII code points map to real glyphs with real advances', () => {
    for (const ch of ['é', 'ñ', '—', 'α']) {
      const g = dv.layout(ch).glyphs[0];
      expect(g.id).toBeGreaterThan(0); // not .notdef
      expect(g.advanceWidth).toBeGreaterThan(0);
    }
  });

  it('the estimate has no non-ASCII metrics (falls back) — why production needs the real font', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const est = new EstimateTextMeasurer();
    // 'é' is not in the per-char LUT; the estimate falls back (≈ space width),
    // which does NOT equal the font's real advance — only the system/real-font
    // measurer gets this right.
    const estE = est.measure('é', 'DejaVu', 14).w;
    const realE = advPt(dv, 'é');
    expect(estE).not.toBeCloseTo(realE, 1);
    warn.mockRestore();
  });

  // ── monospace: width is font-shaping-specific ──────────────────────────────
  it('monospace: FiraCode advances are uniform and "<=" is two cells', () => {
    const cell = advPt(fc, 'x');
    for (const ch of ['<', '=', '!', '>', 'M', 'i', 'W']) {
      expect(advPt(fc, ch)).toBeCloseTo(cell, 6);
    }
    expect(advPt(fc, '<=')).toBeCloseTo(2 * cell, 6);
  });

  // ── determinism ────────────────────────────────────────────────────────────
  it('advances derive only from the bundled font (stable, platform-independent)', () => {
    expect(dv.unitsPerEm).toBe(2048);
    expect(dv.layout('VA').advanceWidth).toBe(2671); // exact font-file value
    expect(dv.layout('V').advanceWidth + dv.layout('A').advanceWidth).toBe(2802);
  });
});
