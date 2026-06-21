// SPDX-License-Identifier: EPL-2.0

/**
 * Golden-file end-to-end test suite.
 *
 * Reads manifest.json, renders each input through the TypeScript port, and
 * diffs the output against the reference SVG from the C binary.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { renderSvg } from '../../src/index.js';
import { compareSvg } from './compare.js';
import type { Diff } from './compare.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ManifestEntry {
  id: string;
  engine: string;
  toleranceClass: string;
  /**
   * Per-test tolerance override (pt) for the C-reference comparison.
   * Used where the port's libm (ARM optimized-routines pow) diverges
   * chaotically from the Apple libm that generated the refs; structural
   * equivalence is documented in plans/test-parity/decision-journal.md
   * (M8/T3). Entries with this set must also set portReference.
   */
  tolerance?: number;
  input: string;
  reference: string;
  /**
   * Drift pin: the port's own deterministic output, compared at the
   * deterministic tolerance (0.01pt). Catches any regression that the
   * loosened C-ref tolerance would let through.
   */
  portReference?: string;
  description: string;
}

const manifestPath = join(__dirname, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestEntry[];

// ---------------------------------------------------------------------------
// Error formatting helper — extracted for AC4 testability
// ---------------------------------------------------------------------------

function buildDiffError(id: string, diffs: Diff[]): string {
  const first = diffs[0];
  return (
    `[${id}] SVG mismatch at ${first.path}\n` +
    `  actual:   ${first.actual}\n` +
    `  expected: ${first.expected}\n` +
    (first.delta !== undefined
      ? `  delta: ${first.delta} (tolerance: ${first.tolerance})\n`
      : '')
  );
}

// ---------------------------------------------------------------------------
// Suite-level check: manifest must have exactly 134 entries
// (82 baseline + 15 render-styling + 12 multicolor-paint
//  + 2 semicolon split + 3 undirected-edge-clip + 1 node-penwidth-clip
//  + 4 steering-port goldens SR8 + 4 splines=ortho dot goldens P3-T3
//  + 3 splines=curved (single, parallel, cycle)
//  + 2 compound (splines, lhead/ltail) DOT-8
//  + 2 long-edge straight-mode (synthetic L5 + corpus p2)
//  + 1 long-edge polyline straight-mode (AD-3 follow-up)
//  + 1 shape=point (point_init/point_gencode)
//  + 1 rounded clusters + Mrecord (round_corners render)
//  + 1 record/Mrecord fill + pen (record_gencode stylenode/penColor/findFill))
// ---------------------------------------------------------------------------

test('manifest has 134 entries', () => {
  expect(manifest).toHaveLength(134);
});

// ---------------------------------------------------------------------------
// AC4: error message format test (does not require a live render)
// ---------------------------------------------------------------------------

test('error message contains path, actual, expected, and delta for numeric diff', () => {
  const fakeDiff: Diff = {
    path: 'svg/g[1]/ellipse/@cx',
    actual: '50.6',
    expected: '50.0',
    delta: 0.6,
    tolerance: 0.01,
  };
  const msg = buildDiffError('my-test-id', [fakeDiff]);
  expect(msg).toContain('[my-test-id]');
  expect(msg).toContain('svg/g[1]/ellipse/@cx');
  expect(msg).toContain('50.6');
  expect(msg).toContain('50.0');
  expect(msg).toContain('0.6');
  expect(msg).toContain('0.01');
});

test('error message omits delta line for structural diff', () => {
  const fakeDiff: Diff = {
    path: 'svg/g[2]',
    actual: 'missing',
    expected: 'g',
    tolerance: 0.01,
  };
  const msg = buildDiffError('struct-test', [fakeDiff]);
  expect(msg).toContain('[struct-test]');
  expect(msg).toContain('svg/g[2]');
  expect(msg).not.toContain('delta:');
});

// ---------------------------------------------------------------------------
// Golden-file comparison tests: one per manifest entry
// ---------------------------------------------------------------------------

describe('golden-file SVG comparison', () => {
  for (const entry of manifest) {
    test(`${entry.engine} / ${entry.id}`, () => {
      const dotSource = readFileSync(
        join(process.cwd(), entry.input),
        'utf8',
      );
      const refSvg = readFileSync(
        join(process.cwd(), entry.reference),
        'utf8',
      );

      const actualSvg = renderSvg(dotSource, entry.engine);

      const result = compareSvg(actualSvg, refSvg, entry.toleranceClass, entry.tolerance);

      if (!result.pass) {
        const first = result.diffs[0];
        throw new Error(buildDiffError(entry.id, result.diffs) +
          (first.delta !== undefined ? '' : `  (structural mismatch)\n`));
      }

      expect(result.pass).toBe(true);

      // Drift pin: when the C-ref tolerance is loosened, the port's own
      // pinned output guards against regressions at 0.01pt.
      if (entry.portReference) {
        const portRefSvg = readFileSync(
          join(process.cwd(), entry.portReference),
          'utf8',
        );
        const pin = compareSvg(actualSvg, portRefSvg, 'deterministic');
        if (!pin.pass) {
          throw new Error(buildDiffError(`${entry.id} (port-pin)`, pin.diffs));
        }
        expect(pin.pass).toBe(true);
      }
    });
  }
});
