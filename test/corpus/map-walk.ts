// SPDX-License-Identifier: EPL-2.0
//
// Imagemap conformance walker (mission: map-conformance, T3 twin of
// xdot-walk.ts). Walks the SVG-conformant corpus items from parity.json,
// sorted by input file size (small → large, same discipline as xdot-walk.ts
// AD-2), rendering each to BOTH `cmapx` and `imap` through the native oracle
// (`dot -Tcmapx` / `dot -Timap`, GVBINDIR=/tmp/ghl) and through the port
// (render-one-map.ts, T1), diffing each format with its own semantic
// comparator (compare-map.ts, T2). Two modes, same as xdot-walk.ts:
//
//   • DEFAULT (stop-on-first-divergence): render/compare in size order, HALT
//     at the first non-accepted divergence in EITHER format and print its
//     diff. Exit 0 iff the whole conformant set passes; exit 1 otherwise.
//
//   • --survey: render every item in both formats, record a per-format
//     verdict plus an overall (worst-of-two) verdict, and write
//     map-parity.json (consumed by map-dashboard.ts, T4). Never halts.
//
// Reuses xdot-walk.ts's spawn + oracle-cache model: every port render is a
// group-killed subprocess with a wall-clock budget; native oracle output is
// cached under a signature of (binary, GVBINDIR, mtime) so a rebuilt `dot`
// auto-invalidates. Node-only dev/test infra.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCmapx, compareImap, type MapDiff } from '../golden/compare-map.js';
import { CMAPX_SENTINEL, IMAP_SENTINEL } from './render-one-map.js';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ROOT = process.env.CORPUS_ROOT ?? join(homedir(), 'git/graphviz/tests');
const DOT_BIN = process.env.DOT_BIN ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env.GVBINDIR ?? '/tmp/ghl';
const RENDER_ONE = join(REPO, 'test/corpus/render-one-map.ts');
const PARITY = new URL('./parity.json', import.meta.url);
const MAP_PARITY = new URL('./map-parity.json', import.meta.url);
const ACCEPTED = new URL('./accepted-divergences-map.json', import.meta.url);

/** Oracle-cache identity: same scheme as xdot-walk.ts, namespaced for map. */
const ORACLE_SIG = (() => {
  let mt = '';
  try { mt = String(statSync(DOT_BIN).mtimeMs); } catch { /* checked in main */ }
  return createHash('sha1').update(`${DOT_BIN}\0${GVBINDIR}\0map\0${mt}`).digest('hex').slice(0, 12);
})();
const CACHE = process.env.MAP_ORACLE_CACHE ?? join(tmpdir(), 'dot-corpus-map-oracle', ORACLE_SIG);

const TIMEOUT_MULT = Number(process.env.MAP_TIMEOUT_MULT ?? 3);
const TIMEOUT_FLOOR_MS = Number(process.env.MAP_TIMEOUT_FLOOR_MS ?? 180_000);
const ORACLE_TIMEOUT_MS = Number(process.env.MAP_ORACLE_TIMEOUT_MS ?? 300_000);
const CONCURRENCY = Number(process.env.MAP_CONCURRENCY ?? 8);
const LIMIT = Number(process.env.MAP_LIMIT ?? 0);

/** Replace the home-dir prefix with `~` so committed artifacts leak no path. */
function scrubHome(s: string): string {
  const home = homedir();
  return home ? s.split(home).join('~') : s;
}

// ---------------------------------------------------------------------------
// Verdict + result shape (interface contract consumed by T4)
// ---------------------------------------------------------------------------

export type MapVerdict =
  | 'conformant'
  | 'diverged'
  | 'accepted'
  | 'port-error'
  | 'oracle-error'
  | 'timeout';

/** Rank used to pick the "worst" of two per-format verdicts (higher = worse). */
const VERDICT_RANK: Record<MapVerdict, number> = {
  conformant: 0,
  accepted: 1,
  diverged: 2,
  timeout: 3,
  'port-error': 4,
  'oracle-error': 5,
};

function worstVerdict(a: MapVerdict, b: MapVerdict): MapVerdict {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b;
}

/** One format's (cmapx or imap) walk outcome for one corpus item. */
export interface MapFormatResult {
  verdict: MapVerdict;
  diffCount?: number;
  firstDiff?: string;
  maxDelta?: number;
  maxDeltaPath?: string;
  errMsg?: string;
}

export interface MapWalkResult {
  id: string;
  path: string;
  /** Input file size in bytes (the sort key). */
  size: number;
  /** Worst of cmapx.verdict / imap.verdict. */
  verdict: MapVerdict;
  cmapx: MapFormatResult;
  imap: MapFormatResult;
  /**
   * True when the ORACLE's cmapx output has ≥1 `href="..."` area, or its
   * imap output has ≥1 `rect|circle|poly` line — i.e. this id actually
   * exercises anchor emission (not just an empty/tooltip-only map). Computed
   * from real oracle output rather than grepping the DOT source (HTML-label
   * `HREF=`, node `URL=`, `edgehref=`, etc. all collapse to the same
   * observable output) so it matches exactly what the comparator judges.
   * `false` when the oracle errored/timed out before this could be observed.
   */
  hasHref: boolean;
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

type MapFormat = 'cmapx' | 'imap';

/** True once the oracle's output for `format` looks complete (mirrors
 * xdot-walk.ts's `</svg>`-tail completeness check). */
function isComplete(format: MapFormat, stdout: string): boolean {
  const trimmed = stdout.trimEnd();
  if (format === 'cmapx') return trimmed.endsWith('</map>');
  // FORMAT_IMAP unconditionally starts with "base referer\n"
  // (gvrender_core_map.c:map_begin_page) whenever the render succeeds.
  return trimmed.startsWith('base referer');
}

/** Render one input to `format` with the native oracle, caching text + ms. */
async function oracleFormat(
  absInput: string,
  id: string,
  format: MapFormat,
): Promise<{ text?: string; ms?: number; err?: string }> {
  const cacheFile = join(CACHE, `${id}.${format}`);
  const msFile = join(CACHE, `${id}.${format}.ms`);
  if (existsSync(cacheFile) && existsSync(msFile)) {
    const cached = readFileSync(cacheFile, 'utf8');
    const ms = Number(readFileSync(msFile, 'utf8'));
    if (cached.length > 0 && Number.isFinite(ms)) return { text: cached, ms };
  }
  const env = { ...process.env, GVBINDIR };
  const t = Date.now();
  const r = await spawnCapture(DOT_BIN, [`-T${format}`, absInput], env, ORACLE_TIMEOUT_MS);
  const ms = Date.now() - t;
  // Native dot exits nonzero on recoverable warnings while still emitting
  // complete output — completeness is the validity signal, not exit code
  // (mirrors xdot-walk.ts / survey.ts).
  if (r.timedOut || !isComplete(format, r.stdout)) {
    return { err: firstLine(r.stderr) || `oracle exit ${r.code}` };
  }
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cacheFile, r.stdout);
  writeFileSync(msFile, String(ms));
  return { text: r.stdout, ms };
}

/** Render one input to BOTH formats with the port, in one budget-killed
 * subprocess (render-one-map.ts renders cmapx then imap and separates them
 * with sentinels). */
async function portMap(
  absInput: string,
  tsx: { cmd: string; pre: string[] },
  budgetMs: number,
): Promise<{ cmapx?: string; imap?: string; verdict?: MapVerdict; errMsg?: string }> {
  const args = [...tsx.pre, RENDER_ONE, absInput, 'dot'];
  const r = await spawnCapture(tsx.cmd, args, process.env, budgetMs);
  if (r.timedOut) return { verdict: 'timeout' };
  if (r.code !== 0 || r.stdout.length === 0) {
    return { verdict: 'port-error', errMsg: portErrMsg(r.stderr) || `port exit ${r.code}` };
  }
  const cIdx = r.stdout.indexOf(CMAPX_SENTINEL);
  const iIdx = r.stdout.indexOf(IMAP_SENTINEL);
  if (cIdx !== 0 || iIdx < 0) {
    return { verdict: 'port-error', errMsg: 'render-one-map: missing sentinel(s) in stdout' };
  }
  const cmapx = r.stdout.slice(CMAPX_SENTINEL.length, iIdx);
  const imap = r.stdout.slice(iIdx + IMAP_SENTINEL.length);
  return { cmapx, imap };
}

// ---------------------------------------------------------------------------
// Diff summarization (shared by both formats)
// ---------------------------------------------------------------------------

function summarize(diffs: MapDiff[]): Pick<MapFormatResult, 'diffCount' | 'firstDiff' | 'maxDelta' | 'maxDeltaPath'> {
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

/** Compare one format's port/oracle text pair and fold in acceptance. */
function judgeFormat(
  format: MapFormat,
  portText: string,
  oracleText: string,
  accepted: boolean,
): { result: MapFormatResult; diffs: MapDiff[] } {
  const { pass, diffs } = format === 'cmapx' ? compareCmapx(portText, oracleText) : compareImap(portText, oracleText);
  if (pass) return { result: { verdict: 'conformant' }, diffs: [] };
  const verdict: MapVerdict = accepted ? 'accepted' : 'diverged';
  return { result: { verdict, ...summarize(diffs) }, diffs };
}

/** Does the ORACLE's output for this id actually exercise anchor emission
 * (≥1 real `href`), vs. an empty or tooltip-only map? See MapWalkResult
 * .hasHref doc. */
function detectHasHref(oracleCmapx: string, oracleImap: string): boolean {
  return /\bhref="/.test(oracleCmapx) || /^(rect|circle|poly)\s/m.test(oracleImap);
}

async function walkOne(
  item: Item,
  tsx: { cmd: string; pre: string[] },
  accepted: Set<string>,
): Promise<{
  result: MapWalkResult;
  cmapxDiffs: MapDiff[];
  imapDiffs: MapDiff[];
  oracleCmapx?: string;
  oracleImap?: string;
  portCmapx?: string;
  portImap?: string;
}> {
  const absInput = join(ROOT, item.path);
  const meta = { id: item.id, path: item.path, size: item.size };
  const oCmapx = await oracleFormat(absInput, item.id, 'cmapx');
  const oImap = await oracleFormat(absInput, item.id, 'imap');
  if (oCmapx.text === undefined || oImap.text === undefined) {
    const errMsg = scrubHome(oCmapx.err ?? oImap.err ?? '');
    const errResult: MapFormatResult = { verdict: 'oracle-error', errMsg };
    return {
      result: { ...meta, verdict: 'oracle-error', cmapx: errResult, imap: errResult, hasHref: false },
      cmapxDiffs: [],
      imapDiffs: [],
    };
  }
  const hasHref = detectHasHref(oCmapx.text, oImap.text);
  const oracleMs = (oCmapx.ms ?? 0) + (oImap.ms ?? 0);
  const budgetMs = Math.max(TIMEOUT_FLOOR_MS, Math.ceil(TIMEOUT_MULT * oracleMs));
  const port = await portMap(absInput, tsx, budgetMs);
  if (port.cmapx === undefined || port.imap === undefined) {
    const errResult: MapFormatResult = { verdict: port.verdict!, errMsg: scrubHome(port.errMsg ?? '') };
    return {
      result: { ...meta, verdict: port.verdict!, cmapx: errResult, imap: errResult, hasHref },
      cmapxDiffs: [],
      imapDiffs: [],
    };
  }
  const isAccepted = accepted.has(item.id);
  const { result: cmapxResult, diffs: cmapxDiffs } = judgeFormat('cmapx', port.cmapx, oCmapx.text, isAccepted);
  const { result: imapResult, diffs: imapDiffs } = judgeFormat('imap', port.imap, oImap.text, isAccepted);
  return {
    result: {
      ...meta,
      verdict: worstVerdict(cmapxResult.verdict, imapResult.verdict),
      cmapx: cmapxResult,
      imap: imapResult,
      hasHref,
    },
    cmapxDiffs,
    imapDiffs,
    oracleCmapx: oCmapx.text,
    oracleImap: oImap.text,
    portCmapx: port.cmapx,
    portImap: port.imap,
  };
}

// ---------------------------------------------------------------------------
// Item enumeration (conformant set, size-sorted — same source as xdot-walk.ts)
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

function printDivergence(format: MapFormat, result: MapWalkResult, diffs: MapDiff[]): void {
  process.stderr.write(
    `\nDIVERGENCE (${format}) at ${result.id} (${result.path}, ${result.size}B) — ` +
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
      `  GVBINDIR=${GVBINDIR} ${DOT_BIN} -T${format} ${join(ROOT, result.path)}\n` +
      `  npx tsx ${RENDER_ONE} ${join(ROOT, result.path)}\n`,
  );
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

/** Stop-on-first-divergence: sequential, halt at the first real divergence
 * in either format. */
async function runDefault(items: Item[], tsx: { cmd: string; pre: string[] }, accepted: Set<string>): Promise<void> {
  let passed = 0;
  for (const item of items) {
    const { result, cmapxDiffs, imapDiffs } = await walkOne(item, tsx, accepted);
    if (result.verdict === 'conformant' || result.verdict === 'accepted') {
      passed++;
      continue;
    }
    if (result.cmapx.verdict === 'diverged') printDivergence('cmapx', result, cmapxDiffs);
    if (result.imap.verdict === 'diverged') printDivergence('imap', result, imapDiffs);
    if (result.cmapx.verdict !== 'diverged' && result.imap.verdict !== 'diverged') {
      process.stderr.write(
        `\n${result.verdict.toUpperCase()} at ${result.id} (${result.path}): ` +
          `${result.cmapx.errMsg ?? result.imap.errMsg ?? ''}\n`,
      );
    }
    process.stderr.write(`\n(${passed} conformant before this item)\n`);
    process.exit(1);
  }
  process.stderr.write(`\nALL ${passed}/${items.length} conformant map items pass.\n`);
  process.exit(0);
}

/** Survey: render all, write map-parity.json (never halts). */
async function runSurvey(items: Item[], tsx: { cmd: string; pre: string[] }, accepted: Set<string>): Promise<void> {
  const results: MapWalkResult[] = new Array(items.length);
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

  const counts: Record<MapVerdict, number> = {
    conformant: 0, diverged: 0, accepted: 0, 'port-error': 0, 'oracle-error': 0, timeout: 0,
  };
  for (const r of results) counts[r.verdict]++;
  const report = {
    generatedAt: new Date().toISOString(),
    generatedWith: 'test/corpus/map-walk.ts --survey',
    oracleVersion: await oracleVersion(),
    corpusRoot: scrubHome(ROOT),
    total: results.length,
    counts,
    results,
  };
  writeFileSync(MAP_PARITY, JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(`wrote map-parity.json — ${JSON.stringify(counts)}\n`);
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
    `map ${survey ? 'survey' : 'walk (stop-on-first)'}: ${items.length} conformant items, ` +
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
