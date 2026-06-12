// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  LUT_FAMILY_COUNT,
  LutTextMeasurer,
  estimate_text_width_1pt,
} from "./textmeasure.js";
import { ALL_FONT_METRICS } from "./textmeasure-lut-data.js";
import { normalizeFontName } from "./textmeasure-lookup.js";

// ── AC1: LUT_FAMILY_COUNT === 11 and all families resolve ────────────────────

describe("LUT_FAMILY_COUNT", () => {
  it("equals 11", () => {
    expect(LUT_FAMILY_COUNT).toBe(11);
  });

  it("ALL_FONT_METRICS has exactly 11 entries", () => {
    expect(ALL_FONT_METRICS.length).toBe(LUT_FAMILY_COUNT);
  });
});

describe("all 11 families resolve without fallback warning", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  const representativeNames = [
    "Times",
    "Arial",
    "Courier",
    "Nunito",
    "DejaVu Sans",
    "Consolas",
    "Trebuchet MS",
    "Verdana",
    "OpenSans",
    "Georgia",
    "Calibri",
  ] as const;

  for (const name of representativeNames) {
    it(`resolves "${name}" without warning`, () => {
      const measurer = new LutTextMeasurer();
      measurer.measure("A", name, 12);
      expect(console.warn).not.toHaveBeenCalled();
    });
  }
});

// ── AC2: font name normalization ──────────────────────────────────────────────

describe("font name normalization", () => {
  it("strips spaces and hyphens, lowercases", () => {
    expect(normalizeFontName("Times New Roman")).toBe("timesnewroman");
    expect(normalizeFontName("Times-Roman")).toBe("timesroman");
    expect(normalizeFontName("Arial MT")).toBe("arialmt");
  });

  it("LutTextMeasurer: 'Times New Roman' and 'Times' produce the same width", () => {
    const m = new LutTextMeasurer();
    const wTNR = m.measure("A", "Times New Roman", 12).w;
    const wTimes = m.measure("A", "Times", 12).w;
    expect(wTNR).toBe(wTimes);
  });
});

// ── AC3: unknown font warns exactly once across 3 calls ──────────────────────

describe("unknown font fallback warning", () => {
  it("warns exactly once across 3 calls for the same unknown name", () => {
    // Use a unique name each test run to avoid cross-test bleed from the module
    // level Set (which persists across tests in the same process).
    const uniqueName = `UnknownFont_${Math.random().toString(36).slice(2)}`;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const m = new LutTextMeasurer();
    m.measure("x", uniqueName, 10);
    m.measure("x", uniqueName, 10);
    m.measure("x", uniqueName, 10);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(uniqueName),
    );
    warnSpy.mockRestore();
  });
});

// ── AC4: FreeType pixel-grid quantisation ────────────────────────────────────
// Widths snap to the 96 dpi pixel grid (0.75 pt steps), so doubling the font
// size does NOT exactly double the width. Ground truth from graphviz 15.0.0
// reference SVGs: Times 14pt 'a' → 6.0 pt, 'b' → 6.75 pt.

describe("FreeType-hinted widths", () => {
  it("matches graphviz reference advances for Times 14pt", () => {
    const m = new LutTextMeasurer();
    expect(m.measure("a", "Times", 14).w).toBe(6.0);
    expect(m.measure("b", "Times", 14).w).toBe(6.75);
    expect(m.measure("c", "Times", 14).w).toBe(6.0);
  });

  it("quantises every advance to 0.75pt steps", () => {
    const m = new LutTextMeasurer();
    const w = m.measure("Hello", "Times", 14).w;
    expect((w / 0.75) % 1).toBeCloseTo(0, 10);
  });

  it("raw 1pt estimate still scales linearly", () => {
    const w1 = estimate_text_width_1pt("Times", "A", false, false);
    expect(w1).toBeGreaterThan(0);
    expect(estimate_text_width_1pt("Times", "AA", false, false)).toBeCloseTo(2 * w1, 10);
  });
});

// ── Additional: estimate_text_width_1pt sanity checks ────────────────────────

describe("estimate_text_width_1pt", () => {
  it("returns 0 for empty string", () => {
    expect(estimate_text_width_1pt("Times", "", false, false)).toBe(0);
  });

  it("bold width >= regular width for 'W' in Times", () => {
    const r = estimate_text_width_1pt("Times", "W", false, false);
    const b = estimate_text_width_1pt("Times", "W", true, false);
    expect(b).toBeGreaterThanOrEqual(r);
  });

  it("space character (0x20) returns non-negative width for Times", () => {
    const w = estimate_text_width_1pt("Times", " ", false, false);
    expect(w).toBeGreaterThanOrEqual(0);
  });

  it("width is proportional to string length for Courier (monospace)", () => {
    const w1 = estimate_text_width_1pt("Courier", "A", false, false);
    const w3 = estimate_text_width_1pt("Courier", "AAA", false, false);
    expect(Math.abs(w3 - 3 * w1)).toBeLessThan(1e-10);
  });
});

// ── AC5: variant-aware measure() — bold ──────────────────────────────────────

describe("LutTextMeasurer.measure bold variant", () => {
  it("bold 'hi' Times 14 is wider than regular", () => {
    const m = new LutTextMeasurer();
    const wReg = m.measure("hi", "Times", 14).w;
    const wBold = m.measure("hi", "Times", 14, { bold: true }).w;
    expect(wBold).toBeGreaterThan(wReg);
  });

  // TB[104]='h'=1139, TB[105]='i'=569, unitsPerEm=2048, 96 dpi grid
  // 'h': round(1139/2048*14*(96/72))=10px → 7.5pt
  // 'i': round(569/2048*14*(96/72))=5px → 3.75pt  total=11.25pt
  it("bold 'hi' Times 14 equals LUT bold-table value (11.25 pt)", () => {
    const m = new LutTextMeasurer();
    expect(m.measure("hi", "Times", 14, { bold: true }).w).toBeCloseTo(11.25, 5);
  });
});

// ── AC5: variant-aware measure() — regression & other variants ───────────────

describe("LutTextMeasurer.measure variant regression", () => {
  it("omitted flags produces same result as explicit regular", () => {
    const m = new LutTextMeasurer();
    const wNoFlags = m.measure("Hello", "Times", 14).w;
    expect(m.measure("Hello", "Times", 14, {}).w).toBe(wNoFlags);
    expect(m.measure("Hello", "Times", 14, { bold: false, italic: false }).w)
      .toBe(wNoFlags);
  });

  it("italic 'A' Times 14 differs from regular (TI[65]=1251 vs TR[65]=1479)", () => {
    const m = new LutTextMeasurer();
    const wReg = m.measure("A", "Times", 14).w;
    const wItal = m.measure("A", "Times", 14, { italic: true }).w;
    expect(wItal).not.toBe(wReg);
  });

  it("bold-italic 'A' Times 14 differs from bold-only (TB[65]=1479 vs TBI[65]=1366)", () => {
    const m = new LutTextMeasurer();
    const wBold = m.measure("A", "Times", 14, { bold: true }).w;
    const wBI = m.measure("A", "Times", 14, { bold: true, italic: true }).w;
    expect(wBI).not.toBe(wBold);
  });
});
