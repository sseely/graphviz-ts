// SPDX-License-Identifier: EPL-2.0
//
// Capture the canonical native `dot` render times — a one-time fact, not a
// per-run measurement. Native graphviz is not under development here, so once we
// know how the C performs on this machine it is frozen; only the TypeScript port
// is re-timed thereafter (bench.mjs / survey.ts read native-timings.json instead
// of re-running dot). Timings are MACHINE-SPECIFIC (the port/native ratio only
// cancels hardware speed because both run on the same box) — the metadata records
// the host + dot version; regenerate on a hardware change.
//
//   node test/corpus/capture-native.mjs            # measure inputs not yet captured
//   CAPTURE_FORCE=1 node test/corpus/capture-native.mjs   # re-measure everything
//
// Node-only dev/test infra.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, hostname, cpus } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const ROOT = process.env.CORPUS_ROOT ?? join(homedir(), 'git/graphviz/tests');
const DOT_BIN = process.env.DOT_BIN ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env.GVBINDIR ?? '/tmp/gvplugins';
const MANIFEST = new URL('./corpus-manifest.json', import.meta.url);
const OUT = new URL('./native-timings.json', import.meta.url);
const CAP_MS = Number(process.env.CAPTURE_CAP_MS ?? 300_000);
// Low concurrency keeps the captured times clean (native is a single-threaded C
// binary; a couple at a time barely contends and is much faster than serial).
const CONC = Number(process.env.CAPTURE_CONC ?? 3);
const FORCE = process.env.CAPTURE_FORCE === '1';

/** Time one native render; resolve { ms, ok }. Validity = a complete SVG. */
function timeNative(absInput) {
  return new Promise((resolve) => {
    const t = performance.now();
    const child = spawn(DOT_BIN, ['-Tsvg', absInput], { env: { ...process.env, GVBINDIR } });
    let tail = '';
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, CAP_MS);
    child.stdout.on('data', (d) => { tail = (tail + d).slice(-256); });
    child.on('error', () => {});
    child.on('close', () => { clearTimeout(timer); resolve({ ms: performance.now() - t, ok: tail.includes('</svg>') }); });
  });
}

/** Best-of-3 (best-of-1 once a sample exceeds 2s — native is stable + costly). */
async function nativeMs(absInput) {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const r = await timeNative(absInput);
    if (!r.ok) return null;
    best = Math.min(best, r.ms);
    if (r.ms > 2_000) break;
  }
  return Math.round(best);
}

function dotVersion() {
  // `dot -V` prints to stderr; capture both streams.
  const r = spawnSync(DOT_BIN, ['-V'], { env: { ...process.env, GVBINDIR }, encoding: 'utf8' });
  const m = ((r.stderr ?? '') + (r.stdout ?? '')).match(/version (\d+\.\d+\.\d+)/);
  return m ? m[1] : 'unknown';
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const applicable = manifest.filter((e) => e.status === 'applicable');
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { timings: {} };
  const timings = FORCE ? {} : { ...prev.timings };

  const todo = applicable.filter((e) => FORCE || timings[e.id] === undefined);
  process.stderr.write(`capturing native times: ${todo.length} to measure, ${applicable.length - todo.length} already canonical\n`);

  let next = 0, done = 0;
  const worker = async () => {
    for (let i = next++; i < todo.length; i = next++) {
      const e = todo[i];
      const ms = await nativeMs(join(ROOT, e.path));
      if (ms !== null) timings[e.id] = ms;
      if (++done % 50 === 0) process.stderr.write(`  ${done}/${todo.length}\n`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, todo.length) || 1 }, worker));

  const report = {
    capturedAt: new Date().toISOString(),
    host: hostname(),
    cores: cpus().length,
    dotVersion: dotVersion(),
    note: 'Canonical native dot render times (ms), this machine. Frozen — only the TS port is re-timed. Regenerate on hardware change.',
    count: Object.keys(timings).length,
    timings,
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(`native-timings.json written — ${report.count} inputs (dot ${report.dotVersion} on ${report.host})\n`);
}

main().catch((e) => { process.stderr.write(`capture fault: ${e instanceof Error ? e.stack : String(e)}\n`); process.exit(2); });
