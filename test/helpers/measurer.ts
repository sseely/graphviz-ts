// SPDX-License-Identifier: EPL-2.0
import { beforeEach, afterEach } from 'vitest';
import { setTextMeasurer } from '../../src/common/textmeasure-factory.js';
import { LutTextMeasurer } from '../../src/common/textmeasure.js';

/**
 * Pin renders in this test file to the hinted `LutTextMeasurer`.
 *
 * The shipped Node default is `EstimateTextMeasurer` (deterministic, matches
 * headless graphviz — see plans/fix-xcoord-position/DESIGN.md). Characterization
 * tests that assert exact coordinates of a particular vertical/shaping model pin
 * the measurer so they stay stable and keep testing that model; the Estimate
 * default's geometry is covered by the golden suite (test/golden). Call once at
 * the top level of a test file.
 */
export function pinLutMeasurer(): void {
  // Set immediately so module-top-level renders (e.g. `const SVG = renderSvg(...)`
  // captured at import time, before beforeEach fires) also use the LUT model.
  setTextMeasurer(new LutTextMeasurer());
  beforeEach(() => setTextMeasurer(new LutTextMeasurer()));
  afterEach(() => setTextMeasurer(undefined));
}
