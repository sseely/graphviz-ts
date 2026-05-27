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
 * LUT-based TextMeasurer. Height is fontsize (matches C estimate_textspan_size).
 * @see lib/common/textspan.c:estimate_textspan_size
 */
export class LutTextMeasurer implements TextMeasurer {
  measure(text: string, fontname: string, fontsize: number): TextSize {
    const w = estimate_text_width_1pt(fontname, text, false, false) * fontsize;
    return { w, h: fontsize };
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
