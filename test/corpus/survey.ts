// SPDX-License-Identifier: EPL-2.0
//
// Differential parity survey runner (mission: dot-corpus-harness, T2).
//
// Reads corpus-manifest.json (T1), renders every `applicable` input through the
// native `dot` oracle and through graphviz-ts (in an isolated subprocess), diffs
// the two SVGs with test/golden/compare.ts (read-only reuse), and writes
// parity.json — the per-input verdict report consumed by T3 (dashboard.ts).
//
// A report, not a gate (AD-1): divergences are expected data. The survey never
// crashes or hangs on a bad input — every port render is a spawned subprocess
// with a wall-clock timeout (AD-2); a hang becomes `timeout`, a throw becomes
// `errored`. It exits 0 even when inputs diverge; only a harness fault (missing
// oracle binary, unreadable manifest) exits nonzero. Node-only dev/test infra.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSvg, type Diff } from '../golden/compare.js';
import type { CorpusEntry } from './enumerate.js';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ROOT = process.env.CORPUS_ROOT ?? join(homedir(), 'git/graphviz/tests');
const DOT_BIN = process.env.DOT_BIN ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env.GVBINDIR ?? '/tmp/gvplugins';
const CACHE = process.env.ORACLE_CACHE ?? join(tmpdir(), 'dot-corpus-oracle');
// A render is a `timeout` only if it does not error and runs past its budget:
// max(MULT × native, FLOOR). The flat-20s budget mis-flagged graphs that are
// merely slow-but-valid (e.g. 2108 ~70s, native ~12s); only a true runaway past
// 3× native or 3 minutes — whichever is greater — counts.
const TIMEOUT_MULT = Number(process.env.RENDER_TIMEOUT_MULT ?? 3);
const TIMEOUT_FLOOR_MS = Number(process.env.RENDER_TIMEOUT_FLOOR_MS ?? 180_000);
// The oracle gets a generous fixed cap so slow-but-valid native renders finish
// (they yield the reference SVG *and* the native time the budget is based on).
const ORACLE_TIMEOUT_MS = Number(process.env.ORACLE_TIMEOUT_MS ?? 300_000);
const CONCURRENCY = Number(process.env.SURVEY_CONCURRENCY ?? 8);
const MANIFEST = new URL('./corpus-manifest.json', import.meta.url);
// Output is parameterizable so a side-by-side survey (e.g. the headless rules
// survey: GVBINDIR=ghl GV_TEXT_MEASURER=estimate) can write a separate report
// without clobbering the default pango baseline. @see plans/fix-xcoord-position
const PARITY = new URL(process.env.PARITY_OUT ?? './parity.json', import.meta.url);
const NATIVE_TIMINGS = new URL('./native-timings.json', import.meta.url);
const RENDER_ONE = join(REPO, 'test/corpus/render-one.ts');
/** Canonical (frozen) native dot times (id → ms), shared with the perf bench.
 *  The budget prefers these so it is stable run-to-run; the just-measured oracle
 *  time is the fallback for not-yet-captured inputs. @see capture-native.mjs */
const CANON_NATIVE: Record<string, number> = (() => {
  try { return JSON.parse(readFileSync(NATIVE_TIMINGS, 'utf8')).timings ?? {}; }
  catch { return {}; }
})();
/** Extracts a semantic version from `dot -V` output. */
const VERSION_RE = /version (\d+\.\d+\.\d+)/;

/** Verdict for one surveyed input. */
export type Verdict =
  | 'byte-match'
  | 'structural-match'
  | 'diverged'
  | 'errored'
  | 'timeout'
  | 'oracle-error';

/** One row of parity.json (interface contract consumed by T3). */
export interface SurveyResult {
  id: string;
  path: string;
  verdict: Verdict;
  maxDelta?: number;
  firstDiffPath?: string;
  errMsg?: string;
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

/**
 * Spawn a process, capture stdout/stderr, and SIGKILL the entire process GROUP
 * after `timeoutMs`. Group-kill is essential: `tsx` runs the render in a
 * grandchild, and a port that hangs in a synchronous loop is unkillable
 * in-process (AD-2). Killing only the direct child would orphan the grandchild,
 * which keeps the stdout pipe open so `close` never fires and the survey stalls.
 * `detached: true` makes the child a group leader so `kill(-pid)` reaches the
 * whole tree.
 */
function spawnCapture(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, detached: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid);
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => (stderr += e.message));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });
  });
}

/** SIGKILL a detached child's whole process group (ignore if already gone). */
function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    /* already exited (ESRCH) */
  }
}

/** Locate a runnable `tsx`: TSX_BIN, local bin, npx cache, else `npx tsx`. */
function resolveTsx(): { cmd: string; pre: string[] } {
  if (process.env.TSX_BIN) return { cmd: process.env.TSX_BIN, pre: [] };
  const local = join(REPO, 'node_modules/.bin/tsx');
  if (existsSync(local)) return { cmd: local, pre: [] };
  const cached = findCachedTsx();
  if (cached) return { cmd: cached, pre: [] };
  return { cmd: 'npx', pre: ['--no-install', 'tsx'] };
}

/** Search the npx cache for a tsx binary (machine-specific hashed dirs). */
function findCachedTsx(): string | null {
  const npx = join(homedir(), '.npm/_npx');
  if (!existsSync(npx)) return null;
  for (const dir of readdirSync(npx)) {
    const bin = join(npx, dir, 'node_modules/.bin/tsx');
    if (existsSync(bin)) return bin;
  }
  return null;
}

/**
 * Render an input with the native oracle, caching the SVG and the native render
 * time (a `.ms` sidecar) under CACHE. The time seeds the port's per-input budget
 * (max(MULT×native, FLOOR)), so it must be cached alongside the SVG (AD-3).
 */
async function oracleSvg(absInput: string, id: string): Promise<{ svg?: string; ms?: number; err?: string }> {
  const cacheFile = join(CACHE, `${id}.svg`);
  const msFile = join(CACHE, `${id}.ms`);
  if (existsSync(cacheFile) && existsSync(msFile)) {
    const cached = readFileSync(cacheFile, 'utf8');
    const ms = Number(readFileSync(msFile, 'utf8'));
    if (cached.length > 0 && Number.isFinite(ms)) return { svg: cached, ms };
  }
  const env = { ...process.env, GVBINDIR };
  const t = Date.now();
  const r = await spawnCapture(DOT_BIN, ['-Tsvg', absInput], env, ORACLE_TIMEOUT_MS);
  const ms = Date.now() - t;
  // The native `dot` exits nonzero on warnings AND on recoverable errors (e.g.
  // "trouble in init_rank") while still emitting a COMPLETE SVG. Exit code is
  // therefore not a validity signal — completeness (a closing </svg>) is. Only
  // a timeout or a truncated/empty render is a genuine oracle-error.
  if (r.timedOut || !r.stdout.includes('</svg>')) {
    return { err: firstLine(r.stderr) || `oracle exit ${r.code}` };
  }
  writeFileSync(cacheFile, r.stdout);
  writeFileSync(msFile, String(ms));
  return { svg: r.stdout, ms };
}

/** Render an input with the port in an isolated, budget-killed subprocess. */
async function portSvg(
  absInput: string,
  tsx: { cmd: string; pre: string[] },
  budgetMs: number,
): Promise<{ svg?: string; verdict?: Verdict; errMsg?: string }> {
  const args = [...tsx.pre, RENDER_ONE, absInput, 'dot'];
  const r = await spawnCapture(tsx.cmd, args, process.env, budgetMs);
  if (r.timedOut) return { verdict: 'timeout' };
  if (r.code !== 0 || r.stdout.length === 0) {
    return { verdict: 'errored', errMsg: portErrMsg(r.stderr) || `port exit ${r.code}` };
  }
  return { svg: r.stdout };
}

/** First non-empty line of a (possibly multi-line) string. */
function firstLine(s: string): string {
  for (const line of s.split('\n')) {
    if (line.trim().length > 0) return line.trim();
  }
  return '';
}

/** Extract the port's thrown error: the `__RENDER_ERROR__` sentinel line if
 * present (incidental warnings precede it), else the first stderr line. */
function portErrMsg(stderr: string): string {
  const marker = '__RENDER_ERROR__';
  for (const line of stderr.split('\n')) {
    if (line.startsWith(marker)) return line.slice(marker.length).trim();
  }
  return firstLine(stderr);
}

/** Classify a rendered pair: byte-match / structural-match / diverged. */
function diffVerdict(port: string, oracle: string): Omit<SurveyResult, 'id' | 'path'> {
  let diffs: Diff[];
  try {
    const cmp = compareSvg(port, oracle, 'deterministic');
    if (cmp.pass) return { verdict: 'byte-match' };
    diffs = cmp.diffs;
  } catch (e) {
    return { verdict: 'diverged', firstDiffPath: '<compare-threw>', errMsg: errText(e) };
  }
  const numeric = diffs.filter((d) => d.delta !== undefined);
  const structural = diffs.find((d) => d.delta === undefined);
  const maxDelta = numeric.reduce((mx, d) => Math.max(mx, d.delta ?? 0), 0);
  if (structural) {
    return { verdict: 'diverged', maxDelta, firstDiffPath: structural.path };
  }
  return { verdict: 'structural-match', maxDelta };
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Survey one applicable input end-to-end. */
async function surveyOne(
  entry: CorpusEntry,
  tsx: { cmd: string; pre: string[] },
): Promise<SurveyResult> {
  const absInput = join(ROOT, entry.path);
  const meta = { id: entry.id, path: entry.path };
  const oracle = await oracleSvg(absInput, entry.id);
  if (oracle.svg === undefined) return { ...meta, verdict: 'oracle-error', errMsg: oracle.err };
  // Budget = max(MULT × native, FLOOR): only a non-erroring run past this is a
  // timeout. Native time is the canonical (frozen) value when captured, else the
  // time the oracle run just measured.
  const nativeMs = CANON_NATIVE[entry.id] ?? oracle.ms ?? 0;
  const budgetMs = Math.max(TIMEOUT_FLOOR_MS, Math.ceil(TIMEOUT_MULT * nativeMs));
  const port = await portSvg(absInput, tsx, budgetMs);
  if (port.svg === undefined) return { ...meta, verdict: port.verdict!, errMsg: port.errMsg };
  return { ...meta, ...diffVerdict(port.svg, oracle.svg) };
}

/** Bounded worker pool: run `entries` `concurrency`-at-a-time, preserving order. */
async function runPool(
  entries: CorpusEntry[],
  tsx: { cmd: string; pre: string[] },
  concurrency: number,
): Promise<SurveyResult[]> {
  const results: SurveyResult[] = new Array(entries.length);
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < entries.length; i = next++) {
      results[i] = await surveyOne(entries[i], tsx);
      if (++done % 50 === 0) process.stderr.write(`  ${done}/${entries.length}\n`);
    }
  };
  const n = Math.min(concurrency, entries.length);
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

/** Tally verdict counts (keys cover every verdict; sum === total). */
function tally(results: SurveyResult[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = {
    'byte-match': 0,
    'structural-match': 0,
    diverged: 0,
    errored: 0,
    timeout: 0,
    'oracle-error': 0,
  };
  for (const r of results) counts[r.verdict]++;
  return counts;
}

/** Read `dot -V` and return a short version string ("dot 15.0.0"). */
async function oracleVersion(): Promise<string> {
  const r = await spawnCapture(DOT_BIN, ['-V'], { ...process.env, GVBINDIR }, 5000);
  const m = (r.stderr + r.stdout).match(VERSION_RE);
  return m ? `dot ${m[1]}` : 'dot (unknown)';
}

async function main(): Promise<void> {
  if (!existsSync(DOT_BIN)) {
    process.stderr.write(`harness fault: oracle binary not found at ${DOT_BIN}\n`);
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as CorpusEntry[];
  let applicable = manifest.filter((e) => e.status === 'applicable');
  const limit = Number(process.env.SURVEY_LIMIT ?? 0);
  if (limit > 0) applicable = applicable.slice(0, limit);
  mkdirSync(CACHE, { recursive: true });
  const tsx = resolveTsx();
  process.stderr.write(
    `surveying ${applicable.length} applicable inputs ` +
      `(concurrency ${CONCURRENCY}, budget max(${TIMEOUT_MULT}x native, ${TIMEOUT_FLOOR_MS}ms))\n` +
      `oracle ${DOT_BIN} (cap ${ORACLE_TIMEOUT_MS}ms)\ncache ${CACHE}\nport via ${tsx.cmd}\n`,
  );
  const results = await runPool(applicable, tsx, CONCURRENCY);
  const counts = tally(results);
  const report = {
    generatedAt: new Date().toISOString(),
    generatedWith: 'test/corpus/survey.ts',
    oracleVersion: await oracleVersion(),
    corpusRoot: ROOT,
    total: results.length,
    counts,
    results,
  };
  writeFileSync(PARITY, JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(`wrote parity.json — ${JSON.stringify(counts)}\n`);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main().catch((e) => {
    process.stderr.write(`harness fault: ${errText(e)}\n`);
    process.exit(2);
  });
}
