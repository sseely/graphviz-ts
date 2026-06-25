// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import {
  createMeasurer, setTextMeasurer, getTextMeasurer,
} from './textmeasure-factory.js';
import {
  LutTextMeasurer, EstimateTextMeasurer, type TextMeasurer, type TextSize,
} from './textmeasure.js';

afterEach(() => {
  setTextMeasurer(undefined);
  delete process.env.GV_TEXT_MEASURER;
});

// ── setTextMeasurer override ─────────────────────────────────────────────────

describe('setTextMeasurer override', () => {
  it('createMeasurer returns the explicit override', () => {
    const stub: TextMeasurer = { measure: (): TextSize => ({ w: 1, h: 2 }) };
    setTextMeasurer(stub);
    expect(getTextMeasurer()).toBe(stub);
    expect(createMeasurer()).toBe(stub);
  });

  it('undefined clears the override → auto-resolution', () => {
    setTextMeasurer({ measure: (): TextSize => ({ w: 0, h: 0 }) });
    setTextMeasurer(undefined);
    expect(getTextMeasurer()).toBeUndefined();
    expect(createMeasurer()).toBeInstanceOf(EstimateTextMeasurer); // node default
  });

  it('override wins over the GV_TEXT_MEASURER env hook', () => {
    process.env.GV_TEXT_MEASURER = 'estimate';
    const stub: TextMeasurer = { measure: (): TextSize => ({ w: 9, h: 9 }) };
    setTextMeasurer(stub);
    expect(createMeasurer()).toBe(stub);
  });
});

// ── auto-resolution (Node) ───────────────────────────────────────────────────

describe('createMeasurer auto-resolution (Node, no document)', () => {
  it('defaults to EstimateTextMeasurer (deterministic, headless-matching)', () => {
    expect(createMeasurer()).toBeInstanceOf(EstimateTextMeasurer);
  });

  it('GV_TEXT_MEASURER=lut forces the hinted built-in measurer', () => {
    process.env.GV_TEXT_MEASURER = 'lut';
    expect(createMeasurer()).toBeInstanceOf(LutTextMeasurer);
  });
});

// ── Fitness guard: src must never statically import `canvas` ──────────────────
// The library is zero-runtime-dep and ships one browser+Node bundle. node-canvas
// is opt-in via setTextMeasurer; a static `canvas` import would break the browser
// build. @see plans/fix-xcoord-position/DESIGN.md
describe('browser-bundle guard', () => {
  it('no non-test src file imports the `canvas` module', () => {
    const SRC = fileURLToPath(new URL('../', import.meta.url));
    const offenders: string[] = [];
    const reCanvas = /(?:from\s+|import\(|require\()\s*['"]canvas['"]/;
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!p.endsWith('.ts') || p.endsWith('.test.ts')) continue;
        if (reCanvas.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(SRC);
    expect(offenders, `static "canvas" imports leak into the browser bundle:\n${offenders.join('\n')}`).toEqual([]);
  });
});
