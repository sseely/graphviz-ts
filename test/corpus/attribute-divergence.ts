// SPDX-License-Identifier: EPL-2.0
//
// Injection attribution harness (T1, iterative-parity-campaign batch-1).
//
// For every `diverged` id in a `parity-<engine>.json` (produced by
// engine-walk.ts), injects the native oracle's pre-routing node positions
// into the port (via the GVTS_POS_INJECT hook in src/layout/neato/splines.ts)
// and re-compares against the oracle with the semantic comparator. This
// separates "port routing/emission is wrong" (verdict 'not-cleared') from
// "the two engines' iterative solvers converged to numerically different but
// each internally consistent layouts" (verdict 'drift-exonerated', D2's
// A1-drift class) — the latter is not a port bug.
//
// D1: only the pre-routing ND_pos stage is implemented; --stage is reserved
// for future post-init/post-overlap escalation (manual diagnosis only, never
// bulk runs) and errors clearly on any value other than 'pos'.
// D4: the oracle binary is sha1-hashed before every run; a resumed run whose
// cached dump set was captured with a different oracle binary refuses to
// proceed rather than silently mixing incompatible dumps.
// D5: each row is bucketed by firstDiff shape plus a uniform-translation /
// mirror detector, so batch-3 can chase the largest not-cleared bucket.
//
// The oracle side needs ONE invocation per id: `-Txdot` on stdout is the
// final oracle render to compare against, and (with GVTS_POS_DUMP=1) the
// pre-routing ND_pos dump arrives on stderr in the same process — see
// plans/iterative-parity-campaign/diagrams/injection-recipe.md for the
// native-tree patch this depends on (session-local, never committed there).
//
// The port side is spawned detached + killed via the whole process group on
// timeout, copy-shaped from engine-walk.ts's oracle/port spawn pattern (a
// plain spawnSync once orphaned a rendering process for 20h — see the
// 2026-07-11 journal entry — so this reuses the hardened pattern rather than
// re-deriving it).
//
// Usage: npx tsx test/corpus/attribute-divergence.ts <engine> [--stage pos] [--fresh]
//
// Node-only dev/test infra — never imported by src/index.ts.

import {
  readFileSync, existsSync, statSync, writeFileSync, appendFileSync, unlinkSync, openSync, closeSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compareXdot } from '../golden/compare-xdot.js';
import type { XdotDiff } from '../golden/compare-xdot.js';
import type { EngineWalkStatus, EngineParityReport } from './engine-walk.js';

// ---------------------------------------------------------------------------
// Public types (interface contract: attribution-<engine>.json)
// ---------------------------------------------------------------------------

export type AttributionVerdict = 'drift-exonerated' | 'not-cleared' | 'harness-error';

/** D5 classifier output for one id. */
export interface AttributionBucket {
  /** firstDiff-derived bucket label: `<objectType>/<attr>/<diffKind>`. */
  shape: string;
  /** Present only when every remaining numeric diff shares one (dx, dy). */
  uniformDelta?: [number, number];
  /** Present (true) only when the remaining diffs are a pure y-negation. */
  mirror?: boolean;
  /**
   * D5's count-vs-position split. `count` when ANY diff is structural — an
   * element the port failed to emit or emitted too many of (`[missing]`,
   * `[opCount]`, `[ptCount]`, `[count]`); `position` when every diff is
   * numeric, i.e. the right elements exist and only their coordinates drift.
   *
   * This is the axis `shape` cannot express, and the one that actually
   * separates mechanisms: a missing element is a porting gap, drifting
   * coordinates are an arithmetic gap. They are never the same bug.
   */
  kind: 'count' | 'position';
  /**
   * Every distinct `<objectType>/<attr>/<diffKind>` in the id's diff list,
   * sorted, joined with `+` (capped at 6 entries).
   *
   * `shape` records only the FIRST diff, which is not a mechanism: on the
   * 2026-07-12 neato run, `graph/_draw_/numeric` collected 252 ids spanning at
   * least two unrelated bugs (a truncated graph bb, and a graph label the port
   * never emitted) purely because a graph-level numeric diff happens to sort
   * first in both. Bucketing B3's rounds on `shape` alone chases a fiction;
   * this signature is what rounds should group on.
   */
  signature: string;
}

/** One entry of attribution-<engine>.json's `results`. */
export interface AttributionRow {
  id: string;
  verdict: AttributionVerdict;
  baseDiffs: number;
  injectedDiffs: number;
  bucket: AttributionBucket;
  /**
   * Extension beyond the task-spec interface contract (additive, harmless to
   * consumers that only read the spec'd fields): short diagnostic for
   * verdict === 'harness-error'.
   */
  err?: string;
}

/** attribution-<engine>.json shape. */
export interface AttributionReport {
  generatedAt: string;
  oracleSha1: string;
  tolerance: number;
  results: AttributionRow[];
}

// ---------------------------------------------------------------------------
// Config (mirrors engine-walk.ts's env-var conventions)
// ---------------------------------------------------------------------------

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const CORPUS = process.env['CORPUS_ROOT'] ?? join(homedir(), 'git/graphviz/tests');
const DOT_BIN = process.env['DOT_BIN'] ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env['GVBINDIR'] ?? '/tmp/ghl';

/** D1: only the pre-routing ND_pos stage is implemented in bulk. */
const SUPPORTED_STAGE = 'pos';

// ---------------------------------------------------------------------------
// D5 classifier — pure, unit-testable
// ---------------------------------------------------------------------------

const NUM_INDEX_RE = /\[(\d+)\]$/;
/** Just above the deterministic 0.01pt tolerance; well under a real geometry shift. */
const UNIFORM_EPS = 0.05;

function objectTypeOf(objectKey: string): string {
  if (objectKey.startsWith('[graph]')) return 'graph';
  const i = objectKey.indexOf(':');
  return i === -1 ? objectKey : objectKey.slice(0, i);
}

function avg(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function allClose(vals: number[], eps: number): boolean {
  if (vals.length === 0) return false;
  const m = avg(vals);
  return vals.every((v) => Math.abs(v - m) <= eps);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * D5: bucket the remaining divergence by firstDiff shape, plus a
 * uniform-translation and a mirror (y-negation) detector. `diffs` is the
 * INJECTED-comparison diff list; when injection fully cleared the
 * divergence (drift-exonerated, diffs empty) the bucket falls back to a
 * coarse parse of the pre-injection `firstDiff` string carried in
 * parity-<engine>.json, so exonerated rows still record what kind of
 * divergence turned out to be pure drift.
 *
 * The x/y split below assumes draw-op and positional numeric payloads are
 * flat (x, y, x, y, ...) sequences — true for pos/bb and every point-based
 * xdot op (ellipse, polygon, bezier, points) — so even-indexed diffs are x
 * and odd-indexed are y. This is a best-effort diagnostic classifier, not a
 * corpus gate: a bucket that doesn't fire a detector still reports `shape`.
 */
export function classifyBucket(diffs: XdotDiff[], fallbackFirstDiff?: string): AttributionBucket {
  if (diffs.length === 0) {
    if (!fallbackFirstDiff) return { shape: 'unknown', kind: 'position', signature: 'none' };
    const sp = fallbackFirstDiff.split(' ');
    const object = sp[0] ?? 'unknown';
    const attr = sp[1] ?? 'unknown';
    return {
      shape: `${objectTypeOf(object)}/${attr}/unknown`,
      kind: 'position',
      signature: 'none',
    };
  }

  const first = diffs[0]!;
  const terms = [...new Set(diffs.map((d) => `${objectTypeOf(d.object)}/${d.attr}/${d.kind}`))].sort();
  const bucket: AttributionBucket = {
    shape: `${objectTypeOf(first.object)}/${first.attr}/${first.kind}`,
    // A structural diff means an element is missing or duplicated, not merely
    // displaced — C emitted something the port did not (or vice versa).
    kind: diffs.some((d) => d.kind === 'structural') ? 'count' : 'position',
    signature: terms.slice(0, 6).join('+') + (terms.length > 6 ? `+…(${terms.length})` : ''),
  };

  const numeric = diffs.filter((d) => d.kind === 'numeric' && d.delta !== undefined);
  if (numeric.length < 2) return bucket;

  const samples = numeric
    .map((d) => {
      const m = NUM_INDEX_RE.exec(d.path);
      return { j: m ? Number(m[1]) : -1, actual: Number(d.actual), expected: Number(d.expected) };
    })
    .filter((s) => s.j >= 0 && Number.isFinite(s.actual) && Number.isFinite(s.expected));
  const xs = samples.filter((s) => s.j % 2 === 0);
  const ys = samples.filter((s) => s.j % 2 === 1);
  const dxs = xs.map((s) => s.actual - s.expected);
  const dys = ys.map((s) => s.actual - s.expected);

  if (xs.length > 0 && ys.length > 0 && allClose(dxs, UNIFORM_EPS) && allClose(dys, UNIFORM_EPS)) {
    bucket.uniformDelta = [round2(avg(dxs)), round2(avg(dys))];
  }
  // Mirror (y-negation): every y diff satisfies actual ≈ -expected, and no x
  // diffs exist at all (x survived unchanged — if it had changed it would
  // itself show up above the comparator's tolerance).
  if (xs.length === 0 && ys.length > 0 && ys.every((s) => Math.abs(s.actual + s.expected) <= UNIFORM_EPS)) {
    bucket.mirror = true;
  }
  return bucket;
}

/**
 * Collapse the append-only `.jsonl` into one row per id, last-write-wins,
 * preserving first-appearance order.
 *
 * The `.jsonl` is an append-only resume log with no lock: the skip-set is
 * snapshotted once at startup, so two harness processes running concurrently
 * against the same engine each re-attribute the ids the other has not yet
 * flushed, and both append. That happened for real on the first neato run
 * (2026-07-12: an orphaned sweep overlapped a resume — 649 rows for 491 ids),
 * and without this collapse the duplicates reach `attribution-<engine>.json`
 * and double-count in every consumer (parity-report.ts derives A1-drift class
 * membership by counting these rows).
 *
 * Last-write-wins is safe because the harness is deterministic: across all 158
 * ids duplicated by that overlap, every repeat row agreed exactly on verdict
 * and injectedDiffs. A later row is therefore either identical, or a genuine
 * re-run after a fixed harness bug — in both cases the newer row is the one to
 * keep.
 */
export function dedupeRows(jsonlText: string): AttributionRow[] {
  const byId = new Map<string, AttributionRow>();
  for (const ln of jsonlText.split('\n')) {
    if (!ln) continue;
    try {
      const obj: unknown = JSON.parse(ln);
      if (obj && typeof obj === 'object' && !('_meta' in obj) && 'id' in obj) {
        byId.set((obj as AttributionRow).id, obj as AttributionRow);
      }
    } catch { /* partial line */ }
  }
  return [...byId.values()];
}

/**
 * Refuse to run when another sweep for the same engine is live. Writes a pid
 * lockfile with O_EXCL; an existing lock whose pid is dead (SIGKILLed sweep,
 * crashed run) is stale and gets cleared rather than blocking forever.
 * `process.kill(pid, 0)` is a liveness probe — it signals nothing, it only
 * throws ESRCH when no such process exists.
 *
 * This guard was dropped once, on the reasoning that "don't run two sweeps at
 * once" is the operator's job. Within the hour the operator misread a silent
 * `pgrep` as "no sweeps running" (it prints nothing AND exits non-zero on a
 * zero count) while six were live, launched more against the same jsonls, and
 * corrupted three of them with duplicate appends — 786/833/784 rows for a
 * 761-id corpus. `dedupeRows` keeps the emitted report correct either way, but
 * the duplicated work is hours of wasted oracle+port renders, and a sweep that
 * bails mid-flight leaves a STALE summary that reads like a real result. The
 * cheap lock is worth more than the discipline it replaces.
 */
export async function runExclusive<T>(lockPath: string, body: () => Promise<T>): Promise<T> {
  if (existsSync(lockPath)) {
    const pid = Number(readFileSync(lockPath, 'utf8').trim());
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch { alive = false; }
    if (alive) {
      console.error(
        `another attribution sweep (pid ${pid}) is already running against this output — ` +
        'refusing to start a second one. Two concurrent sweeps share one append-only JSONL ' +
        'and duplicate every id the first has not yet reached (observed 2026-07-12). ' +
        `Wait for it, or remove ${lockPath} if you are certain it is stale.`,
      );
      process.exit(1);
    }
    unlinkSync(lockPath); // stale lock from a killed sweep
  }
  closeSync(openSync(lockPath, 'wx')); // 'wx' = atomic create-or-fail: wins the race
  writeFileSync(lockPath, String(process.pid));
  try {
    // `await` is load-bearing: without it the finally below would unlink the
    // lock the instant the async body returned its (unsettled) promise.
    return await body();
  } finally {
    try { unlinkSync(lockPath); } catch { /* already gone */ }
  }
}

// ---------------------------------------------------------------------------
// Oracle side — ONE invocation captures both the final xdot (stdout) and the
// pre-routing ND_pos dump (stderr, GVTS_POS_DUMP=1).
// ---------------------------------------------------------------------------

type OracleDumpResult =
  | { ok: true; xdot: string; dumpLines: string[] }
  | { ok: false; err: string };

function runOracleWithDump(engine: string, path: string): OracleDumpResult {
  const r = spawnSync(DOT_BIN, ['-K', engine, '-Txdot', path], {
    env: { ...process.env, GVBINDIR, GVTS_POS_DUMP: '1' },
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 512 * 1024 * 1024,
  });
  if (r.error) {
    return { ok: false, err: String(r.error.message).split('\n')[0]!.slice(0, 200) };
  }
  if (r.status !== 0) {
    return { ok: false, err: `oracle exit ${r.status}: ${(r.stderr ?? '').split('\n')[0]!.slice(0, 160)}` };
  }
  const xdot = r.stdout ?? '';
  if (!xdot.trimEnd().endsWith('}')) return { ok: false, err: 'incomplete oracle output' };
  const dumpLines = (r.stderr ?? '').split('\n').filter((l) => l.startsWith('GVTS_POS '));
  if (dumpLines.length === 0) {
    return { ok: false, err: 'no GVTS_POS dump lines captured (native POS_DUMP patch missing/reverted?)' };
  }
  return { ok: true, xdot, dumpLines };
}

// ---------------------------------------------------------------------------
// Port side — spawned detached + process-group SIGKILL on timeout, exactly
// mirroring engine-walk.ts's hang-safe pattern (read-set: a plain spawnSync
// orphaned a render for 20h; killing only an npx wrapper leaves the node
// grandchild running).
// ---------------------------------------------------------------------------

interface PortResult { stdout: string; stderr: string; status: number | null; timedOut: boolean }

async function renderPortInjected(path: string, engine: string, dumpFile: string): Promise<PortResult> {
  return new Promise<PortResult>((resolve) => {
    const child = spawn('npx', ['tsx', join(REPO, 'test/corpus/render-one-xdot.ts'), path, engine], {
      cwd: REPO,
      env: { ...process.env, GVTS_POS_INJECT: dumpFile },
      detached: true,
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
  });
}

// ---------------------------------------------------------------------------
// D4 oracle-hash guard + resume plumbing
// ---------------------------------------------------------------------------

interface MetaLine { _meta: true; oracleSha1: string; generatedAt: string }

function currentOracleSha1(): string {
  return createHash('sha1').update(readFileSync(DOT_BIN)).digest('hex');
}

function readMeta(outPath: string): MetaLine | undefined {
  const first = readFileSync(outPath, 'utf8').split('\n', 1)[0];
  if (!first) return undefined;
  try {
    const obj: unknown = JSON.parse(first);
    if (obj && typeof obj === 'object' && (obj as { _meta?: unknown })._meta === true
        && typeof (obj as { oracleSha1?: unknown }).oracleSha1 === 'string') {
      return obj as MetaLine;
    }
  } catch { /* not a meta line */ }
  return undefined;
}

// ---------------------------------------------------------------------------
// Imperative shell: CLI entrypoint (not unit-tested — mirrors engine-walk.ts's
// and oracle-error-classifier.ts's convention that the pure logic above is
// the tested surface).
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const engine = args[0];
  if (!engine) {
    console.error('usage: npx tsx test/corpus/attribute-divergence.ts <engine> [--stage pos] [--fresh]');
    process.exit(2);
  }
  // Serialize sweeps per engine: two concurrent runs share one append-only
  // JSONL, and each computes its resume skip-set once at startup, so the second
  // re-attributes every id the first has not yet reached (see runExclusive).
  // `dedupeRows` still guarantees the emitted report holds one row per id.
  const lockPath = join(REPO, 'test/corpus', `attribution-${engine}.lock`);
  await runExclusive(lockPath, () => sweep(engine, args));
}

async function sweep(engine: string, args: string[]): Promise<void> {

  let stage = SUPPORTED_STAGE;
  let fresh = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--fresh') { fresh = true; continue; }
    if (args[i] === '--stage') { stage = args[++i] ?? ''; continue; }
  }
  if (stage !== SUPPORTED_STAGE) {
    console.error(
      `[${engine}] --stage '${stage}' is not implemented — D1 scopes bulk attribution to the ` +
      `pre-routing ND_pos stage only ('${SUPPORTED_STAGE}'). Post-init/post-overlap injection is ` +
      'manual-diagnosis-only (never bulk); this harness refuses rather than silently no-op.',
    );
    process.exit(2);
  }

  const parityPath = join(REPO, 'test/corpus', `parity-${engine}.json`);
  if (!existsSync(parityPath)) {
    console.error(`[${engine}] ${parityPath} not found — run engine-walk.ts ${engine} first`);
    process.exit(2);
  }
  const parityReport = JSON.parse(readFileSync(parityPath, 'utf8')) as EngineParityReport;
  const tolerance = parityReport.tolerance ?? 0.01;
  interface ParityRow { id: string; status: EngineWalkStatus; nDiffs?: number; firstDiff?: string; size: number }
  const diverged = (parityReport.results as unknown as ParityRow[])
    .filter((r) => r.status === 'diverged')
    .sort((a, b) => a.size - b.size || (a.id < b.id ? -1 : 1));

  interface CorpusEntry { id: string; path: string }
  const corpus = JSON.parse(readFileSync(join(REPO, 'test/corpus/parity.json'), 'utf8')) as { results: CorpusEntry[] };
  const pathById = new Map(corpus.results.map((r) => [r.id, join(CORPUS, r.path)]));

  const OUT = join(REPO, 'test/corpus', `attribution-${engine}.jsonl`);
  const SUMMARY = join(REPO, 'test/corpus', `attribution-${engine}.json`);
  const currentSha1 = currentOracleSha1();

  // D4 oracle-hash guard: a resumed run must match the sha1 the cached dump
  // set was captured with, or refuse outright (no partial output written).
  if (!fresh && existsSync(OUT) && statSync(OUT).size > 0) {
    const meta = readMeta(OUT);
    if (!meta) {
      console.error(
        `[${engine}] ${OUT} exists but has no recognizable oracle-sha1 metadata line — ` +
        'refusing to resume ambiguously. Rerun with --fresh.',
      );
      process.exit(1);
    }
    if (meta.oracleSha1 !== currentSha1) {
      console.error(
        `[${engine}] oracle sha1 mismatch: cached dump set was captured with oracle ` +
        `${meta.oracleSha1}, current oracle binary is ${currentSha1}. Refusing to resume — ` +
        'rerun with --fresh to start a new attribution set (D4 hash guard is load-bearing; ' +
        'see the twopi/2470 stale-oracle RCA it was added to catch).',
      );
      process.exit(1);
    }
  } else {
    writeFileSync(OUT, JSON.stringify({
      _meta: true, oracleSha1: currentSha1, generatedAt: new Date().toISOString(),
    } satisfies MetaLine) + '\n');
  }

  const done = new Set<string>();
  for (const ln of readFileSync(OUT, 'utf8').split('\n')) {
    if (!ln) continue;
    try {
      const obj: unknown = JSON.parse(ln);
      if (obj && typeof obj === 'object' && !('_meta' in obj) && 'id' in obj) {
        done.add((obj as { id: string }).id);
      }
    } catch { /* partial line */ }
  }

  let n = 0;
  for (const row of diverged) {
    n++;
    if (done.has(row.id)) continue;
    const rec: AttributionRow = {
      id: row.id, verdict: 'harness-error', baseDiffs: row.nDiffs ?? 0, injectedDiffs: 0,
      bucket: { shape: 'unknown', kind: 'position', signature: 'none' },
    };

    const path = pathById.get(row.id);
    if (!path) {
      rec.err = 'id not found in parity.json';
      appendFileSync(OUT, JSON.stringify(rec) + '\n');
      continue;
    }

    const oracle = runOracleWithDump(engine, path);
    if (!oracle.ok) {
      rec.err = oracle.err;
      appendFileSync(OUT, JSON.stringify(rec) + '\n');
      continue;
    }

    const dumpFile = join(tmpdir(), `gvts-pos-${engine}-${row.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-${process.pid}.txt`);
    writeFileSync(dumpFile, oracle.dumpLines.join('\n') + '\n');
    let port: PortResult;
    try {
      port = await renderPortInjected(path, engine, dumpFile);
    } finally {
      try { unlinkSync(dumpFile); } catch { /* best-effort cleanup */ }
    }

    if (port.timedOut) {
      rec.err = 'port render timeout (injected)';
    } else if (port.status !== 0) {
      const m = /__RENDER_ERROR__ (.*)/.exec(port.stderr ?? '');
      rec.err = `port render error: ${(m?.[1] ?? (port.stderr ?? '')).slice(0, 200)}`;
    } else {
      try {
        const cmp = compareXdot(port.stdout, oracle.xdot, tolerance);
        rec.injectedDiffs = cmp.diffs.length;
        rec.verdict = cmp.diffs.length === 0 ? 'drift-exonerated' : 'not-cleared';
        rec.bucket = classifyBucket(cmp.diffs, row.firstDiff);
        delete rec.err;
      } catch (e) {
        rec.err = `comparator threw: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    appendFileSync(OUT, JSON.stringify(rec) + '\n');
    if (n % 25 === 0) console.error(`[${engine}] ${n}/${diverged.length}`);
  }

  const results = dedupeRows(readFileSync(OUT, 'utf8'));
  const summary: AttributionReport = {
    generatedAt: new Date().toISOString(),
    oracleSha1: currentSha1,
    tolerance,
    results,
  };
  writeFileSync(SUMMARY, JSON.stringify(summary, null, 2) + '\n');

  const counts = { 'drift-exonerated': 0, 'not-cleared': 0, 'harness-error': 0 };
  for (const r of results) counts[r.verdict]++;
  console.log(
    `[${engine}] done: ${diverged.length} diverged ids -> ${results.length} attributed ` +
    `(${counts['drift-exonerated']} drift-exonerated, ${counts['not-cleared']} not-cleared, ` +
    `${counts['harness-error']} harness-error) -> ${SUMMARY}`,
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
