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

/** One-time latch for the Node host-faithful advice note (process-global). */
let adviceShown = false;

/**
 * Emit a one-time note that Node is using built-in (approximate) metrics and how
 * to get host-faithful measurement. Interactive-only (TTY) so it never spams CI,
 * tests, or piped output; silence with GV_FONT_QUIET. @see ADR-5
 */
function adviseHostFaithful(): void {
  if (adviceShown || typeof process === 'undefined') return;
  if (process.env?.GV_FONT_QUIET || !process.stderr?.isTTY) return;
  adviceShown = true;
  process.stderr.write(
    'graphviz-ts: measuring text with built-in metrics (kerning/shaping not applied). '
    + 'For host-faithful sizing matching the rendering font, install `canvas` and call '
    + "setTextMeasurer(new CanvasTextMeasurer(createCanvas(0,0).getContext('2d'))). "
    + 'Silence with GV_FONT_QUIET=1.\n',
  );
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
  adviseHostFaithful(); // Node, no host canvas → built-in metrics
  return new LutTextMeasurer();
}
