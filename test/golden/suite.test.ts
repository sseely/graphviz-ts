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
  input: string;
  reference: string;
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
// Suite-level check: manifest must have exactly 50 entries
// ---------------------------------------------------------------------------

test('manifest has 50 entries', () => {
  expect(manifest).toHaveLength(50);
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

      const result = compareSvg(actualSvg, refSvg, entry.toleranceClass);

      if (!result.pass) {
        const first = result.diffs[0];
        throw new Error(buildDiffError(entry.id, result.diffs) +
          (first.delta !== undefined ? '' : `  (structural mismatch)\n`));
      }

      expect(result.pass).toBe(true);
    });
  }
});
