// SPDX-License-Identifier: EPL-2.0
/**
 * Text measurement utilities: LUT-based and Canvas-based.
 * Ported from lib/common/textspan_lut.c and lib/common/textspan.c.
 *
 * @see lib/common/textspan_lut.c
 * @see lib/common/textspan.c:estimate_textspan_size
 */

import { type FontFamilyData } from "./textmeasure-lut-data.js";
import { getFamilyMetrics } from "./textmeasure-lookup.js";

/** Number of hard-coded font families in the LUT. */
export const LUT_FAMILY_COUNT = 11;

/** Estimated size of a text string in points. */
export interface TextSize {
  w: number;
  h: number;
}

/** Abstraction over text measurement strategies. */
export interface TextMeasurer {
  measure(text: string, fontname: string, fontsize: number): TextSize;
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
 */
export function freetypeHintedWidth(
  fontName: string,
  text: string,
  fontsize: number,
): number {
  const family = getFamilyMetrics(fontName);
  const widths = getVariantWidths(family, false, false);
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

/** FreeType-hinted font ascent in points (baseline distance from line top). */
export function freetypeAscent(fontsize: number): number {
  const px = Math.round(FREETYPE_ASCENT_RATIO * fontsize * FREETYPE_PX_PER_PT);
  return px * PT_PER_FREETYPE_PX;
}

/**
 * LUT-based TextMeasurer. Width from LUT quantised to FreeType's 96 dpi
 * pixel grid; height matches FreeType Times-Roman.
 * @see lib/common/textspan.c:estimate_textspan_size
 */
export class LutTextMeasurer implements TextMeasurer {
  measure(text: string, fontname: string, fontsize: number): TextSize {
    const w = freetypeHintedWidth(fontname, text, fontsize);
    return { w, h: fontsize * FREETYPE_LINE_SPACING };
  }
}

/**
 * Canvas-based TextMeasurer via CanvasRenderingContext2D.
 * Height is fontsize (matches C behavior).
 * @see lib/common/textspan.c:estimate_textspan_size
 */
export class CanvasTextMeasurer implements TextMeasurer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  measure(text: string, fontname: string, fontsize: number): TextSize {
    this.ctx.font = `${fontsize}px ${fontname}`;
    const m = this.ctx.measureText(text);
    return { w: m.width, h: fontsize };
  }
}
