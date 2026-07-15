// SPDX-License-Identifier: EPL-2.0
//
// Probe a candidate golden fixture against the native oracle BEFORE locking it
// in. A fixture's job is to find bugs, not to decorate: an unprobed fixture that
// happens to pass proves nothing, and one that is added as a golden while
// failing pins the port's own wrong answer as the reference.
//
// Renders <input> through both the native oracle and the port to xdot, then runs
// the same compareXdot (11 positional attrs + draw-op streams, tol 0.01) that
// engine-walk uses for the corpus sweep, so a PASS here means the same thing a
// corpus pass means.
//
//   GVBINDIR=/tmp/ghl npx tsx test/corpus/probe-fixture.ts <input.dot> [engine=dot]
//
// Exit 0 = pass, 1 = diverged/error. Node-only dev/test infra.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { compareXdot, XDOT_TOLERANCE } from '../golden/compare-xdot.js';

const DOT_BIN = join(homedir(), 'git/graphviz/build/cmd/dot/dot');

const input = process.argv[2];
const engine = process.argv[3] ?? 'dot';
if (!input || !existsSync(input)) {
  console.error(`usage: probe-fixture.ts <input.dot> [engine]  (missing: ${input})`);
  process.exit(2);
}

function oracleXdot(): string {
  return execFileSync(DOT_BIN, [`-K${engine}`, '-Txdot', input], {
    encoding: 'utf8',
    env: { ...process.env, GVBINDIR: process.env.GVBINDIR ?? '/tmp/ghl' },
    maxBuffer: 64 * 1024 * 1024,
  });
}

function portXdot(): string {
  return execFileSync(
    'npx',
    ['tsx', join(import.meta.dirname, 'render-one-xdot.ts'), input, engine],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
}

let oracle: string;
try {
  oracle = oracleXdot();
} catch (e) {
  const err = e as { status?: number; stderr?: Buffer };
  // exit 139 = SIGSEGV. An oracle that crashes cannot be a reference (see the
  // pack x newrank permanently-dark cell); report it rather than silently
  // treating "no output" as agreement.
  console.log(`ORACLE-ERROR  ${input} [${engine}]  exit=${err.status} ${err.stderr ?? ''}`);
  process.exit(1);
}

let port: string;
try {
  port = portXdot();
} catch (e) {
  const err = e as { stderr?: Buffer; stdout?: Buffer };
  const m = /__RENDER_ERROR__ (.*)/.exec(String(err.stderr ?? ''));
  console.log(`PORT-ERROR    ${input} [${engine}]  ${m?.[1] ?? String(err.stderr).slice(0, 300)}`);
  process.exit(1);
}

const res = compareXdot(port, oracle, XDOT_TOLERANCE);
if (res.pass) {
  console.log(`PASS          ${input} [${engine}]`);
  process.exit(0);
}
console.log(`DIVERGED      ${input} [${engine}]  ${res.diffs.length} diffs`);
for (const d of res.diffs.slice(0, 8)) {
  console.log(`  ${d.kind.padEnd(10)} ${d.object} ${d.attr} ${d.path}: ${d.actual} vs ${d.expected}`);
}
process.exit(1);
