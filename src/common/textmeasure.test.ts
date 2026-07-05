// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  LUT_FAMILY_COUNT,
  LutTextMeasurer,
  EstimateTextMeasurer,
  LINESPACING,
  estimate_text_width_1pt,
  freetypeHintedWidth,
  freetypeLineHeight,
  freetypeAscent,
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

// ── Non-ASCII: measure per UTF-8 byte, not per UTF-16 unit ───────────────────
// C's estimate_text_width_1pt loops over (unsigned char)*c — one canonical
// width per UTF-8 byte, every byte >=128 mapped to the space-width fallback.
// A JS string is UTF-16, so iterating charCodeAt under-counts multi-byte glyphs.
// These tests pin the byte-faithful behavior (AD-1, AD-2).

describe("estimate_text_width_1pt iterates UTF-8 bytes (non-ASCII)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("CJK '下駄配列' (4 chars / 12 UTF-8 bytes) measures as 12 spaces", () => {
    // Each non-ASCII byte folds to the space width; 4 CJK chars = 12 UTF-8 bytes.
    const s = "下駄配列";
    expect(new TextEncoder().encode(s).length).toBe(12);
    const space1pt = estimate_text_width_1pt("Times", " ", false, false);
    expect(estimate_text_width_1pt("Times", s, false, false))
      .toBeCloseTo(12 * space1pt, 12);
  });

  it("Cyrillic 'да' (2 chars / 4 UTF-8 bytes) measures as 4 spaces", () => {
    const s = "да";
    expect(new TextEncoder().encode(s).length).toBe(4);
    const space1pt = estimate_text_width_1pt("Times", " ", false, false);
    expect(estimate_text_width_1pt("Times", s, false, false))
      .toBeCloseTo(4 * space1pt, 12);
  });

  it("Latin-1 'é' (1 char / 2 UTF-8 bytes) measures as 2 spaces", () => {
    const s = "é"; // é
    expect(new TextEncoder().encode(s).length).toBe(2);
    const space1pt = estimate_text_width_1pt("Times", " ", false, false);
    expect(estimate_text_width_1pt("Times", s, false, false))
      .toBeCloseTo(2 * space1pt, 12);
  });

  it("ASCII width is byte-identical (byte == charCode for <128)", () => {
    // Byte iteration must not change any ASCII measurement.
    for (const s of ["Hello, World!", "AAA", "WAR-WR1VI1", " "]) {
      const widthsBytes = new TextEncoder().encode(s).length;
      expect(widthsBytes).toBe(s.length); // pure ASCII: 1 byte per char
      expect(estimate_text_width_1pt("Times", s, false, false))
        .toBeGreaterThanOrEqual(0);
    }
    // Concrete anchor: a known ASCII string sums its per-char widths.
    const perChar = "Ag".split("").reduce(
      (acc, ch) => acc + estimate_text_width_1pt("Times", ch, false, false), 0);
    expect(estimate_text_width_1pt("Times", "Ag", false, false))
      .toBeCloseTo(perChar, 12);
  });
});

describe("freetypeHintedWidth iterates UTF-8 bytes (non-ASCII)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("CJK '下駄配列' hints 12 space-byte advances, not 4", () => {
    const s = "下駄配列";
    // Each byte folds to space; hinted width = 12 × hinted space advance.
    const spaceHinted = freetypeHintedWidth("Times", " ", 14);
    expect(freetypeHintedWidth("Times", s, 14)).toBeCloseTo(12 * spaceHinted, 12);
  });

  it("ASCII hinted width unchanged (Times 14 'a'=6.0, 'b'=6.75)", () => {
    expect(freetypeHintedWidth("Times", "a", 14)).toBe(6.0);
    expect(freetypeHintedWidth("Times", "b", 14)).toBe(6.75);
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

// ── Font-aware vertical metrics (freetypeLineHeight / freetypeAscent) ─────────
//
// Helvetica/Nimbus Sans has a shorter line box than Times. The hinted line
// height (ceil(asc·px)+ceil(desc·px)) is pinned to the native-dot oracle's
// baseline-to-baseline delta across fontsizes 6-48. PX_PER_PT = 96/72; the
// oracle line height in px below converts to pt via ×0.75.

/** Oracle Helvetica line height in 96-dpi px, fontsizes 6..48. */
const HELVETICA_LINE_PX: Record<number, number> = {
  6: 9, 7: 11, 8: 12, 9: 13, 10: 15, 11: 16, 12: 17, 13: 18, 14: 20, 15: 21,
  16: 22, 17: 24, 18: 25, 19: 26, 20: 28, 21: 29, 22: 30, 23: 32, 24: 33,
  25: 34, 26: 35, 27: 37, 28: 38, 29: 39, 30: 41, 31: 42, 32: 43, 33: 45,
  34: 46, 35: 47, 36: 49, 37: 50, 38: 52, 39: 53, 40: 55, 41: 56, 42: 57,
  43: 59, 44: 60, 45: 61, 46: 63, 47: 64, 48: 65,
};

describe("freetypeLineHeight is font-aware", () => {
  it("matches the oracle Helvetica line height at every fontsize 6-48", () => {
    for (const [fsStr, px] of Object.entries(HELVETICA_LINE_PX)) {
      const fs = Number(fsStr);
      expect(freetypeLineHeight(fs, "Helvetica")).toBeCloseTo(px * 0.75, 9);
    }
  });

  it("applies the Helvetica metric to sans aliases (arialmt, nimbussans, etc.)", () => {
    const helv = freetypeLineHeight(36, "Helvetica");
    expect(helv).toBeCloseTo(36.75, 9);
    for (const alias of ["ArialMT", "Nimbus Sans", "Liberation Sans", "FreeSans"]) {
      expect(freetypeLineHeight(36, alias)).toBe(helv);
    }
  });

  it("keeps literal 'Arial' on the Times default (real Arial face differs; not Helvetica)", () => {
    // On the reference system fontconfig resolves "Arial" to a real Arial face,
    // distinct from both Helvetica and Times; pinning it is a separate follow-up.
    expect(freetypeLineHeight(36, "Arial")).toBe(freetypeLineHeight(36, "Times"));
    expect(freetypeLineHeight(36, "Arial")).not.toBeCloseTo(36.75, 9);
  });

  it("leaves Times unchanged (Times 36 → 40.5pt, 14 → 16.5pt)", () => {
    expect(freetypeLineHeight(36, "Times")).toBeCloseTo(40.5, 9);
    expect(freetypeLineHeight(14, "Times")).toBeCloseTo(16.5, 9);
  });

  it("defaults to Times when fontname is omitted (backward compatible)", () => {
    expect(freetypeLineHeight(36)).toBe(freetypeLineHeight(36, "Times"));
    expect(freetypeLineHeight(14)).toBe(freetypeLineHeight(14, "Times"));
  });

  it("unknown families fall back to Times metrics", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(freetypeLineHeight(36, "NoSuchFont")).toBe(freetypeLineHeight(36, "Times"));
  });
});

describe("freetypeAscent is font-aware", () => {
  it("uses the Helvetica ascender (1577/2048): fs36 → 37px → 27.75pt", () => {
    expect(freetypeAscent(36, "Helvetica")).toBeCloseTo(27.75, 9);
  });

  it("leaves Times ascent unchanged and defaults to it without a fontname", () => {
    // Times 1825/2048: fs36 → ceil(42.77)=43px → 32.25pt
    expect(freetypeAscent(36, "Times")).toBeCloseTo(32.25, 9);
    expect(freetypeAscent(36)).toBe(freetypeAscent(36, "Times"));
  });
});

// ── EstimateTextMeasurer: raw headless-matching (no hinting, no kerning) ──────

describe("EstimateTextMeasurer", () => {
  const m = new EstimateTextMeasurer();

  it("w == fontsize * estimate_text_width_1pt (raw, NOT hinted)", () => {
    // a hint-sensitive string whose hinted width differs from the raw width
    const text = "WAR-WR1VI1";
    const raw = 14 * estimate_text_width_1pt("Times", text, false, false);
    const hinted = freetypeHintedWidth("Times", text, 14);
    expect(hinted).not.toBeCloseTo(raw, 2); // guard: this string is hint-sensitive
    expect(m.measure(text, "Times", 14).w).toBeCloseTo(raw, 9);
    expect(m.measure(text, "Times", 14).w).not.toBeCloseTo(hinted, 2);
  });

  it("matches the raw estimate across families", () => {
    for (const font of ["Times", "Helvetica", "Courier"]) {
      const w = m.measure("Quartz glyph", font, 12).w;
      expect(w).toBeCloseTo(12 * estimate_text_width_1pt(font, "Quartz glyph", false, false), 9);
    }
  });

  it("height == fontsize * LINESPACING (1.20)", () => {
    expect(LINESPACING).toBe(1.20);
    expect(m.measure("x", "Times", 14).h).toBeCloseTo(14 * 1.20, 9);
    expect(m.measure("x", "Helvetica", 36).h).toBeCloseTo(36 * 1.20, 9);
  });

  it("honors bold/italic variant selection", () => {
    const plain = m.measure("Ag", "Times", 14, { bold: false, italic: false }).w;
    const bold = m.measure("Ag", "Times", 14, { bold: true, italic: false }).w;
    expect(plain).toBeCloseTo(14 * estimate_text_width_1pt("Times", "Ag", false, false), 9);
    expect(bold).toBeCloseTo(14 * estimate_text_width_1pt("Times", "Ag", true, false), 9);
  });
});

// ── LUT array-length guard ────────────────────────────────────────────────────
// C's FontFamilyMetrics widths arrays are `short widths_*[128]` (textspan_lut.c).
// A truncated array (fewer than 128 entries) silently shifts every index >=
// truncation point out of range; charWidthUnits' `widths[code] ?? -1` then maps
// those characters to width 0 instead of throwing or warning (see 1447 Courier
// truncation: indices 123-126 were missing, dropping { | } ~ to width 0).
// This guard fails loudly the moment any family array regresses in length.

describe("ALL_FONT_METRICS array-length guard (regression: 1447 Courier LUT)", () => {
  const variantNames = ["regular", "bold", "italic", "boldItalic"] as const;

  for (const family of ALL_FONT_METRICS) {
    for (const variant of variantNames) {
      it(`${family.names[0]}.${variant} has exactly 128 entries with widths[127] === -1`, () => {
        const widths = family[variant];
        expect(widths.length).toBe(128);
        expect(widths[127]).toBe(-1);
      });
    }
  }
});

// ── 1447 Courier regression: '{|}~' must not silently measure as width 0 ─────

describe("Courier width LUT includes { | } ~ (regression: 1447)", () => {
  it("estimates '{|}~' as 4 * 1229/2048 em at 1pt", () => {
    const w = estimate_text_width_1pt("Courier", "{|}~", false, false);
    expect(w).toBeCloseTo((4 * 1229) / 2048, 12);
  });

  it("each of { | } ~ individually measures 1229/2048 em (not 0)", () => {
    for (const ch of ["{", "|", "}", "~"]) {
      const w = estimate_text_width_1pt("Courier", ch, false, false);
      expect(w).toBeCloseTo(1229 / 2048, 12);
    }
  });
});
