// SPDX-License-Identifier: EPL-2.0
//
// json parity dashboard (mission: json-conformance).
//
// Reads json-parity.json (written by json-walk.ts --survey) and writes
// PARITY-JSON.md: a front-loaded summary, the conformant roster, a worst-first
// diverged table, triage buckets keyed by (object-kind × attr × diff-shape),
// the accepted-divergence roster, and port/oracle/timeout fault tables.
// Mirrors test/corpus/xdot-dashboard.ts structure exactly, adapted to the
// json comparator's diff-path shape (test/golden/compare-json.ts). A report +
// permanent regression gate, not a fixer. Node-only dev/test infra.

import { readFileSync, writeFileSync } from 'node:fs';
import type { JsonVerdict, JsonWalkResult } from './json-walk.js';

const JSON_PARITY = new URL('./json-parity.json', import.meta.url);
const ACCEPTED = new URL('./accepted-divergences-json.json', import.meta.url);
const OUT = new URL('./PARITY-JSON.md', import.meta.url);
const TABLE_CAP = 60;

interface JsonParityReport {
  oracleVersion: string;
  corpusRoot: string;
  total: number;
  counts: Record<JsonVerdict, number>;
  results: JsonWalkResult[];
}

interface AcceptedEntry {
  id: string;
  opClass?: string;
  delta?: number;
  rationale?: string;
}

interface Bucket {
  key: string;
  hypothesis: string;
  ids: string[];
}

/** Escape a markdown table cell (pipes + newlines). */
function cell(s: string | undefined): string {
  return (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Escape a free-text cell: pipes, newlines, and raw `<`/`>` (VitePress-safe). */
function escText(s: string | undefined): string {
  return cell(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${((100 * n) / d).toFixed(1)}%`;
}

/** Object-kind axis from a diff path: graph, cluster, node, edge, or parse. */
function objectKind(path: string): string {
  if (path.startsWith('[graph]')) return 'graph';
  if (path.startsWith('cluster:')) return 'cluster';
  if (path.startsWith('node:')) return 'node';
  if (path.startsWith('edge:')) return 'edge';
  if (path.startsWith('[parse]')) return 'parse';
  return 'other';
}

/** The attribute a path names — the segment right after the object key. */
function attrOf(path: string): string {
  if (path.includes('[missing-object]')) return '<object>';
  const slashIdx = path.indexOf('/');
  if (slashIdx === -1) return '?';
  const rest = path.slice(slashIdx + 1);
  const bracket = rest.indexOf('[');
  const slash = rest.indexOf('/');
  let end = rest.length;
  if (bracket !== -1) end = Math.min(end, bracket);
  if (slash !== -1) end = Math.min(end, slash);
  const attr = rest.slice(0, end);
  return attr.length > 0 ? attr : '?';
}

/** Diff-shape axis: what kind of mismatch the path encodes. */
function diffShape(path: string): string {
  if (path.includes('[missing-object]')) return 'missing-object';
  if (path.includes('[missing]')) return 'missing-attr';
  if (path.includes('[opCount]')) return 'op-count';
  if (path.includes('[ptCount]')) return 'point-count';
  if (path.includes('[count]')) return 'value-count';
  if (path.endsWith('[parse]')) return 'parse-fail';
  if (path.endsWith('.kind')) return 'op-kind';
  if (path.endsWith('.color')) return 'color';
  if (path.endsWith('.face')) return 'font';
  if (path.endsWith('.text')) return 'text';
  if (path.endsWith('.align')) return 'align';
  if (path.endsWith('.style')) return 'style';
  if (path.endsWith('.grad') || path.endsWith('.stops')) return 'gradient';
  if (path === '_subgraph_cnt' || path.endsWith('/_subgraph_cnt')) return 'subgraph-count';
  if (path.endsWith('/directed') || path.endsWith('/strict')) return 'graph-kind';
  return 'numeric-or-scalar';
}

/** One-line hypothesis per diff shape. */
const SHAPE_HINTS: Record<string, string> = {
  'missing-object': 'the port omits this object entirely (e.g. subgraph, node)',
  'missing-attr': 'an attribute is present on one side only (graph attrs, xdotversion, ...)',
  'op-count': 'the draw-op array has a different length (port emits `_draw_: []` unconditionally)',
  'point-count': 'a polygon/bezier/polyline op has a different vertex count',
  'value-count': 'a positional string (pos/bb/...) has a different embedded-number count',
  'parse-fail': 'a draw attr value is not a JSON array or JSON.parse failed entirely',
  'op-kind': 'the op-letter sequence diverges (wrong opcode at an index)',
  color: 'a resolved pen/fill color differs (graphics-state color)',
  font: 'a font face differs (family canonicalization)',
  text: 'rendered label text differs (content/escaping/encoding)',
  align: 'text alignment flag differs',
  style: 'a style op (dashed/bold/…) differs',
  gradient: 'a gradient type/stop list differs',
  'subgraph-count': '`_subgraph_cnt` differs — port has no subgraph/cluster support in json output',
  'graph-kind': '`directed`/`strict` differs (should not happen — investigate)',
  'numeric-or-scalar': 'a coordinate/size/generic scalar attr differs beyond tolerance or exactly',
};

/** Bucket a diverged result by (object-kind · attr · shape). */
function divergedBucket(r: JsonWalkResult): { key: string; hypothesis: string } {
  const p = r.firstDiff ?? '';
  const kind = objectKind(p);
  const shape = diffShape(p);
  return { key: `${kind} · ${attrOf(p)} · ${shape}`, hypothesis: SHAPE_HINTS[shape] ?? 'inspect the path' };
}

function bucketize(results: JsonWalkResult[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of results) {
    const { key, hypothesis } = divergedBucket(r);
    const b = map.get(key) ?? { key, hypothesis, ids: [] };
    b.ids.push(r.id);
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.ids.length - a.ids.length);
}

function bucketTable(buckets: Bucket[]): string {
  if (buckets.length === 0) return '_(none)_\n';
  const rows = buckets.map(
    (b) => `| \`${b.key}\` | ${b.ids.length} | ${b.ids.slice(0, 3).map((i) => `\`${i}\``).join(', ')} | ${escText(b.hypothesis)} |`,
  );
  return ['| bucket | count | examples | hypothesis |', '|---|---:|---|---|', ...rows, ''].join('\n');
}

function divergedTable(diverged: JsonWalkResult[]): string {
  const sorted = [...diverged].sort((a, b) => (b.maxDelta ?? 0) - (a.maxDelta ?? 0) || (b.diffCount ?? 0) - (a.diffCount ?? 0));
  const shown = sorted.slice(0, TABLE_CAP);
  const rows = shown.map(
    (r) => `| \`${r.id}\` | ${r.size} | ${(r.maxDelta ?? 0).toFixed(2)} | ${r.diffCount ?? 0} | \`${cell(r.firstDiff)}\` |`,
  );
  const more = sorted.length > shown.length
    ? `\n_… and ${sorted.length - shown.length} more (full set in json-parity.json)._\n`
    : '';
  return ['| id | size | maxΔ | #diffs | firstDiff |', '|---|---:|---:|---:|---|', ...rows, ''].join('\n') + more;
}

function msgTable(results: JsonWalkResult[]): string {
  const rows = results
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `| \`${r.id}\` | \`${r.path}\` | ${escText(r.errMsg)} |`);
  return ['| id | path | message |', '|---|---|---|', ...rows, ''].join('\n');
}

function acceptedTable(entries: AcceptedEntry[]): string {
  if (entries.length === 0) return '_(none)_\n';
  const rows = entries.map(
    (e) => `| \`${e.id}\` | ${escText(e.opClass)} | ${e.delta ?? ''} | ${escText(e.rationale)} |`,
  );
  return ['| id | opClass | delta | rationale |', '|---|---|---:|---|', ...rows, ''].join('\n');
}

function buildMarkdown(report: JsonParityReport, accepted: AcceptedEntry[]): string {
  const byVerdict = (v: JsonVerdict): JsonWalkResult[] => report.results.filter((r) => r.verdict === v);
  const c: Record<JsonVerdict, number> = Object.assign(
    { conformant: 0, diverged: 0, accepted: 0, 'port-error': 0, 'oracle-error': 0, timeout: 0 },
    report.counts,
  );
  const conformantIds = byVerdict('conformant').map((r) => r.id);
  const diverged = byVerdict('diverged');
  const acceptedResults = byVerdict('accepted');

  const parts: string[] = [
    '<!-- SPDX-License-Identifier: EPL-2.0 -->',
    '<!-- GENERATED by test/corpus/json-dashboard.ts from json-parity.json — do not edit by hand. -->',
    '',
    '# json parity dashboard',
    '',
    'Differential survey of graphviz-ts `render(g, \'json\')` vs the native',
    '`dot -Tjson` oracle over the SVG-conformant corpus set, sorted by input',
    'size. `-Tjson` (not `-Tjson0`) is the oracle: the port structurally emits',
    'the `doXDot=true` shape (`"_draw_": []` present on every node/edge — see',
    'the AD note atop `test/golden/compare-json.ts`). Semantic comparison',
    '(draw-op arrays at ±0.01, colors/fonts canonicalized, positional strings',
    'numeric-tolerant — see `test/golden/compare-json.ts`). Regenerate:',
    '`npx tsx test/corpus/json-walk.ts --survey && npx tsx test/corpus/json-dashboard.ts`.',
    '',
    '## Summary',
    '',
    `- **Oracle:** ${report.oracleVersion} (\`-Tjson\`) · **corpus:** \`${report.corpusRoot}\``,
    `- **Walked (conformant SVG set):** ${report.total}`,
    `- **json-conformant:** ${c.conformant} (${pct(c.conformant, report.total)})`,
    `- **diverged (tracked, will-fix):** ${c.diverged} · ` +
      `**accepted (documented, won't-fix):** ${c.accepted}`,
    `- **port-error:** ${c['port-error']} · **timeout:** ${c.timeout} · ` +
      `**oracle-error:** ${c['oracle-error']} (excluded from scoring)`,
    '',
    `## json-conformant (${conformantIds.length})`,
    '',
    'Port json is *conformant* with the oracle: every object/attr/draw-op',
    'matches, numeric payloads within ±0.01 and canonicalized',
    'colors/fonts/text equal.',
    '',
    `_Conformant ids (${conformantIds.length}) are omitted for brevity — the full roster is in`,
    '[json-parity.json](json-parity.json)._',
    '',
    `## Tracked diverged (${diverged.length}) — worst-first`,
    '',
    divergedTable(diverged),
    '### Diverged buckets — by (object · attr · shape)',
    '',
    bucketTable(bucketize(diverged)),
    `## Accepted divergences (${acceptedResults.length}) — documented, not chased`,
    '',
    'Irreducible C quirks (font-metric ULP, platform libm) recorded in',
    '`test/corpus/accepted-divergences-json.json`. Each is referenced in the',
    'mission decision journal with its mechanism.',
    '',
    acceptedTable(accepted),
    `## port-error (${c['port-error']})`,
    '',
    msgTable(byVerdict('port-error')),
    `## timeout (${c.timeout})`,
    '',
    msgTable(byVerdict('timeout')),
    `## oracle-error (${c['oracle-error']}) — excluded from scoring`,
    '',
    msgTable(byVerdict('oracle-error')),
  ];
  return parts.join('\n') + '\n';
}

function loadAccepted(): AcceptedEntry[] {
  try {
    const raw = JSON.parse(readFileSync(ACCEPTED, 'utf8')) as { divergences?: AcceptedEntry[] };
    return raw.divergences ?? [];
  } catch {
    return [];
  }
}

const report = JSON.parse(readFileSync(JSON_PARITY, 'utf8')) as JsonParityReport;
writeFileSync(OUT, buildMarkdown(report, loadAccepted()));
process.stderr.write(`wrote PARITY-JSON.md (${report.total} walked)\n`);
