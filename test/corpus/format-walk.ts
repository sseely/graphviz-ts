// SPDX-License-Identifier: EPL-2.0
//
// Cross-engine SVG / JSON smoke walk.
//
// The corpus sweep (engine-walk.ts) compares XDOT geometry across all 7 engines,
// and survey.ts / json-walk.ts compare SVG / JSON but for the dot engine only.
// This walker closes the gap the campaign never covered: does the port emit
// VALID, structurally-correct SVG and JSON for every engine? SVG and JSON each
// have their own emit/serialize path, distinct from xdot, so xdot conformance
// does not by itself prove the formats a consumer actually renders are sound.
//
// The verdict is deliberately POSITION-AGNOSTIC (xdot already gates geometry at
// 0.01, and iterative engines drift positionally so a positional SVG diff would
// drown in false positives). Per item:
//   ok          — port renders, output is well-formed, and its element counts
//                 (graph/cluster/node/edge) match the native oracle's.
//   struct-diff — port well-formed but element counts differ from the oracle.
//   malformed   — port output is not parseable as the format.
//   port-error  — port exited nonzero / empty.
//   oracle-error— oracle failed (item skipped from the pass/total ratio).
//   timeout     — port exceeded the wall-clock budget.
//
//   tsx test/corpus/format-walk.ts <svg|json> [engine|all] [limit] [--full]
//
// `limit` samples that many items per engine spanning the size range (default
// 60); `--full` walks the whole pass roster. Node-only dev/test infra.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const ROOT = process.env.CORPUS_ROOT ?? join(homedir(), 'git/graphviz/tests');
const DOT_BIN = process.env.DOT_BIN ?? join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const GVBINDIR = process.env.GVBINDIR ?? '/tmp/ghl';
const BUDGET_MS = Number(process.env.FORMAT_WALK_BUDGET_MS ?? 60_000);

const ALL_ENGINES = ['dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi', 'osage', 'patchwork'] as const;
type Engine = (typeof ALL_ENGINES)[number];

type Verdict = 'ok' | 'struct-diff' | 'malformed' | 'port-error' | 'oracle-error' | 'timeout';

interface Args { format: 'svg' | 'json'; engines: Engine[]; limit: number; full: boolean; }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const full = a.includes('--full');
  const pos = a.filter((x) => !x.startsWith('--'));
  const format = pos[0] === 'json' ? 'json' : 'svg';
  const eng = pos[1] && pos[1] !== 'all' ? [pos[1] as Engine] : [...ALL_ENGINES];
  const limit = pos[2] ? parseInt(pos[2], 10) : 60;
  return { format, engines: eng, limit, full };
}

/** id -> corpus-relative path, from the shared corpus manifest. */
function loadPaths(): Map<string, string> {
  const m = JSON.parse(readFileSync(join(REPO, 'test/corpus/corpus-manifest.json'), 'utf8'));
  const rows = Array.isArray(m) ? m : (m.entries ?? m.items ?? []);
  return new Map(rows.map((r: { id: string; path: string }) => [r.id, r.path]));
}

/** The engine's committed pass roster (ids the port already lays out correctly). */
function roster(engine: Engine): { id: string; size: number }[] {
  const file = engine === 'dot' ? 'parity.json' : `parity-${engine}.json`;
  const j = JSON.parse(readFileSync(join(REPO, 'test/corpus', file), 'utf8'));
  const rows = Array.isArray(j) ? j : j.results;
  const good = (r: { status?: string; verdict?: string }) =>
    engine === 'dot' ? r.verdict === 'conformant' : r.status === 'pass';
  return rows.filter(good).map((r: { id: string; size: number }) => ({ id: r.id, size: r.size }));
}

/** Sample `n` items spanning the size range (not just the smallest). */
function sample<T>(items: T[], n: number, full: boolean): T[] {
  if (full || items.length <= n) return items;
  const step = items.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.floor(i * step)]!);
  return out;
}

function spawnCapture(
  cmd: string, args: string[], env: NodeJS.ProcessEnv, budgetMs: number,
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, detached: true });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* gone */ } }, budgetMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, code, timedOut }); });
    child.on('error', () => { clearTimeout(timer); resolve({ stdout, stderr, code: -1, timedOut }); });
  });
}

/** Element inventory that both graphviz SVG and graphviz JSON expose, counted
 *  from each format's own structure so port vs oracle is an apples-to-apples
 *  comparison. Returns null if the text is not well-formed for the format. */
function svgCounts(svg: string): Record<string, number> | null {
  if (!svg.includes('</svg>')) return null;
  const c = (cls: string) => (svg.match(new RegExp(`class="${cls}"`, 'g')) ?? []).length;
  return { graph: c('graph'), cluster: c('cluster'), node: c('node'), edge: c('edge') };
}

function jsonCounts(text: string): Record<string, number> | null {
  let j: { objects?: unknown[]; edges?: unknown[] };
  try { j = JSON.parse(text); } catch { return null; }
  if (typeof j !== 'object' || j === null) return null;
  // `objects`/`edges` are absent for an empty graph (`digraph {}`) — a valid
  // render, not malformed — so treat missing arrays as empty rather than null.
  const objs = (Array.isArray(j.objects) ? j.objects : []) as { nodes?: unknown }[];
  const clusters = objs.filter((o) => Array.isArray(o.nodes)).length;
  return { objects: objs.length, clusters, edges: Array.isArray(j.edges) ? j.edges.length : 0 };
}

function countsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}

async function walkItem(
  engine: Engine, format: 'svg' | 'json', path: string,
): Promise<Verdict> {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) return 'oracle-error';
  const oracle = await spawnCapture(
    DOT_BIN, [`-K${engine}`, `-T${format}`, abs], { ...process.env, GVBINDIR }, BUDGET_MS,
  );
  const oCounts = format === 'svg' ? svgCounts(oracle.stdout) : jsonCounts(oracle.stdout);
  if (oracle.timedOut || !oCounts) return 'oracle-error';

  const worker = format === 'svg' ? 'render-one.ts' : 'render-one-json.ts';
  const port = await spawnCapture(
    'npx', ['tsx', join(REPO, 'test/corpus', worker), abs, engine], process.env, BUDGET_MS,
  );
  if (port.timedOut) return 'timeout';
  if (port.code !== 0 || port.stdout.length === 0) return 'port-error';
  const pCounts = format === 'svg' ? svgCounts(port.stdout) : jsonCounts(port.stdout);
  if (!pCounts) return 'malformed';
  return countsEqual(pCounts, oCounts) ? 'ok' : 'struct-diff';
}

async function main(): Promise<void> {
  const { format, engines, limit, full } = parseArgs();
  const paths = loadPaths();
  process.stderr.write(
    `format-walk ${format.toUpperCase()} — ${full ? 'FULL' : `sample=${limit}`} — engines: ${engines.join(', ')}\n`,
  );
  const grand: Record<Verdict, number> = { ok: 0, 'struct-diff': 0, malformed: 0, 'port-error': 0, 'oracle-error': 0, timeout: 0 };
  for (const engine of engines) {
    const items = sample(roster(engine).sort((a, b) => a.size - b.size), limit, full);
    const tally: Record<Verdict, number> = { ok: 0, 'struct-diff': 0, malformed: 0, 'port-error': 0, 'oracle-error': 0, timeout: 0 };
    const bad: string[] = [];
    for (const it of items) {
      const path = paths.get(it.id);
      if (!path) { tally['oracle-error']++; continue; }
      const v = await walkItem(engine, format, path);
      tally[v]++; grand[v]++;
      if (v !== 'ok' && v !== 'oracle-error' && bad.length < 6) bad.push(`${it.id}:${v}`);
    }
    const denom = items.length - tally['oracle-error'];
    process.stderr.write(
      `  ${engine.padEnd(10)} ok ${String(tally.ok).padStart(3)}/${String(denom).padStart(3)}` +
      `  struct-diff=${tally['struct-diff']} malformed=${tally.malformed}` +
      ` port-err=${tally['port-error']} timeout=${tally.timeout} (oracle-skip=${tally['oracle-error']})` +
      (bad.length ? `  e.g. ${bad.join(' ')}` : '') + '\n',
    );
  }
  process.stderr.write(`  TOTAL ${JSON.stringify(grand)}\n`);
  process.exit(grand['struct-diff'] + grand.malformed + grand['port-error'] > 0 ? 1 : 0);
}

void main();
