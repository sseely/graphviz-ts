// SPDX-License-Identifier: EPL-2.0
/**
 * Font-family lookup helpers for the text measurement LUT.
 * @see lib/common/textspan_lut.c:get_metrics_for_font_family
 */

import {
  ALL_FONT_METRICS,
  type FontFamilyData,
} from "./textmeasure-lut-data.js";

/** Times is always present; used as the fallback family. */
export const TIMES_FALLBACK: FontFamilyData = ALL_FONT_METRICS[0]!;

/**
 * Normalize a font name for permissive matching.
 * Lowercases and strips all non-ASCII-letter characters.
 * "Times New Roman" → "timesnewroman", "Times-Roman" → "timesroman".
 * @see lib/common/textspan_lut.c:font_name_equal_permissive
 */
export function normalizeFontName(name: string): string {
  let result = "";
  for (let i = 0; i < name.length; i++) {
    const ch = name[i]!;
    const code = ch.charCodeAt(0);
    const isLetter =
      (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (isLetter) result += ch.toLowerCase();
  }
  return result;
}

/** Set of font names that have already triggered the fallback warning. */
const warnedFontNames = new Set<string>();

/** @see lib/common/textspan_lut.c:get_metrics_for_font_family */
export function getFamilyMetrics(fontName: string): FontFamilyData {
  const key = normalizeFontName(fontName);
  for (const family of ALL_FONT_METRICS) {
    if (family.names.includes(key)) return family;
  }
  if (!warnedFontNames.has(fontName)) {
    warnedFontNames.add(fontName);
    console.warn(
      `Warning: no hard-coded metrics for '${fontName}'.  ` +
        `Falling back to 'Times' metrics`,
    );
  }
  return TIMES_FALLBACK;
}
