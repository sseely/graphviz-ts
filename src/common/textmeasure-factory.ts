// SPDX-License-Identifier: EPL-2.0
/**
 * Factory that selects the best available TextMeasurer for the runtime.
 * Uses CanvasTextMeasurer in browsers, LutTextMeasurer elsewhere.
 *
 * @see lib/common/textspan.c:estimate_textspan_size
 */

import {
  LutTextMeasurer, CanvasTextMeasurer, EstimateTextMeasurer, type TextMeasurer,
} from './textmeasure.js';

/**
 * Returns a CanvasTextMeasurer when a browser canvas is available,
 * otherwise falls back to LutTextMeasurer.
 */
export function createMeasurer(): TextMeasurer {
  // Test/CI hook: force a measurer for deterministic rules validation. `estimate`
  // = the raw headless-matching reference (ADR-1). T1.1 folds this into the public
  // setTextMeasurer + resolution chain.
  const forced = process.env.GV_TEXT_MEASURER;
  if (forced === 'estimate') return new EstimateTextMeasurer();
  if (typeof document === 'undefined') return new LutTextMeasurer();
  try {
    const ctx2d = document.createElement('canvas').getContext('2d');
    if (ctx2d) return new CanvasTextMeasurer(ctx2d);
  } catch { /* canvas unavailable */ }
  return new LutTextMeasurer();
}
