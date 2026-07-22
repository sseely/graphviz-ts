// SPDX-License-Identifier: EPL-2.0
//
// xdot parity dashboard (mission: xdot-conformance, T4).
//
// Reads xdot-parity.json (written by xdot-walk.ts --survey, T3) and writes
// PARITY-XDOT.md: a front-loaded summary, the conformant roster, a worst-first
// diverged table, triage buckets keyed by (object-kind × draw-attr × diff-shape),
// the accepted-divergence roster, and port/oracle/timeout fault tables. A report
// + permanent regression gate (AD-6), not a fixer. Node-only dev/test infra.

import { readFileSync, writeFileSync } from 'node:fs';
import type { XdotVerdict, XdotWalkResult } from './xdot-walk.js';
import { testIdLink, scrubLocalPaths } from './corpus-links.js';

const XDOT_PARITY = new URL('./xdot-parity.json', import.meta.url);
const ACCEPTED = new URL('./accepted-divergences-xdot.json', import.meta.url);
const OUT = new URL('./PARITY-XDOT.md', import.meta.url);
const TABLE_CAP = 60;

interface XdotParityReport {
  oracleVersion: string;
  corpusRoot: string;
  total: number;
  counts: Record<XdotVerdict, number>;
  results: XdotWalkResult[];
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

/** Object-kind axis from a diff/object path: graph, cluster, node, or edge. */
function objectKind(path: string): string {
  if (path.startsWith('[graph]')) return 'graph';
  if (path.startsWith('cluster:')) return 'cluster';
  if (path.startsWith('node:')) return 'node';
  if (path.startsWith('edge:')) return 'edge';
  if (path.startsWith('[parse]')) return 'parse';
  return 'other';
}

/** Draw/positional attribute mentioned in a path (`_draw_`, `pos`, ...). */
function attrOf(path: string): string {
  const m = path.match(/\/(_[a-z]*draw_|pos|bb|width|height)\b/);
  if (m) return m[1];
  if (path.includes('[missing-object]')) return '<object>';
  return '?';
}

/** Diff-shape axis: what kind of mismatch the path encodes. */
function diffShape(path: string): string {
  if (path.includes('[missing-object]')) return 'missing-object';
  if (path.includes('[missing]')) return 'missing-attr';
  if (path.includes('[opCount]')) return 'op-count';
  if (path.includes('[ptCount]')) return 'point-count';
  if (path.includes('[count]')) return 'pos-count';
  if (path.endsWith('.kind')) return 'op-kind';
  if (path.endsWith('.color')) return 'color';
  if (path.endsWith('.face')) return 'font';
  if (path.endsWith('.text')) return 'text';
  if (path.endsWith('.align')) return 'align';
  if (path.endsWith('.style')) return 'style';
  return 'numeric';
}

/** One-line hypothesis per diff shape. */
const SHAPE_HINTS: Record<string, string> = {
  'missing-object': 'the port omits this object entirely (e.g. graph background, cluster box)',
  'missing-attr': 'a draw class is present on one side only (label/arrow/edge routing not emitted)',
  'op-count': 'the op stream has a different length — extra/missing draw op',
  'point-count': 'a polygon/bezier/polyline has a different vertex count',
  'pos-count': 'pos/bb token count differs — spline point count or endpoint markers',
  'op-kind': 'the op sequence diverges (wrong opcode at an index)',
  color: 'a resolved pen/fill color differs (graphics-state color)',
  font: 'a font face differs (family canonicalization — Times,serif vs Times-Roman)',
  text: 'rendered label text differs (content/escaping/encoding)',
  align: 'text alignment flag differs',
  style: 'a style op (dashed/bold/…) differs',
  numeric: 'a coordinate/size differs beyond tolerance (geometry emission)',
};

/** Bucket a diverged result by (object-kind · attr · shape). */
function divergedBucket(r: XdotWalkResult): { key: string; hypothesis: string } {
  const p = r.firstDiff ?? '';
  const kind = objectKind(p);
  const shape = diffShape(p);
  return { key: `${kind} · ${attrOf(p)} · ${shape}`, hypothesis: SHAPE_HINTS[shape] ?? 'inspect the path' };
}

function bucketize(results: XdotWalkResult[]): Bucket[] {
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

function divergedTable(diverged: XdotWalkResult[]): string {
  const sorted = [...diverged].sort((a, b) => (b.maxDelta ?? 0) - (a.maxDelta ?? 0) || (b.diffCount ?? 0) - (a.diffCount ?? 0));
  const shown = sorted.slice(0, TABLE_CAP);
  const rows = shown.map(
    (r) => `| ${testIdLink(r.id, r.path)} | ${r.size} | ${(r.maxDelta ?? 0).toFixed(2)} | ${r.diffCount ?? 0} | \`${cell(r.firstDiff)}\` |`,
  );
  const more = sorted.length > shown.length
    ? `\n_… and ${sorted.length - shown.length} more (full set in xdot-parity.json)._\n`
    : '';
  return ['| id | size | maxΔ | #diffs | firstDiff |', '|---|---:|---:|---:|---|', ...rows, ''].join('\n') + more;
}

function msgTable(results: XdotWalkResult[]): string {
  const rows = results
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `| ${testIdLink(r.id, r.path)} | \`${r.path}\` | ${escText(scrubLocalPaths(r.errMsg ?? ''))} |`);
  return ['| id | path | message |', '|---|---|---|', ...rows, ''].join('\n');
}

function acceptedTable(entries: AcceptedEntry[]): string {
  if (entries.length === 0) return '_(none)_\n';
  const rows = entries.map(
    (e) => `| ${testIdLink(e.id)} | ${escText(e.opClass)} | ${e.delta ?? ''} | ${escText(e.rationale)} |`,
  );
  return ['| id | opClass | delta | rationale |', '|---|---|---:|---|', ...rows, ''].join('\n');
}

function buildMarkdown(report: XdotParityReport, accepted: AcceptedEntry[]): string {
  const byVerdict = (v: XdotVerdict): XdotWalkResult[] => report.results.filter((r) => r.verdict === v);
  const c: Record<XdotVerdict, number> = Object.assign(
    { conformant: 0, diverged: 0, accepted: 0, 'port-error': 0, 'oracle-error': 0, timeout: 0 },
    report.counts,
  );
  const conformantIds = byVerdict('conformant').map((r) => r.id);
  const diverged = byVerdict('diverged');
  const acceptedResults = byVerdict('accepted');

  const parts: string[] = [
    '<!-- SPDX-License-Identifier: EPL-2.0 -->',
    '<!-- GENERATED by test/corpus/xdot-dashboard.ts from xdot-parity.json — do not edit by hand. -->',
    '',
    '# xdot parity dashboard',
    '',
    'Differential survey of graphviz-ts `render(g, \'xdot\')` vs the native',
    '`dot -Txdot` oracle over the **759 SVG-conformant** corpus items, sorted by',
    'input size. Semantic comparison (draw-op streams at ±0.01, colors/fonts',
    'canonicalized — see `test/golden/compare-xdot.ts`). Regenerate:',
    '`npx tsx test/corpus/xdot-walk.ts --survey && npx tsx test/corpus/xdot-dashboard.ts`.',
    '',
    '## Summary',
    '',
    `- **Oracle:** ${report.oracleVersion} · **corpus:** \`${report.corpusRoot}\``,
    `- **Walked (conformant SVG set):** ${report.total}`,
    `- **xdot-conformant:** ${c.conformant} (${pct(c.conformant, report.total)})`,
    `- **diverged (tracked, will-fix):** ${c.diverged} · ` +
      `**accepted (documented, won't-fix):** ${c.accepted}`,
    `- **port-error:** ${c['port-error']} · **timeout:** ${c.timeout} · ` +
      `**oracle-error:** ${c['oracle-error']} (excluded from scoring)`,
    '',
    `## xdot-conformant (${conformantIds.length})`,
    '',
    'Port xdot is *conformant* with the oracle: every draw-op stream matches',
    'op-for-op with numeric payloads within ±0.01 and canonicalized',
    'colors/fonts/text equal.',
    '',
    `_Conformant ids (${conformantIds.length}) are omitted for brevity — the full roster is in`,
    '[xdot-parity.json](xdot-parity.json)._',
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
    '`test/corpus/accepted-divergences-xdot.json`. Each is referenced in the',
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

const report = JSON.parse(readFileSync(XDOT_PARITY, 'utf8')) as XdotParityReport;
writeFileSync(OUT, buildMarkdown(report, loadAccepted()));
process.stderr.write(`wrote PARITY-XDOT.md (${report.total} walked)\n`);
