// SPDX-License-Identifier: EPL-2.0
//
// Non-dot engine conformance walk (corpus hardening).
//
// Runs the SVG-conformant corpus set (parity.json, dot-track verdicts) through
// ONE non-dot deterministic engine, comparing the port's xdot against the
// native oracle (`dot -K <engine> -Txdot`, GVBINDIR=/tmp/ghl) with the semantic
// comparator (test/golden/compare-xdot.ts). Items are size-sorted small→large
// so shared mechanisms surface early. Output is JSONL (append-per-item) so
// progress is monitorable and survives interruption — a re-run resumes by
// skipping ids already recorded in the output file. After the sweep completes,
// a parity-<engine>.json summary (counts + all rows) is written for
// parity-report.ts.
//
// Usage: npx tsx test/corpus/engine-walk.ts <engine> [outJsonlPath]
//
// Node-only dev/test infra — never imported by src/index.ts.

import { readFileSync, statSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compareXdot } from '../golden/compare-xdot.js';

/** Per-item outcome of the walk (one JSONL line each). */
export type EngineWalkStatus = 'pass' | 'diverged' | 'oracle-error' | 'port-error' | 'timeout';

/** One JSONL row / one entry of parity-<engine>.json's `results`. */
export interface EngineWalkRow {
  id: string;
  size: number;
  status: EngineWalkStatus;
  nDiffs?: number;
  firstDiff?: string;
  err?: string;
}

/** parity-<engine>.json shape (consumed by parity-report.ts). */
export interface EngineParityReport {
  generatedAt: string;
  generatedWith: string;
  engine: string;
  /** comparison tolerance in points (0.01 deterministic, 0.5 iterative) */
  tolerance?: number;
  total: number;
  counts: Record<EngineWalkStatus, number>;
  results: EngineWalkRow[];
}

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const CORPUS = process.env.CORPUS_ROOT ?? join(homedir(), 'git/graphviz/tests');
const DOT_BIN = process.env.DOT_BIN ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env.GVBINDIR ?? '/tmp/ghl';

const engine = process.argv[2];
if (!engine) {
  console.error('usage: npx tsx test/corpus/engine-walk.ts <engine> [outJsonlPath]');
  process.exit(2);
}

/**
 * Per-engine comparison tolerance. The deterministic engines are held to
 * the 0.01 bar (every diff is a chaseable defect); the ITERATIVE
 * force-directed engines (neato/fdp/sfdp) accumulate floating-point that
 * JS cannot reproduce bit-for-bit (accepted class A1 — FMA/pow/libm), so
 * their documented bar is 0.5pt: the sweep characterizes behavior rather
 * than gating byte-fidelity. @see docs/known-divergences.md#a1
 */
const ITERATIVE_ENGINES = new Set(['neato', 'fdp', 'sfdp']);
const TOLERANCE = ITERATIVE_ENGINES.has(engine) ? 0.5 : 0.01;
const OUT = process.argv[3] ?? fileURLToPath(new URL(`./parity-${engine}.jsonl`, import.meta.url));
const SUMMARY = fileURLToPath(new URL(`./parity-${engine}.json`, import.meta.url));

interface ParityEntry { id: string; path: string; verdict: string }
const parity = JSON.parse(
  readFileSync(join(REPO, 'test/corpus/parity.json'), 'utf8'),
) as { results: ParityEntry[] };
const items = parity.results
  .filter((r) => r.verdict === 'conformant')
  .map((r) => {
    const p = join(CORPUS, r.path);
    let size = Number.MAX_SAFE_INTEGER;
    try { size = statSync(p).size; } catch { /* missing file -> sort last */ }
    return { id: r.id, path: p, size };
  })
  .sort((a, b) => a.size - b.size || (a.id < b.id ? -1 : 1));

// resume: skip ids already in the output file
const done = new Set<string>();
if (existsSync(OUT)) {
  for (const ln of readFileSync(OUT, 'utf8').split('\n')) {
    if (!ln) continue;
    try { done.add((JSON.parse(ln) as { id: string }).id); } catch { /* partial line */ }
  }
} else {
  writeFileSync(OUT, '');
}

let n = 0;
for (const it of items) {
  n++;
  if (done.has(it.id)) continue;
  const rec: EngineWalkRow = { id: it.id, size: it.size, status: 'pass' };

  // oracle
  let oracle = '';
  try {
    oracle = execFileSync(DOT_BIN, ['-K', engine, '-Txdot', it.path], {
      env: { ...process.env, GVBINDIR }, encoding: 'utf8', timeout: 60_000,
      maxBuffer: 512 * 1024 * 1024,
    });
    if (!oracle.trimEnd().endsWith('}')) throw new Error('incomplete oracle output');
  } catch (err) {
    rec.status = 'oracle-error';
    rec.err = String((err as Error).message).split('\n')[0]!.slice(0, 160);
    appendFileSync(OUT, JSON.stringify(rec) + '\n');
    continue;
  }

  // port (spawned, hang-safe). detached + negative-pid kill takes the WHOLE
  // process group: killing only the npx wrapper leaves the node grandchild
  // spinning forever on a hung render (observed: a 241_1/circo render
  // orphaned at 100% CPU for 20h after spawnSync's killSignal).
  const r = await new Promise<{ stdout: string; stderr: string; status: number | null; timedOut: boolean }>(
    (resolve) => {
      const child = spawn('npx', ['tsx', join(REPO, 'test/corpus/render-one-xdot.ts'), it.path, engine], {
        cwd: REPO, env: process.env, detached: true,
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        if (child.pid !== undefined) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
        }
      }, 90_000);
      child.stdout.on('data', (d: Buffer) => (stdout += d));
      child.stderr.on('data', (d: Buffer) => (stderr += d));
      child.on('error', (e) => (stderr += String(e)));
      child.on('close', (status) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, status, timedOut });
      });
    },
  );
  if (r.timedOut) {
    rec.status = 'timeout';
  } else if (r.status !== 0) {
    const m = /__RENDER_ERROR__ (.*)/.exec(r.stderr ?? '');
    rec.status = 'port-error';
    rec.err = (m?.[1] ?? (r.stderr ?? '')).slice(0, 200);
  } else {
    const res = compareXdot(r.stdout, oracle, TOLERANCE);
    if (res.pass) {
      rec.status = 'pass';
    } else {
      const d = res.diffs[0];
      rec.status = 'diverged';
      rec.nDiffs = res.diffs.length;
      rec.firstDiff = d
        ? `${d.object} ${d.attr} ${d.path}: ${d.actual} vs ${d.expected}`
        : 'no-diff-detail';
    }
  }
  appendFileSync(OUT, JSON.stringify(rec) + '\n');
  if (n % 50 === 0) console.error(`[${engine}] ${n}/${items.length}`);
}

// summary: re-read the (possibly resumed) JSONL so the JSON reflects every row.
const results: EngineWalkRow[] = [];
for (const ln of readFileSync(OUT, 'utf8').split('\n')) {
  if (!ln) continue;
  try { results.push(JSON.parse(ln) as EngineWalkRow); } catch { /* partial line */ }
}
const counts: Record<EngineWalkStatus, number> = {
  pass: 0, diverged: 0, 'oracle-error': 0, 'port-error': 0, timeout: 0,
};
for (const row of results) counts[row.status] = (counts[row.status] ?? 0) + 1;
const summary: EngineParityReport = {
  generatedAt: new Date().toISOString(),
  generatedWith: 'test/corpus/engine-walk.ts',
  engine,
  tolerance: TOLERANCE,
  total: results.length,
  counts,
  results,
};
writeFileSync(SUMMARY, JSON.stringify(summary, null, 2) + '\n');

console.log(`[${engine}] done: ${items.length} items -> ${OUT}`);
console.log(`[${engine}] summary -> ${SUMMARY}`);
