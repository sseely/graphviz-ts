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
// Scope: the `dot` engine only. The /tmp/ghl plugin set registers only the dot
// layout engine; iterative engines (neato/fdp/sfdp) are non-deterministic at the
// 0.01 xdot tolerance anyway. Other deterministic engines (circo/twopi/osage/
// patchwork) would need extra oracle plugins — out of scope for now.
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

const manifest = JSON.parse(
  readFileSync(join(__dirname, 'manifest.json'), 'utf8'),
) as ManifestEntry[];

mkdirSync(REFS_DIR, { recursive: true });
const env = { ...process.env, GVBINDIR };
let written = 0;
const skipped: string[] = [];

for (const e of manifest) {
  if (e.engine !== 'dot') continue;
  const inPath = join(ROOT, e.input);
  try {
    const xdot = execFileSync(DOT_BIN, ['-Txdot', inPath], {
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
