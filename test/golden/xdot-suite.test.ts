// SPDX-License-Identifier: EPL-2.0

/**
 * Golden-file xdot end-to-end suite (companion to suite.test.ts).
 *
 * For each `dot`-engine manifest entry, render the input to xdot through the
 * TypeScript port and compare the op streams / positional attrs against the
 * committed native reference under refs-xdot/ using the semantic comparator
 * (compareXdot, tolerance 0.01). This validates the XdotRenderer over the same
 * curated inputs the SVG suite covers — the SVG suite alone does not exercise
 * xdot emission.
 *
 * Scope: the DETERMINISTIC engines (dot/circo/twopi/osage/patchwork). Iterative
 * engines (neato/fdp/sfdp) are non-deterministic at the 0.01 xdot tolerance and
 * are excluded. Refs are regenerated with `npx tsx test/golden/gen-xdot-refs.ts`
 * (the oracle GVBINDIR must register the neato_layout plugin for the non-dot
 * engines — see gen-xdot-refs.ts).
 *
 * @see test/golden/gen-xdot-refs.ts (ref generation)
 * @see test/golden/compare-xdot.ts  (semantic comparator, AD-1)
 */

import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, render } from '../../src/index.js';
import type { OutputFormat, RenderOptions } from '../../src/render/public.js';
import { compareXdot } from './compare-xdot.js';
import type { XdotDiff } from './compare-xdot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REFS_DIR = join(__dirname, 'refs-xdot');

interface ManifestEntry {
  id: string;
  engine: string;
  input: string;
}

const manifest = JSON.parse(
  readFileSync(join(__dirname, 'manifest.json'), 'utf8'),
) as ManifestEntry[];

/**
 * Documented xdot-emission residuals (keyed by manifest id). Each is a real
 * divergence tracked for a dedicated fix; skipping keeps the suite a clean gate.
 */
const XDOT_KNOWN_RESIDUALS: Record<string, string> = {
  // NB: kept empty on purpose — add an entry only with a tracking note.
};

function buildDiffError(id: string, diffs: XdotDiff[]): string {
  const first = diffs[0];
  return (
    `[${id}] xdot mismatch on ${first.object} ${first.attr}\n` +
    `  path:     ${first.path}\n` +
    `  actual:   ${first.actual}\n` +
    `  expected: ${first.expected}\n` +
    (first.delta !== undefined ? `  delta: ${first.delta}\n` : '')
  );
}

/** Deterministic layout engines — the only ones comparable at 0.01 tolerance. */
const DETERMINISTIC_ENGINES = new Set(['dot', 'circo', 'twopi', 'osage', 'patchwork']);
const detEntries = manifest.filter((e) => DETERMINISTIC_ENGINES.has(e.engine));

test('every deterministic-engine manifest entry has an xdot reference', () => {
  const missing = detEntries
    .filter((e) => !existsSync(join(REFS_DIR, `${e.id}.xdot`)))
    .map((e) => e.id);
  expect(missing).toEqual([]);
});

describe('golden-file xdot comparison (deterministic engines)', () => {
  for (const entry of detEntries) {
    const residual = XDOT_KNOWN_RESIDUALS[entry.id];
    const run = residual ? test.skip : test;
    run(`${entry.engine} / ${entry.id}${residual ? ' [xdot residual]' : ''}`, () => {
      const src = readFileSync(join(ROOT, entry.input), 'utf8');
      const ref = readFileSync(join(REFS_DIR, `${entry.id}.xdot`), 'utf8');
      const opts: RenderOptions = { engine: entry.engine };
      const portXdot = render(parse(src), 'xdot' as OutputFormat, opts) as string;

      const result = compareXdot(portXdot, ref);
      if (!result.pass) throw new Error(buildDiffError(entry.id, result.diffs));
      expect(result.pass).toBe(true);
    });
  }
});
