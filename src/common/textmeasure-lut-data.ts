// SPDX-License-Identifier: EPL-2.0
/**
 * Aggregated font-family metrics LUT.
 * Individual per-family data lives in textmeasure-lut-data-{a,b,c}.ts.
 *
 * @see lib/common/textspan_lut.c:all_font_metrics
 */

/** Per-family glyph width data, ported from FontFamilyMetrics in textspan_lut.c. */
export interface FontFamilyData {
  /** Normalized (letters-only, lowercase) font names for this family. */
  readonly names: readonly string[];
  /** TrueType units per em (denominator for width scaling). */
  readonly unitsPerEm: number;
  /** Per-character widths in (unitsPerEm × 1) pt; -1 = unknown. */
  readonly regular: readonly number[];
  readonly bold: readonly number[];
  readonly italic: readonly number[];
  readonly boldItalic: readonly number[];
}

export {
  TIMES_FAMILY,
  ARIAL_FAMILY,
  COURIER_FAMILY,
  NUNITO_FAMILY,
} from "./textmeasure-lut-data-a.js";

export {
  DEJAVU_FAMILY,
  CONSOLAS_FAMILY,
  TREBUCHET_FAMILY,
} from "./textmeasure-lut-data-b.js";

export {
  VERDANA_FAMILY,
  OPENSANS_FAMILY,
  GEORGIA_FAMILY,
  CALIBRI_FAMILY,
} from "./textmeasure-lut-data-c.js";

import {
  TIMES_FAMILY,
  ARIAL_FAMILY,
  COURIER_FAMILY,
  NUNITO_FAMILY,
} from "./textmeasure-lut-data-a.js";

import {
  DEJAVU_FAMILY,
  CONSOLAS_FAMILY,
  TREBUCHET_FAMILY,
} from "./textmeasure-lut-data-b.js";

import {
  VERDANA_FAMILY,
  OPENSANS_FAMILY,
  GEORGIA_FAMILY,
  CALIBRI_FAMILY,
} from "./textmeasure-lut-data-c.js";

/**
 * All font family metrics in the same order as the C source.
 * @see lib/common/textspan_lut.c:all_font_metrics
 */
export const ALL_FONT_METRICS: readonly FontFamilyData[] = [
  TIMES_FAMILY,
  ARIAL_FAMILY,
  COURIER_FAMILY,
  NUNITO_FAMILY,
  DEJAVU_FAMILY,
  CONSOLAS_FAMILY,
  TREBUCHET_FAMILY,
  VERDANA_FAMILY,
  OPENSANS_FAMILY,
  GEORGIA_FAMILY,
  CALIBRI_FAMILY,
];
