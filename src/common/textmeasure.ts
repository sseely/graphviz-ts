// SPDX-License-Identifier: EPL-2.0
/**
 * Text measurement utilities: LUT-based and Canvas-based.
 * Ported from lib/common/textspan_lut.c and lib/common/textspan.c.
 *
 * @see lib/common/textspan_lut.c
 * @see lib/common/textspan.c:estimate_textspan_size
 */

import { type FontFamilyData } from "./textmeasure-lut-data.js";
import { getFamilyMetrics, normalizeFontName } from "./textmeasure-lookup.js";

/** Number of hard-coded font families in the LUT. */
export const LUT_FAMILY_COUNT = 11;

/** Estimated size of a text string in points. */
export interface TextSize {
  w: number;
  h: number;
  /**
   * Baseline→centerline offset in points (C textspan_t.yoffset_centerline). The
   * vertical metric is part of the measurement model: native graphviz's estimate
   * uses 0.1·fontsize, while the font-plugin (pango) path is ≈0.05·fontsize. When
   * omitted, callers default to the 0.05·fontsize (pango-calibrated) value.
   * @see lib/common/textspan.c:estimate_textspan_size
   */
  yoffsetCenterline?: number;
  /**
   * Baseline→top (ascent) in points (C textspan_t.yoffset_layout). Native
   * estimate uses `fontsize`; the freetype/pango path uses the font ascent
   * (~0.89·fontsize). When omitted, callers fall back to the freetype ascent.
   * @see lib/common/textspan.c:estimate_textspan_size
   */
  yoffsetLayout?: number;
}

/**
 * Font variant flags (bold / italic) for text measurement.
 * Mirrors textfont_t.flags in the C source.
 * @see lib/common/textspan_lut.c:estimate_textspan_size (AD2)
 */
export interface TextVariantFlags {
  readonly bold?: boolean;
  readonly italic?: boolean;
}

/** Abstraction over text measurement strategies. */
export interface TextMeasurer {
  measure(
    text: string,
    fontname: string,
    fontsize: number,
    flags?: TextVariantFlags,
  ): TextSize;
}

// ── Variant selection ─────────────────────────────────────────────────────────

/** @see lib/common/textspan_lut.c:get_metrics_for_font_variant */
function getVariantWidths(
  family: FontFamilyData,
  bold: boolean,
  italic: boolean,
): readonly number[] {
  if (bold && italic) return family.boldItalic;
  if (bold) return family.bold;
  if (italic) return family.italic;
  return family.regular;
}

// ── Character width lookup ────────────────────────────────────────────────────

const SPACE_CHAR_CODE = 32;

/** @see lib/common/textspan_lut.c:estimate_character_width_canonical */
function charWidthUnits(widths: readonly number[], charCode: number): number {
  const code = charCode >= 128 ? SPACE_CHAR_CODE : charCode;
  const w = widths[code] ?? -1;
  return w < 0 ? 0 : w;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Estimates the width of text at 1 pt for the given font/variant.
 * Multiply by fontsize to get width at N pt.
 * @see lib/common/textspan_lut.c:estimate_text_width_1pt
 */
export function estimate_text_width_1pt(
  fontName: string,
  text: string,
  bold: boolean,
  italic: boolean,
): number {
  const family = getFamilyMetrics(fontName);
  const widths = getVariantWidths(family, bold, italic);
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += charWidthUnits(widths, text.charCodeAt(i));
  }
  return total / family.unitsPerEm;
}

/**
 * FreeType line-spacing ratio measured from graphviz 15.0.0 reference SVGs.
 * 14pt Times-Roman label height = 16.5pt → ratio = 16.5/14.
 * C's LINESPACING=1.20 is a fallback estimate; actual FreeType gives ~1.17857.
 * Kept for callers that want the 14pt-calibrated linear approximation;
 * the measurer itself uses the exact hinted model (freetypeLineHeight).
 * @see lib/common/textspan.c:estimate_textspan_size
 */
export const FREETYPE_LINE_SPACING = 16.5 / 14;

/**
 * graphviz's text layout plugin rasterises at 96 dpi, so every glyph
 * advance lands on an integer pixel and converts back at 72/96 pt per px.
 * Reference values (Times 14pt): 'a' 0.444em → 8.29px → 8px → 6pt;
 * 'b' 0.5em → 9.33px → 9px → 6.75pt.
 */
const FREETYPE_PX_PER_PT = 96 / 72;
const PT_PER_FREETYPE_PX = 72 / 96;

/**
 * Per-character FreeType-hinted text width in points: each glyph advance is
 * rounded to the 96 dpi pixel grid before summing.
 * @see lib/common/textspan_lut.c:estimate_textspan_size
 */
export function freetypeHintedWidth(
  fontName: string,
  text: string,
  fontsize: number,
  bold = false,
  italic = false,
): number {
  const family = getFamilyMetrics(fontName);
  const widths = getVariantWidths(family, bold, italic);
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const units = charWidthUnits(widths, text.charCodeAt(i));
    const px = Math.round((units / family.unitsPerEm) * fontsize * FREETYPE_PX_PER_PT);
    total += px * PT_PER_FREETYPE_PX;
  }
  return total;
}

/**
 * Times-Roman ascender ratio (TrueType hhea ascender 1825/2048em).
 * Hinted to the 96 dpi grid: 14pt → 17px → 12.75pt, matching the baseline
 * positions in graphviz reference SVGs.
 */
export const FREETYPE_ASCENT_RATIO = 1825 / 2048;

/** Times-Roman descender ratio (hhea descender 443/2048em). */
export const FREETYPE_DESCENT_RATIO = 443 / 2048;

/**
 * FreeType-hinted ascender/descender ratios (in em) for a font, used for the
 * hinted line height. Vertical metrics are keyed by the *resolved font*, NOT
 * the width family: the width LUT lumps Helvetica and Arial together (their
 * advances match), but on the reference system their line boxes differ
 * (Helvetica/Nimbus ≈ 1.0 em, real Arial ≈ taller, Times ≈ 1.107 em).
 */
interface VMetric {
  readonly ascent: number;
  readonly descent: number;
}

/** Times-Roman default (the historical hardcoded model). */
const TIMES_VMETRIC: VMetric = {
  ascent: FREETYPE_ASCENT_RATIO,
  descent: FREETYPE_DESCENT_RATIO,
};

/**
 * Helvetica / Nimbus Sans: ascender 1577/2048, descender 471/2048. Empirically
 * pinned to the native-dot oracle's hinted line height across fontsizes 6-48
 * (ceil(asc·px)+ceil(desc·px) reproduces every size exactly).
 */
const HELVETICA_VMETRIC: VMetric = { ascent: 1577 / 2048, descent: 471 / 2048 };

/**
 * Normalized font names whose line box matches Helvetica/Nimbus Sans on the
 * reference system. This is every sans alias the width LUT groups as Arial
 * EXCEPT the literal "arial": fontconfig resolves "Arial" to a real Arial face
 * with a taller line box (55px vs 49px at 36pt) — distinct from both Helvetica
 * and Times — so it keeps the Times default until pinned separately.
 * @see src/common/textmeasure-lut-data-a.ts ARIAL_FAMILY
 */
const HELVETICA_VMETRIC_NAMES: ReadonlySet<string> = new Set([
  "helvetica", "arialmt", "arimo", "albany",
  "nimbussans", "nimbussansa", "texgyreheros", "freesans", "liberationsans",
]);

/** Resolve the vertical metric for a font name (defaults to Times). */
function vMetricFor(fontname: string | undefined): VMetric {
  if (fontname === undefined) return TIMES_VMETRIC;
  return HELVETICA_VMETRIC_NAMES.has(normalizeFontName(fontname))
    ? HELVETICA_VMETRIC
    : TIMES_VMETRIC;
}

/**
 * FreeType-hinted font ascent in points (baseline distance from line
 * top). FreeType rounds the ascender UP to the pixel grid
 * (FT_PIX_CEIL); at 14pt ceil and round coincide (16.63 → 17px).
 * Font-aware: Helvetica's ascender differs from Times' (default when
 * `fontname` is omitted or is not a known Helvetica-metric face).
 */
export function freetypeAscent(fontsize: number, fontname?: string): number {
  const px = Math.ceil(vMetricFor(fontname).ascent * fontsize * FREETYPE_PX_PER_PT);
  return px * PT_PER_FREETYPE_PX;
}

/**
 * FreeType-hinted line height in points: ceil-hinted ascender plus
 * ceil-hinted descender magnitude (FT_PIX_CEIL / FT_PIX_FLOOR on the
 * negative descender). Verified against graphviz 15.0.0 two-line
 * baseline deltas for fontsizes 6-48 (e.g. Times 14pt → 17+5 px = 16.5pt;
 * Helvetica 36pt → 33+16 px = 36.75pt). Font-aware: defaults to Times when
 * `fontname` is omitted or is not a known Helvetica-metric face.
 */
export function freetypeLineHeight(fontsize: number, fontname?: string): number {
  const m = vMetricFor(fontname);
  const asc = Math.ceil(m.ascent * fontsize * FREETYPE_PX_PER_PT);
  const desc = Math.ceil(m.descent * fontsize * FREETYPE_PX_PER_PT);
  return (asc + desc) * PT_PER_FREETYPE_PX;
}

/**
 * LUT-based TextMeasurer. Width from LUT quantised to FreeType's 96 dpi
 * pixel grid; height matches FreeType Times-Roman.
 * @see lib/common/textspan.c:estimate_textspan_size
 */
export class LutTextMeasurer implements TextMeasurer {
  measure(
    text: string,
    fontname: string,
    fontsize: number,
    flags?: TextVariantFlags,
  ): TextSize {
    const bold = flags?.bold === true;
    const italic = flags?.italic === true;
    const w = freetypeHintedWidth(fontname, text, fontsize, bold, italic);
    return { w, h: freetypeLineHeight(fontsize, fontname) };
  }
}

/**
 * Canvas-based TextMeasurer via CanvasRenderingContext2D.
 * Height is fontsize (matches C behavior).
 * @see lib/common/textspan.c:estimate_textspan_size
 */
export class CanvasTextMeasurer implements TextMeasurer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  measure(
    text: string,
    fontname: string,
    fontsize: number,
    flags?: TextVariantFlags,
  ): TextSize {
    const bold = flags?.bold === true;
    const italic = flags?.italic === true;
    const style = bold && italic ? 'bold italic'
      : bold ? 'bold'
      : italic ? 'italic'
      : '';
    this.ctx.font = style ? `${style} ${fontsize}px ${fontname}` : `${fontsize}px ${fontname}`;
    const m = this.ctx.measureText(text);
    return { w: m.width, h: fontsize };
  }
}

/** graphviz estimate_textspan_size line spacing. @see lib/common/const.h:70 */
export const LINESPACING = 1.20;

/**
 * Raw textspan_lut.c estimate: un-hinted per-char widths summed once, no kerning,
 * height = fontsize * LINESPACING. Reproduces graphviz's HEADLESS measurement
 * (no textlayout plugin → estimate_textspan_size) exactly, making it the
 * deterministic, font-stack-independent reference for layout-rules validation.
 * Unlike LutTextMeasurer this does NOT apply per-char FreeType px hinting.
 * @see lib/common/textspan.c:estimate_textspan_size
 */
export class EstimateTextMeasurer implements TextMeasurer {
  measure(
    text: string,
    fontname: string,
    fontsize: number,
    flags?: TextVariantFlags,
  ): TextSize {
    const w = fontsize * estimate_text_width_1pt(
      fontname, text, flags?.bold === true, flags?.italic === true,
    );
    // native estimate_textspan_size: size.y = fontsize*LINESPACING,
    // yoffset_layout = fontsize, yoffset_centerline = 0.1*fontsize.
    return {
      w, h: fontsize * LINESPACING,
      yoffsetCenterline: 0.1 * fontsize, yoffsetLayout: fontsize,
    };
  }
}
