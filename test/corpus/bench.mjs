// SPDX-License-Identifier: EPL-2.0
//
// Warm in-process perf bench for graphviz-ts vs native graphviz.
//
// Motivation: the parity survey spawns a fresh `tsx` subprocess per render, so
// every timing carries ~0.75s of transpile + module-load overhead unrelated to
// layout. This bench instead loads the SHIPPED bundle (dist/index.js) once in a
// pool of resident, JIT-primed worker threads and times pure renderSvg() calls
// — the realistic steady-state a long-lived consumer sees.
//
// Budget framing: the port's fidelity target is <=3x native. For each input we
// report nativeMs, portMs (warm best), the ratio, and a verdict (ok / slow /
// over-cap / errored / oracle-error). A hard per-render cap (5x the longest
// canonical native time by default) catches true synchronous hangs via
// worker.terminate().
//
// Parallelism: floor(cpus/2) workers so each render gets a ~dedicated core
// (low contention); min-of-N denoises the rest. Timings are "lightly loaded";
// for a precise single number, re-run one input solo (BENCH_POOL=1 BENCH_IDS=x).
//
// Usage:
//   npm run build:js
//   node test/corpus/bench.mjs                 # full applicable corpus
//   BENCH_IDS=2108,graphs-b100 node test/corpus/bench.mjs
//   BENCH_LIMIT=40 BENCH_POOL=4 node test/corpus/bench.mjs
//
// Node-only dev/test infra; never imported by src.

import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ROOT = process.env.CORPUS_ROOT ?? join(homedir(), 'git/graphviz/tests');
const DOT_BIN = process.env.DOT_BIN ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env.GVBINDIR ?? '/tmp/gvplugins';
const BUNDLE = join(REPO, 'dist/index.js');
const WORKER = join(REPO, 'test/corpus/bench-worker.mjs');
const MANIFEST = new URL('./corpus-manifest.json', import.meta.url);
const PERF = new URL('./perf.json', import.meta.url);
const NATIVE_TIMINGS = new URL('./native-timings.json', import.meta.url);

/** Canonical native dot times (id → ms). Native C is frozen; we don't re-time
 *  it — see test/corpus/capture-native.mjs. {} if not yet captured. */
function loadNativeTimings() {
  try { return JSON.parse(readFileSync(NATIVE_TIMINGS, 'utf8')).timings ?? {}; }
  catch { return {}; }
}

const POOL = Number(process.env.BENCH_POOL ?? Math.max(1, Math.floor(availableParallelism() / 2)));
const LONGEST_NATIVE_MS = (() => {
  const times = Object.values(loadNativeTimings()).filter((v) => typeof v === 'number');
  return times.length ? Math.max(...times) : 0;
})();
// PORT hang cap = CAP_MULT (default 5) x the longest canonical native time, i.e.
// 5x the heaviest graph graphviz itself produces. The cap scales with the
// corpus's true worst case rather than an arbitrary fixed wall-clock: it still
// catches genuine port hangs (worker.terminate) while giving even the slowest
// legitimate heavy graph generous headroom. BENCH_CAP_MS overrides; falls back
// to 180s only if no native times are captured.
const CAP_MULT = Number(process.env.BENCH_CAP_MULT ?? 5);
function computeCapMs() {
  const override = Number(process.env.BENCH_CAP_MS);
  if (Number.isFinite(override) && override > 0) return override;
  return LONGEST_NATIVE_MS > 0 ? Math.round(CAP_MULT * LONGEST_NATIVE_MS) : 180_000;
}
// NATIVE measurement cap is SEPARATE and deliberately NOT scaled by CAP_MULT:
// the native phase only re-times inputs missing a canonical entry, and several
// such inputs hang native dot indefinitely (oracle-errors). Scaling those to 5x
// would make the native phase wait ~13 min per hang. A render slower than the
// longest canonical native while still uncaptured is pathological, so cap at the
// longest canonical native (with a 180s floor). BENCH_NATIVE_CAP_MS overrides.
const NATIVE_CAP_MS = Number(
  process.env.BENCH_NATIVE_CAP_MS ?? Math.max(180_000, LONGEST_NATIVE_MS),
);
const CAP_MS = computeCapMs();
const BUDGET_MULT = Number(process.env.BENCH_BUDGET_MULT ?? 3);
const SLOW_MS = 30_000; // a render slower than this self-warms; time it once
const REPEAT_BUDGET_MS = 60_000; // stop repeat timed runs once this is spent
const HEAVY_MS = Number(process.env.BENCH_HEAVY_MS ?? 2_000); // native>this => "heavy"
// Heavy inputs are timed SERIALLY by default (HEAVY_POOL=1). Measured, not
// assumed: running them concurrently inflated 2620's single sample ~66%
// (1969ms→3268ms) via memory-bandwidth + scheduler cross-talk — enough to swing
// the cited ratio (5.3x→9.1x). Light graphs (the bulk) still run at full pool, so
// the wall-clock cost is only the few big graphs. Set BENCH_HEAVY_POOL>1 for a
// fast rough scan, accepting noisier big-graph numbers.
const HEAVY_POOL = Number(process.env.BENCH_HEAVY_POOL ?? 1);

/** Decode a corpus input the way native dot does: strict UTF-8 else Latin-1. */
function decode(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return buf.toString('latin1'); }
}

/** A small synthetic graph to JIT-prime the general layout/mincross paths. */
function primeGraph() {
  let s = 'digraph{rankdir=LR;';
  for (let i = 0; i < 60; i++) s += `n${i}->n${(i + 7) % 60};n${i}->n${(i + 13) % 60};`;
  return s + '}';
}

// ---------------------------------------------------------------------------
// Native baseline (subprocess, best-of-N, capped)
// ---------------------------------------------------------------------------

/** Time one native render; resolve { ms, ok }. Validity = a COMPLETE SVG on
 *  stdout (native exits nonzero on mere warnings, so code is not a signal —
 *  mirrors test/corpus/survey.ts). SIGKILL after capMs. */
function timeNative(absInput, capMs) {
  const env = { ...process.env, GVBINDIR };
  return new Promise((resolve) => {
    const t = performance.now();
    const child = spawn(DOT_BIN, ['-Tsvg', absInput], { env });
    let tail = '';
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, capMs);
    // Keep only a rolling tail so a 22 MB SVG doesn't accumulate in memory.
    child.stdout.on('data', (d) => { tail = (tail + d).slice(-256); });
    child.on('error', () => {});
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ ms: performance.now() - t, ok: tail.includes('</svg>') });
    });
  });
}

/** Native min over up to 3 runs (1 run if the first is already slow). */
async function nativeMs(absInput) {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const r = await timeNative(absInput, NATIVE_CAP_MS);
    if (!r.ok) return { err: 'oracle-error' };
    best = Math.min(best, r.ms);
    if (r.ms > 2_000) break; // stable + costly; one sample is enough
  }
  return { ms: best };
}

// ---------------------------------------------------------------------------
// Warm worker pool (resident, primed, killable)
// ---------------------------------------------------------------------------

/** Spawn a worker, wait for the bundle to load, then JIT-prime it. */
async function spawnPrimed() {
  const worker = new Worker(WORKER, { workerData: { bundleUrl: pathToFileURL(BUNDLE).href } });
  await new Promise((res, rej) => {
    worker.once('message', (m) => (m.ready ? res() : rej(new Error('worker handshake'))));
    worker.once('error', rej);
  });
  const src = primeGraph();
  for (let i = 0; i < 3; i++) await renderOnce(worker, src, CAP_MS); // warm V8 tiers
  return worker;
}

/** Drive ONE render on a worker; resolve { ms } | { error } | { timedOut }.
 *  On timedOut the worker is stuck in a sync loop and must be terminated. */
function renderOnce(worker, src, capMs) {
  return new Promise((resolve) => {
    const onMsg = (m) => { clearTimeout(timer); resolve(m.error ? { error: m.error } : { ms: m.ms }); };
    const timer = setTimeout(() => { worker.off('message', onMsg); resolve({ timedOut: true }); }, capMs);
    worker.once('message', onMsg);
    worker.postMessage({ src });
  });
}

/** Time one input on its worker with adaptive warm runs. May replace the worker
 *  (on a hang) — returns { result, worker }. */
async function timeInput(worker, src) {
  const first = await renderOnce(worker, src, CAP_MS);
  if (first.timedOut) {
    await worker.terminate();
    return { result: { portMs: CAP_MS, over: true }, worker: await spawnPrimed() };
  }
  if (first.error) return { result: { error: first.error }, worker };
  const runs = [first.ms];
  if (first.ms <= SLOW_MS) {
    let spent = first.ms;
    while (runs.length < 5 && spent < REPEAT_BUDGET_MS) {
      const r = await renderOnce(worker, src, CAP_MS);
      if (r.ms === undefined) break;
      runs.push(r.ms);
      spent += r.ms;
    }
  }
  return { result: { portMs: Math.min(...runs), runs: runs.length }, worker };
}

// ---------------------------------------------------------------------------
// Verdict + reporting
// ---------------------------------------------------------------------------

/** Combine native + port timings into a verdict row. */
function verdictFor(entry, native, port) {
  const base = { id: entry.id, path: entry.path };
  if (native.err) return { ...base, verdict: 'oracle-error' };
  if (port.error) return { ...base, verdict: 'errored', errMsg: port.error };
  const nativeMsVal = Math.round(native.ms);
  if (port.over) {
    return { ...base, verdict: 'over-cap', nativeMs: nativeMsVal, portMs: CAP_MS, ratio: null };
  }
  const ratio = port.portMs / native.ms;
  return {
    ...base,
    verdict: ratio <= BUDGET_MULT ? 'ok' : 'slow',
    nativeMs: nativeMsVal,
    portMs: Math.round(port.portMs),
    ratio: Math.round(ratio * 100) / 100,
    runs: port.runs,
  };
}

function tally(rows) {
  const c = { ok: 0, slow: 0, 'over-cap': 0, errored: 0, 'oracle-error': 0 };
  for (const r of rows) c[r.verdict]++;
  return c;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Native phase: reuse the canonical (frozen) native times; only measure inputs
 *  not yet captured. Native C isn't under development, so once captured its time
 *  is a fact — capture-native.mjs owns the canonical file. */
async function nativePhase(entries) {
  const canon = loadNativeTimings();
  const out = new Array(entries.length);
  const misses = [];
  for (let i = 0; i < entries.length; i++) {
    const ms = canon[entries[i].id];
    if (typeof ms === 'number') out[i] = { ms };
    else misses.push(i);
  }
  if (misses.length === 0) {
    process.stderr.write(`  all ${entries.length} native times canonical (no dot runs)\n`);
    return out;
  }
  process.stderr.write(`  ${entries.length - misses.length} canonical, measuring ${misses.length} uncaptured\n`);
  let next = 0;
  const worker = async () => {
    for (let j = next++; j < misses.length; j = next++) {
      out[misses[j]] = await nativeMs(join(ROOT, entries[misses[j]].path));
    }
  };
  await Promise.all(Array.from({ length: Math.min(POOL, misses.length) }, worker));
  return out;
}

/** Run a set of input indices through resident warm workers at `concurrency`,
 *  filling `out[idx]`. Shared-queue load balancing; respawns on a hang. */
async function portRun(entries, indices, out, concurrency, label) {
  let next = 0;
  let done = 0;
  const loop = async () => {
    let worker = await spawnPrimed();
    for (let k = next++; k < indices.length; k = next++) {
      const idx = indices[k];
      const src = decode(readFileSync(join(ROOT, entries[idx].path)));
      const r = await timeInput(worker, src);
      out[idx] = r.result;
      worker = r.worker;
      if (++done % 50 === 0 || (label === 'heavy' && done % 1 === 0)) {
        process.stderr.write(`  ${label} ${done}/${indices.length}\n`);
      }
    }
    await worker.terminate();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, indices.length) || 1 }, loop));
}

/** Port phase: heavy inputs (native > HEAVY_MS) run at low concurrency for
 *  clean numbers; light inputs run at full POOL for throughput. Heavy first so
 *  the two sets never contend with each other. */
async function portPhase(entries, native) {
  const out = new Array(entries.length);
  const heavy = [];
  const light = [];
  for (let i = 0; i < entries.length; i++) {
    if (native[i].err) { out[i] = { error: 'skipped (oracle-error)' }; continue; }
    (native[i].ms > HEAVY_MS ? heavy : light).push(i);
  }
  process.stderr.write(`  ${heavy.length} heavy (solo x${HEAVY_POOL}), ${light.length} light (pool ${POOL})\n`);
  await portRun(entries, heavy, out, HEAVY_POOL, 'heavy');
  await portRun(entries, light, out, POOL, 'light');
  return out;
}

function selectEntries() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  let entries = manifest.filter((e) => e.status === 'applicable');
  if (process.env.BENCH_IDS) {
    const ids = new Set(process.env.BENCH_IDS.split(',').map((s) => s.trim()));
    entries = entries.filter((e) => ids.has(e.id));
  }
  const limit = Number(process.env.BENCH_LIMIT ?? 0);
  if (limit > 0) entries = entries.slice(0, limit);
  return entries;
}

async function main() {
  if (!existsSync(BUNDLE)) {
    process.stderr.write(`bundle not found: ${BUNDLE}\nrun: npm run build:js\n`);
    process.exit(2);
  }
  if (!existsSync(DOT_BIN)) {
    process.stderr.write(`oracle not found: ${DOT_BIN}\n`);
    process.exit(2);
  }
  const entries = selectEntries();
  process.stderr.write(
    `benching ${entries.length} inputs (pool ${POOL}, port-cap ${CAP_MS}ms ` +
      `= ${CAP_MULT}x longest-native ${LONGEST_NATIVE_MS}ms, native-cap ${NATIVE_CAP_MS}ms, ` +
      `budget ${BUDGET_MULT}x native)\n` +
      `bundle ${BUNDLE}\noracle ${DOT_BIN}\n`,
  );

  process.stderr.write('native phase...\n');
  const native = await nativePhase(entries);
  process.stderr.write('port phase (warm workers)...\n');
  const port = await portPhase(entries, native);

  const rows = entries.map((e, i) => verdictFor(e, native[i], port[i]));
  const counts = tally(rows);
  const worst = rows
    .filter((r) => r.ratio !== null && r.ratio !== undefined)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 20);

  writeFileSync(
    PERF,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), pool: POOL, capMs: CAP_MS, budgetMult: BUDGET_MULT, counts, results: rows },
      null,
      2,
    ) + '\n',
  );
  process.stderr.write(`\nperf.json written — ${JSON.stringify(counts)}\n`);
  process.stderr.write(`\nworst ${worst.length} by ratio (port / native):\n`);
  for (const r of worst) {
    process.stderr.write(`  ${r.ratio}x  ${r.id}  native=${r.nativeMs}ms port=${r.portMs}ms (${r.verdict})\n`);
  }
  const overcap = rows.filter((r) => r.verdict === 'over-cap').map((r) => r.id);
  if (overcap.length) process.stderr.write(`\nover-cap (>=${CAP_MS}ms, possible hang): ${overcap.join(', ')}\n`);
}

main().catch((e) => {
  process.stderr.write(`bench fault: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(2);
});
