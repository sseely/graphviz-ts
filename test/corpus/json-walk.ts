// SPDX-License-Identifier: EPL-2.0
//
// json conformance walker (mission: json-conformance).
//
// Walks the SVG-conformant corpus items sorted by input file size (small →
// large, mirrors xdot-walk.ts AD-2), rendering each to json through the
// native oracle (`dot -Tjson`, GVBINDIR=/tmp/ghl — AD-4) and through the port
// (render-one-json.ts), and diffs the two with the semantic comparator
// (compare-json.ts). Two modes (mirrors xdot-walk.ts AD-6):
//
//   • DEFAULT (stop-on-first-divergence): render/compare in size order, HALT at
//     the first non-accepted divergence and print its op-level diff. Exit 0 iff
//     the whole conformant set passes; exit 1 when it stops at a divergence
//     (or a port/oracle/timeout fault).
//
//   • --survey: render every item, record a verdict, and write json-parity.json
//     (consumed by json-dashboard.ts). Never halts on a divergence.
//
// Reuses xdot-walk.ts's spawn + oracle-cache model: every port render is a
// group-killed subprocess with a wall-clock budget; the native oracle outputs
// are cached under a signature of (binary, GVBINDIR, format, mtime) so a
// rebuilt `dot` auto-invalidates and different oracles never collide.
//
// Item set: reuses parity.json's `conformant` roster exactly as xdot-walk.ts
// does — this already excludes the known hang (241_1: SVG verdict
// `structural-match`, not `conformant`) and every perf-quarantined id (they
// carry a non-conformant SVG verdict too), so no separate exclusion list is
// needed here. Node-only dev/test infra.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareJson, type JsonDiff } from '../golden/compare-json.js';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ROOT = process.env.CORPUS_ROOT ?? join(homedir(), 'git/graphviz/tests');
const DOT_BIN = process.env.DOT_BIN ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env.GVBINDIR ?? '/tmp/ghl';
const RENDER_ONE = join(REPO, 'test/corpus/render-one-json.ts');
const PARITY = new URL('./parity.json', import.meta.url);
const JSON_PARITY = new URL('./json-parity.json', import.meta.url);
const ACCEPTED = new URL('./accepted-divergences-json.json', import.meta.url);

/** Oracle-cache identity: same scheme as xdot-walk.ts, namespaced for json. */
const ORACLE_SIG = (() => {
  let mt = '';
  try { mt = String(statSync(DOT_BIN).mtimeMs); } catch { /* checked in main */ }
  return createHash('sha1').update(`${DOT_BIN}\0${GVBINDIR}\0json\0${mt}`).digest('hex').slice(0, 12);
})();
const CACHE = process.env.JSON_ORACLE_CACHE ?? join(tmpdir(), 'dot-corpus-json-oracle', ORACLE_SIG);

const TIMEOUT_MULT = Number(process.env.JSON_TIMEOUT_MULT ?? 3);
const TIMEOUT_FLOOR_MS = Number(process.env.JSON_TIMEOUT_FLOOR_MS ?? 180_000);
const ORACLE_TIMEOUT_MS = Number(process.env.JSON_ORACLE_TIMEOUT_MS ?? 300_000);
const CONCURRENCY = Number(process.env.JSON_CONCURRENCY ?? 8);
const LIMIT = Number(process.env.JSON_LIMIT ?? 0);

/** Replace the home-dir prefix with `~` so committed artifacts leak no path. */
function scrubHome(s: string): string {
  const home = homedir();
  return home ? s.split(home).join('~') : s;
}

// ---------------------------------------------------------------------------
// Verdict + result shape (interface contract consumed by json-dashboard.ts)
// ---------------------------------------------------------------------------

export type JsonVerdict =
  | 'conformant'
  | 'diverged'
  | 'accepted'
  | 'port-error'
  | 'oracle-error'
  | 'timeout';

export interface JsonWalkResult {
  id: string;
  path: string;
  /** Input file size in bytes (the sort key). */
  size: number;
  verdict: JsonVerdict;
  /** Number of semantic diffs (diverged/accepted only). */
  diffCount?: number;
  /** Path of the first structural/value diff (the primary signature). */
  firstDiff?: string;
  /** Worst numeric delta across all diffs. */
  maxDelta?: number;
  /** Path where `maxDelta` occurs — the dashboard bucket key. */
  maxDeltaPath?: string;
  errMsg?: string;
}

interface SpawnResult { stdout: string; stderr: string; code: number | null; timedOut: boolean; }

// ---------------------------------------------------------------------------
// Spawn helpers (mirrors xdot-walk.ts spawnCapture/killGroup/resolveTsx)
// ---------------------------------------------------------------------------

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
  try { process.kill(-pid, 'SIGKILL'); } catch { /* ESRCH */ }
}

/** Locate a runnable `tsx`: TSX_BIN, local bin, npx cache, else `npx tsx`. */
function resolveTsx(): { cmd: string; pre: string[] } {
  if (process.env.TSX_BIN) return { cmd: process.env.TSX_BIN, pre: [] };
  const local = join(REPO, 'node_modules/.bin/tsx');
  if (existsSync(local)) return { cmd: local, pre: [] };
  const npx = join(homedir(), '.npm/_npx');
  if (existsSync(npx)) {
    for (const dir of readdirSync(npx)) {
      const bin = join(npx, dir, 'node_modules/.bin/tsx');
      if (existsSync(bin)) return { cmd: bin, pre: [] };
    }
  }
  return { cmd: 'npx', pre: ['--no-install', 'tsx'] };
}

function firstLine(s: string): string {
  for (const line of s.split('\n')) if (line.trim().length > 0) return line.trim();
  return '';
}

/** Extract the port's thrown error behind the `__RENDER_ERROR__` sentinel. */
function portErrMsg(stderr: string): string {
  const marker = '__RENDER_ERROR__';
  for (const line of stderr.split('\n')) {
    if (line.startsWith(marker)) return line.slice(marker.length).trim();
  }
  return firstLine(stderr);
}

// ---------------------------------------------------------------------------
// Oracle + port render
// ---------------------------------------------------------------------------

/** Render an input to json with the native oracle, caching text + native ms. */
async function oracleJson(absInput: string, id: string): Promise<{ json?: string; ms?: number; err?: string }> {
  const cacheFile = join(CACHE, `${id}.json`);
  const msFile = join(CACHE, `${id}.ms`);
  if (existsSync(cacheFile) && existsSync(msFile)) {
    const cached = readFileSync(cacheFile, 'utf8');
    const ms = Number(readFileSync(msFile, 'utf8'));
    if (cached.length > 0 && Number.isFinite(ms)) return { json: cached, ms };
  }
  const env = { ...process.env, GVBINDIR };
  const t = Date.now();
  const r = await spawnCapture(DOT_BIN, ['-Tjson', absInput], env, ORACLE_TIMEOUT_MS);
  const ms = Date.now() - t;
  // Native dot exits nonzero on recoverable warnings while still emitting a
  // COMPLETE json document. Completeness (a closing `}`) is the validity
  // signal, not the exit code — mirrors xdot-walk.ts's `}` check.
  if (r.timedOut || !r.stdout.trimEnd().endsWith('}')) {
    return { err: firstLine(r.stderr) || `oracle exit ${r.code}` };
  }
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cacheFile, r.stdout);
  writeFileSync(msFile, String(ms));
  return { json: r.stdout, ms };
}

/** Render an input to json with the port in a budget-killed subprocess. */
async function portJson(
  absInput: string,
  tsx: { cmd: string; pre: string[] },
  budgetMs: number,
): Promise<{ json?: string; verdict?: JsonVerdict; errMsg?: string }> {
  const args = [...tsx.pre, RENDER_ONE, absInput, 'dot'];
  const r = await spawnCapture(tsx.cmd, args, process.env, budgetMs);
  if (r.timedOut) return { verdict: 'timeout' };
  if (r.code !== 0 || r.stdout.length === 0) {
    return { verdict: 'port-error', errMsg: portErrMsg(r.stderr) || `port exit ${r.code}` };
  }
  return { json: r.stdout };
}

// ---------------------------------------------------------------------------
// Diff summarization
// ---------------------------------------------------------------------------

/** Reduce a diff list to its report fields (first diff + worst numeric). */
function summarize(diffs: JsonDiff[]): Pick<JsonWalkResult, 'diffCount' | 'firstDiff' | 'maxDelta' | 'maxDeltaPath'> {
  let maxDelta = 0;
  let maxDeltaPath: string | undefined;
  let firstDiff: string | undefined;
  for (const d of diffs) {
    if (firstDiff === undefined && d.kind !== 'numeric') firstDiff = d.path;
    if (d.delta !== undefined && d.delta > maxDelta) {
      maxDelta = d.delta;
      maxDeltaPath = d.path;
    }
  }
  if (firstDiff === undefined && diffs.length > 0) firstDiff = diffs[0].path;
  return {
    diffCount: diffs.length,
    firstDiff,
    ...(maxDelta > 0 ? { maxDelta, maxDeltaPath } : {}),
  };
}

// ---------------------------------------------------------------------------
// Walk one item
// ---------------------------------------------------------------------------

interface Item { id: string; path: string; size: number; }

async function walkOne(
  item: Item,
  tsx: { cmd: string; pre: string[] },
  accepted: Set<string>,
): Promise<{ result: JsonWalkResult; diffs: JsonDiff[]; oracle?: string; port?: string }> {
  const absInput = join(ROOT, item.path);
  const meta = { id: item.id, path: item.path, size: item.size };
  const oracle = await oracleJson(absInput, item.id);
  if (oracle.json === undefined) {
    return { result: { ...meta, verdict: 'oracle-error', errMsg: scrubHome(oracle.err ?? '') }, diffs: [] };
  }
  const budgetMs = Math.max(TIMEOUT_FLOOR_MS, Math.ceil(TIMEOUT_MULT * (oracle.ms ?? 0)));
  const port = await portJson(absInput, tsx, budgetMs);
  if (port.json === undefined) {
    return { result: { ...meta, verdict: port.verdict!, errMsg: scrubHome(port.errMsg ?? '') }, diffs: [] };
  }
  const { pass, diffs } = compareJson(port.json, oracle.json);
  if (pass) return { result: { ...meta, verdict: 'conformant' }, diffs: [] };
  const verdict: JsonVerdict = accepted.has(item.id) ? 'accepted' : 'diverged';
  return {
    result: { ...meta, verdict, ...summarize(diffs) },
    diffs,
    oracle: oracle.json,
    port: port.json,
  };
}

// ---------------------------------------------------------------------------
// Item enumeration (conformant set, size-sorted — mirrors xdot-walk.ts)
// ---------------------------------------------------------------------------

interface ParityRow { id: string; path: string; verdict: string; }

function conformantItems(): Item[] {
  const parity = JSON.parse(readFileSync(PARITY, 'utf8')) as { results: ParityRow[] };
  const items: Item[] = [];
  for (const r of parity.results) {
    if (r.verdict !== 'conformant') continue;
    let size = 0;
    try { size = statSync(join(ROOT, r.path)).size; } catch { size = 0; }
    items.push({ id: r.id, path: r.path, size });
  }
  items.sort((a, b) => a.size - b.size || a.id.localeCompare(b.id));
  return LIMIT > 0 ? items.slice(0, LIMIT) : items;
}

function loadAccepted(): Set<string> {
  try {
    const raw = JSON.parse(readFileSync(ACCEPTED, 'utf8')) as { divergences?: Array<{ id: string }> };
    return new Set((raw.divergences ?? []).map((d) => d.id));
  } catch {
    return new Set();
  }
}

async function oracleVersion(): Promise<string> {
  const r = await spawnCapture(DOT_BIN, ['-V'], { ...process.env, GVBINDIR }, 5000);
  const m = (r.stderr + r.stdout).match(/version (\d+\.\d+\.\d+)/);
  return m ? `dot ${m[1]}` : 'dot (unknown)';
}

// ---------------------------------------------------------------------------
// Diff printing (default stop-on-first mode)
// ---------------------------------------------------------------------------

function printDivergence(result: JsonWalkResult, diffs: JsonDiff[]): void {
  process.stderr.write(
    `\nDIVERGENCE at ${result.id} (${result.path}, ${result.size}B) — ` +
      `${diffs.length} diff(s):\n`,
  );
  for (const d of diffs.slice(0, 25)) {
    process.stderr.write(
      `  ${d.path}\n    port=${d.actual}  native=${d.expected}` +
        `${d.delta !== undefined ? `  delta=${d.delta.toFixed(4)}` : ''}  [${d.kind}]\n`,
    );
  }
  if (diffs.length > 25) process.stderr.write(`  ... and ${diffs.length - 25} more diff(s)\n`);
  process.stderr.write(
    `\nInspect:\n` +
      `  GVBINDIR=${GVBINDIR} ${DOT_BIN} -Tjson ${join(ROOT, result.path)}\n` +
      `  npx tsx ${RENDER_ONE} ${join(ROOT, result.path)}\n`,
  );
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

/** Stop-on-first-divergence: sequential, halt at the first real divergence. */
async function runDefault(items: Item[], tsx: { cmd: string; pre: string[] }, accepted: Set<string>): Promise<void> {
  let passed = 0;
  for (const item of items) {
    const { result, diffs } = await walkOne(item, tsx, accepted);
    if (result.verdict === 'conformant' || result.verdict === 'accepted') {
      passed++;
      continue;
    }
    // A divergence, port-error, oracle-error, or timeout — stop and report.
    if (result.verdict === 'diverged') {
      printDivergence(result, diffs);
    } else {
      process.stderr.write(
        `\n${result.verdict.toUpperCase()} at ${result.id} (${result.path}): ${result.errMsg ?? ''}\n`,
      );
    }
    process.stderr.write(`\n(${passed} conformant before this item)\n`);
    process.exit(1);
  }
  process.stderr.write(`\nALL ${passed}/${items.length} conformant json items pass.\n`);
  process.exit(0);
}

/** Survey: render all, write json-parity.json (never halts). */
async function runSurvey(items: Item[], tsx: { cmd: string; pre: string[] }, accepted: Set<string>): Promise<void> {
  const results: JsonWalkResult[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = (await walkOne(items[i], tsx, accepted)).result;
      if (++done % 50 === 0) process.stderr.write(`  ${done}/${items.length}\n`);
    }
  };
  const n = Math.min(CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: n }, worker));

  const counts: Record<JsonVerdict, number> = {
    conformant: 0, diverged: 0, accepted: 0, 'port-error': 0, 'oracle-error': 0, timeout: 0,
  };
  for (const r of results) counts[r.verdict]++;
  const report = {
    generatedAt: new Date().toISOString(),
    generatedWith: 'test/corpus/json-walk.ts --survey',
    oracleVersion: await oracleVersion(),
    corpusRoot: scrubHome(ROOT),
    total: results.length,
    counts,
    results,
  };
  writeFileSync(JSON_PARITY, JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(`wrote json-parity.json — ${JSON.stringify(counts)}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(DOT_BIN)) {
    process.stderr.write(`harness fault: oracle binary not found at ${DOT_BIN}\n`);
    process.exit(2);
  }
  const survey = process.argv.includes('--survey');
  const items = conformantItems();
  const accepted = loadAccepted();
  const tsx = resolveTsx();
  process.stderr.write(
    `json ${survey ? 'survey' : 'walk (stop-on-first)'}: ${items.length} conformant items, ` +
      `size-sorted small→large\noracle ${DOT_BIN} (GVBINDIR=${GVBINDIR})\ncache ${CACHE}\n` +
      `accepted divergences: ${accepted.size}\n`,
  );
  if (survey) await runSurvey(items, tsx, accepted);
  else await runDefault(items, tsx, accepted);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main().catch((e) => {
    process.stderr.write(`harness fault: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  });
}
