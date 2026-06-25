// SPDX-License-Identifier: EPL-2.0
/**
 * Text-measurer selection.
 *
 * Resolution order (when no explicit override is set):
 *   1. explicit override via setTextMeasurer (tests, host-faithful Node opt-in)
 *   2. GV_TEXT_MEASURER=estimate  — test/CI hook for deterministic rules validation
 *   3. browser (document present) — CanvasTextMeasurer over the page canvas
 *      (host-faithful: the same font the browser renders the SVG with)
 *   4. Node default               — LutTextMeasurer
 *
 * Host-faithful Node measurement (node-canvas) is intentionally NOT auto-loaded:
 * the library has ZERO runtime deps and ships a single browser+Node bundle, so
 * `canvas` must never be imported from src. Node consumers opt in explicitly:
 *   `setTextMeasurer(new CanvasTextMeasurer(createCanvas(0,0).getContext('2d')))`
 *
 * @see lib/common/textspan.c:estimate_textspan_size
 * @see plans/fix-xcoord-position/DESIGN.md
 */

import {
  LutTextMeasurer, CanvasTextMeasurer, EstimateTextMeasurer, type TextMeasurer,
} from './textmeasure.js';

let override: TextMeasurer | undefined;

/**
 * Install a process-wide text measurer, overriding auto-resolution. Pass
 * `undefined` to clear and restore auto-resolution. Takes effect on the next
 * render (renderSvg resolves the measurer per call). Use for deterministic
 * tests or to wire a host-faithful Node measurer (e.g. node-canvas) — see the
 * resolution note above.
 */
export function setTextMeasurer(m: TextMeasurer | undefined): void {
  override = m;
}

/** The current explicit override, or undefined when auto-resolving. */
export function getTextMeasurer(): TextMeasurer | undefined {
  return override;
}

/** Browser-safe read of an env var (Node only; undefined in the browser). */
function envMeasurer(): string | undefined {
  return typeof process !== 'undefined' ? process.env?.GV_TEXT_MEASURER : undefined;
}

/** Resolve the text measurer for this render (see resolution order above). */
export function createMeasurer(): TextMeasurer {
  if (override) return override;
  if (envMeasurer() === 'estimate') return new EstimateTextMeasurer();
  if (typeof document !== 'undefined') {
    try {
      const ctx2d = document.createElement('canvas').getContext('2d');
      if (ctx2d) return new CanvasTextMeasurer(ctx2d);
    } catch { /* canvas unavailable */ }
  }
  return new LutTextMeasurer();
}
