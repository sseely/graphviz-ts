// SPDX-License-Identifier: EPL-2.0
//
// Oracle-error classifier (T3, iterative-parity-campaign batch-1, decision D6).
//
// parity-<engine>.json rows with status 'oracle-error' or 'timeout' are, as
// recorded, ambiguous: some are a genuinely broken oracle invocation (the
// native `dot` binary crashes / errors on that input every time —
// 'native-crash'), others are a transient hang on an otherwise-runnable
// input ('timeout-flake'). D6 resolves the ambiguity by rerunning the oracle
// invocation up to 3x with escalating timeouts (60s/120s/240s): 3/3 failures
// classifies as native-crash (documented, excluded); any success within the
// 3 attempts classifies as timeout-flake (excluded this run, retry later).
//
// The oracle call below is copy-shaped from engine-walk.ts's oracle
// execFileSync invocation (same DOT_BIN/GVBINDIR env, same incomplete-output
// guard) — that call is a plain synchronous child_process.execFileSync of
// the native `dot` binary (no shell, no detached grandchild), which is NOT
// the code path implicated in the 20h-orphan bug documented in
// plans/decision-journal.md's 2026-07-11 entry. That bug was specific to
// engine-walk.ts's *port* render step (spawn() of an `npx tsx` wrapper that
// itself spawns node — killing only the wrapper on timeout left the node
// grandchild running). execFileSync's own `timeout` option sends its
// killSignal (SIGTERM) directly to the single native child process it
// spawns, so no process-group hardening is needed here. Verified post-run
// via `pgrep -f 'build/cmd/dot/dot'` returning no leaked processes.
//
// Usage: npx tsx test/corpus/oracle-error-classifier.ts <engine> [engine...]

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { EngineWalkStatus } from './engine-walk.js';

/** One rerun attempt's raw outcome. */
export interface AttemptOutcome {
  success: boolean;
  /** First line of the error message, truncated. Empty on success. */
  err: string;
}

export type OracleErrorClassification = 'native-crash' | 'timeout-flake';

/** One classified row / one entry of oracle-errors-<engine>.json's `results`. */
export interface OracleErrorRow {
  id: string;
  classification: OracleErrorClassification;
  attempts: number;
  lastErr: string;
}

/** oracle-errors-<engine>.json shape. */
export interface OracleErrorsReport {
  generatedAt: string;
  engine: string;
  results: OracleErrorRow[];
}

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const CORPUS_DEFAULT = join(homedir(), 'git/graphviz/tests');
const DOT_BIN_DEFAULT = join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR_DEFAULT = '/tmp/ghl';

/** D6: escalating timeout budget, one attempt per entry. */
export const RETRY_TIMEOUTS_MS = [60_000, 120_000, 240_000] as const;

/**
 * Pure classification: given the ordered list of rerun attempt outcomes
 * (stopping early is the caller's choice — this just interprets whatever
 * prefix was actually run), decide native-crash vs timeout-flake.
 *
 * D6: any success -> timeout-flake (attempts = count up to and including the
 * success). All failures -> native-crash (attempts = outcomes.length).
 * lastErr is the err of the final outcome considered (the succeeding
 * attempt has err === '', so on a first-attempt flake lastErr is '').
 */
export function classifyAttempts(outcomes: AttemptOutcome[]): {
  classification: OracleErrorClassification;
  attempts: number;
  lastErr: string;
} {
  if (outcomes.length === 0) {
    throw new Error('classifyAttempts requires at least one attempt outcome');
  }
  const successIdx = outcomes.findIndex((o) => o.success);
  if (successIdx !== -1) {
    return {
      classification: 'timeout-flake',
      attempts: successIdx + 1,
      lastErr: outcomes[successIdx]!.err,
    };
  }
  return {
    classification: 'native-crash',
    attempts: outcomes.length,
    lastErr: outcomes[outcomes.length - 1]!.err,
  };
}

/**
 * Format the short sidecar line T2's parity-report.ts calls per-engine.
 * Pure — no file I/O — so it's directly unit-testable; the impure wrapper
 * that reads oracle-errors-<engine>.json is renderOracleErrorsSidecar below.
 */
export function formatOracleErrorsSidecar(nativeCrash: number, timeoutFlake: number): string {
  if (nativeCrash === 0 && timeoutFlake === 0) return '';
  return (
    `**oracle errors:** ${nativeCrash} native-crash (documented, excluded) / ` +
    `${timeoutFlake} timeout-flake (excluded this run, note to retry)`
  );
}

/**
 * T2 report-hook entry point: reads oracle-errors-<engine>.json (if present)
 * and renders the sidecar line. Returns '' if the sidecar file doesn't exist
 * yet or classified 0/0. Standalone exported function per T3 task spec step
 * 3 — T2 wires the call-site into parity-report.ts itself.
 */
export function renderOracleErrorsSidecar(engine: string, repoRoot: string = REPO): string {
  const p = join(repoRoot, 'test/corpus', `oracle-errors-${engine}.json`);
  if (!existsSync(p)) return '';
  const data = JSON.parse(readFileSync(p, 'utf8')) as OracleErrorsReport;
  const nativeCrash = data.results.filter((r) => r.classification === 'native-crash').length;
  const timeoutFlake = data.results.filter((r) => r.classification === 'timeout-flake').length;
  return formatOracleErrorsSidecar(nativeCrash, timeoutFlake);
}

/** One oracle invocation attempt against the native binary. Impure (child process). */
function runOracleAttempt(
  dotBin: string,
  engine: string,
  path: string,
  gvbindir: string,
  timeoutMs: number,
): AttemptOutcome {
  try {
    const oracle = execFileSync(dotBin, ['-K', engine, '-Txdot', path], {
      env: { ...process.env, GVBINDIR: gvbindir },
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 512 * 1024 * 1024,
    });
    if (!oracle.trimEnd().endsWith('}')) throw new Error('incomplete oracle output');
    return { success: true, err: '' };
  } catch (err) {
    return {
      success: false,
      err: String((err as Error).message).split('\n')[0]!.slice(0, 200),
    };
  }
}

/** Rerun one id's oracle invocation up to RETRY_TIMEOUTS_MS.length times, stopping on first success. */
export function classifyId(
  dotBin: string,
  engine: string,
  path: string,
  gvbindir: string,
): { classification: OracleErrorClassification; attempts: number; lastErr: string } {
  const outcomes: AttemptOutcome[] = [];
  for (const timeoutMs of RETRY_TIMEOUTS_MS) {
    const outcome = runOracleAttempt(dotBin, engine, path, gvbindir, timeoutMs);
    outcomes.push(outcome);
    if (outcome.success) break;
  }
  return classifyAttempts(outcomes);
}

// ---------------------------------------------------------------------------
// Imperative shell: CLI entrypoint. Not unit-tested (matches engine-walk.ts's
// convention — this file's pure logic above is the tested surface).
// ---------------------------------------------------------------------------

function main(): void {
  const engines = process.argv.slice(2);
  if (engines.length === 0) {
    console.error('usage: npx tsx test/corpus/oracle-error-classifier.ts <engine> [engine...]');
    process.exit(2);
  }

  const CORPUS = process.env.CORPUS_ROOT ?? CORPUS_DEFAULT;
  const DOT_BIN = process.env.DOT_BIN ?? DOT_BIN_DEFAULT;
  const GVBINDIR = process.env.GVBINDIR ?? GVBINDIR_DEFAULT;

  interface ParityEntry { id: string; path: string; verdict: string }
  const parity = JSON.parse(
    readFileSync(join(REPO, 'test/corpus/parity.json'), 'utf8'),
  ) as { results: ParityEntry[] };
  const pathById = new Map(parity.results.map((r) => [r.id, join(CORPUS, r.path)]));

  for (const engine of engines) {
    const summaryPath = join(REPO, 'test/corpus', `parity-${engine}.json`);
    if (!existsSync(summaryPath)) {
      console.error(`[${engine}] no parity-${engine}.json — skipping`);
      continue;
    }
    interface EngineSummaryRow { id: string; status: EngineWalkStatus; err?: string }
    const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as {
      results: EngineSummaryRow[];
    };
    const toRerun = summary.results.filter(
      (r) => r.status === 'oracle-error' || r.status === 'timeout',
    );

    const results: OracleErrorRow[] = [];
    let n = 0;
    for (const row of toRerun) {
      n++;
      const path = pathById.get(row.id);
      if (!path) {
        console.error(`[${engine}] id ${row.id} not found in parity.json — skipping`);
        continue;
      }
      const { classification, attempts, lastErr } = classifyId(DOT_BIN, engine, path, GVBINDIR);
      results.push({ id: row.id, classification, attempts, lastErr: lastErr || row.err || '' });
      console.error(`[${engine}] ${n}/${toRerun.length} ${row.id} -> ${classification} (${attempts} attempts)`);
    }

    const report: OracleErrorsReport = {
      generatedAt: new Date().toISOString(),
      engine,
      results,
    };
    const outPath = join(REPO, 'test/corpus', `oracle-errors-${engine}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
    const nativeCrash = results.filter((r) => r.classification === 'native-crash').length;
    const timeoutFlake = results.filter((r) => r.classification === 'timeout-flake').length;
    console.log(
      `[${engine}] done: ${results.length} classified (${nativeCrash} native-crash, ` +
        `${timeoutFlake} timeout-flake) -> ${outPath}`,
    );
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
