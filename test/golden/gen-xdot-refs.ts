// SPDX-License-Identifier: EPL-2.0
//
// Generate xdot golden references for the `dot`-engine manifest entries.
//
// Mirrors the SVG golden refs: each `.xdot` under test/golden/refs-xdot/ is the
// native oracle's `dot -Txdot` output, committed so the xdot golden suite runs
// without a live oracle (browser/CI). The oracle is the SAME headless build that
// generated the SVG refs (`~/git/graphviz/build/cmd/dot/dot`, GVBINDIR=/tmp/ghl,
// estimate text metrics) so xdot geometry matches the port's estimate LUT.
//
// Scope: the DETERMINISTIC engines (dot/circo/twopi/osage/patchwork). Iterative
// engines (neato/fdp/sfdp) are non-deterministic at the 0.01 xdot tolerance and
// are excluded. The oracle GVBINDIR must register the neato_layout plugin (which
// provides circo/twopi/osage/patchwork) alongside dot_layout — run `dot -c`
// after symlinking libgvplugin_neato_layout.* into the plugin dir.
//
// Usage:  DOT_BIN=~/git/graphviz/build/cmd/dot/dot npx tsx test/golden/gen-xdot-refs.ts
// Node-only dev/test infra — never imported by src/index.ts.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DOT_BIN = process.env.DOT_BIN ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env.GVBINDIR ?? '/tmp/ghl';
const REFS_DIR = join(__dirname, 'refs-xdot');

interface ManifestEntry {
  id: string;
  engine: string;
  input: string;
}

/** Deterministic layout engines — the only ones comparable at 0.01 tolerance. */
const DETERMINISTIC_ENGINES = new Set(['dot', 'circo', 'twopi', 'osage', 'patchwork']);

const manifest = JSON.parse(
  readFileSync(join(__dirname, 'manifest.json'), 'utf8'),
) as ManifestEntry[];

mkdirSync(REFS_DIR, { recursive: true });
const env = { ...process.env, GVBINDIR };
let written = 0;
const skipped: string[] = [];

for (const e of manifest) {
  if (!DETERMINISTIC_ENGINES.has(e.engine)) continue;
  const inPath = join(ROOT, e.input);
  try {
    const xdot = execFileSync(DOT_BIN, ['-K', e.engine, '-Txdot', inPath], {
      env,
      encoding: 'utf8',
      timeout: 60_000,
    });
    if (!xdot.trimEnd().endsWith('}')) {
      skipped.push(`${e.id}: incomplete oracle output`);
      continue;
    }
    writeFileSync(join(REFS_DIR, `${e.id}.xdot`), xdot);
    written++;
  } catch (err) {
    skipped.push(`${e.id}: ${(err as Error).message.split('\n')[0]}`);
  }
}

process.stdout.write(`wrote ${written} xdot refs to ${REFS_DIR}\n`);
if (skipped.length > 0) {
  process.stdout.write(`skipped ${skipped.length}:\n  ${skipped.join('\n  ')}\n`);
}
