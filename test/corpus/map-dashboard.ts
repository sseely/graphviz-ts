// SPDX-License-Identifier: EPL-2.0
//
// Imagemap parity dashboard (mission: map-conformance, T4 twin of
// xdot-dashboard.ts).
//
// Reads map-parity.json (written by map-walk.ts --survey, T3) and writes
// PARITY-MAP.md: a front-loaded summary (overall + per-format), the
// conformant roster, a dedicated href-bearing-ids table (the substantive
// coverage — see map-walk.ts's `hasHref` doc), a worst-first diverged table
// per format, triage buckets keyed by (format × diff-shape), the
// accepted-divergence roster, and port/oracle/timeout fault tables. A report
// + permanent regression gate, not a fixer. Node-only dev/test infra.

import { readFileSync, writeFileSync } from 'node:fs';
import type { MapVerdict, MapWalkResult, MapFormatResult } from './map-walk.js';
import { testIdLink, scrubLocalPaths } from './corpus-links.js';

const MAP_PARITY = new URL('./map-parity.json', import.meta.url);
const ACCEPTED = new URL('./accepted-divergences-map.json', import.meta.url);
const OUT = new URL('./PARITY-MAP.md', import.meta.url);
const TABLE_CAP = 60;

interface MapParityReport {
  oracleVersion: string;
  corpusRoot: string;
  total: number;
  counts: Record<MapVerdict, number>;
  results: MapWalkResult[];
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

type MapFormat = 'cmapx' | 'imap';

/** One (id, format) diverged row — a single id can appear once per format. */
interface DivergedRow {
  id: string;
  path: string;
  size: number;
  format: MapFormat;
  maxDelta: number;
  diffCount: number;
  firstDiff?: string;
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

/** Diff-shape axis: what kind of mismatch a comparator path encodes. */
function diffShape(path: string): string {
  if (path.endsWith('[count]')) return 'element/line-count';
  if (path === 'map/area[count]' || path === 'imap/line[count]') return 'element/line-count';
  if (/\.coords\[count\]$/.test(path)) return 'coord-count';
  if (/\.coords\[\d+\]$/.test(path)) return 'coord-numeric';
  if (path.endsWith('[opCount]') || /\[\d+\]$/.test(path)) return 'coord-numeric';
  if (path.endsWith('.href')) return 'href';
  if (path.endsWith('.shape')) return 'shape';
  if (path.endsWith('.title')) return 'title';
  if (path.endsWith('.alt')) return 'alt';
  if (path.endsWith('.target')) return 'target';
  if (path.endsWith('.url')) return 'url';
  if (path.endsWith('.keyword')) return 'line-keyword';
  if (path.endsWith('.token')) return 'base-token';
  if (path.startsWith('map/@')) return 'map-identity';
  if (path.startsWith('[parse]')) return 'parse-fail';
  return 'other';
}

/** One-line hypothesis per diff shape. */
const SHAPE_HINTS: Record<string, string> = {
  'element/line-count': 'a different number of areas/lines were emitted — extra/missing anchor',
  'coord-count': 'a poly area has a different vertex count',
  'coord-numeric': 'a coordinate differs beyond the exact-after-round rule (rounding-tie or geometry)',
  href: 'the emitted href differs (missing/wrong URL, or href vs. no-href)',
  shape: 'the emitted shape (rect/circle/poly) differs',
  title: 'the emitted tooltip/title differs',
  alt: 'the emitted alt text differs (should always be empty on both sides)',
  target: 'the emitted target differs',
  url: 'the imap line url token differs',
  'line-keyword': 'the imap line keyword (rect/circle/poly/default) differs',
  'base-token': 'the imap `base referer` line differs',
  'map-identity': 'the `<map id/name>` differs (graph-name mismatch)',
  'parse-fail': 'one side did not parse as valid XML',
  other: 'inspect the path',
};

/** Bucket a diverged row by (format · shape). */
function divergedBucket(r: DivergedRow): { key: string; hypothesis: string } {
  const shape = diffShape(r.firstDiff ?? '');
  return { key: `${r.format} · ${shape}`, hypothesis: SHAPE_HINTS[shape] ?? 'inspect the path' };
}

function bucketize(rows: DivergedRow[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
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

/** Flatten per-item per-format results into diverged rows (excludes accepted). */
function divergedRows(results: MapWalkResult[]): DivergedRow[] {
  const rows: DivergedRow[] = [];
  const push = (r: MapWalkResult, format: MapFormat, f: MapFormatResult): void => {
    if (f.verdict !== 'diverged') return;
    rows.push({
      id: r.id,
      path: r.path,
      size: r.size,
      format,
      maxDelta: f.maxDelta ?? 0,
      diffCount: f.diffCount ?? 0,
      firstDiff: f.firstDiff,
    });
  };
  for (const r of results) {
    push(r, 'cmapx', r.cmapx);
    push(r, 'imap', r.imap);
  }
  return rows;
}

function acceptedRows(results: MapWalkResult[]): DivergedRow[] {
  const rows: DivergedRow[] = [];
  const push = (r: MapWalkResult, format: MapFormat, f: MapFormatResult): void => {
    if (f.verdict !== 'accepted') return;
    rows.push({
      id: r.id,
      path: r.path,
      size: r.size,
      format,
      maxDelta: f.maxDelta ?? 0,
      diffCount: f.diffCount ?? 0,
      firstDiff: f.firstDiff,
    });
  };
  for (const r of results) {
    push(r, 'cmapx', r.cmapx);
    push(r, 'imap', r.imap);
  }
  return rows;
}

function divergedTable(rows: DivergedRow[]): string {
  const sorted = [...rows].sort((a, b) => b.maxDelta - a.maxDelta || b.diffCount - a.diffCount);
  const shown = sorted.slice(0, TABLE_CAP);
  const body = shown.map(
    (r) => `| ${testIdLink(r.id, r.path)} | ${r.format} | ${r.size} | ${r.maxDelta.toFixed(2)} | ${r.diffCount} | \`${cell(r.firstDiff)}\` |`,
  );
  const more = sorted.length > shown.length
    ? `\n_… and ${sorted.length - shown.length} more (full set in map-parity.json)._\n`
    : '';
  return ['| id | format | size | maxΔ | #diffs | firstDiff |', '|---|---|---:|---:|---:|---|', ...body, ''].join('\n') + more;
}

function msgTable(results: MapWalkResult[]): string {
  const rows = results
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (r) =>
        `| ${testIdLink(r.id, r.path)} | \`${r.path}\` | ` +
        `${escText(scrubLocalPaths(r.cmapx.errMsg ?? r.imap.errMsg ?? ''))} |`,
    );
  return ['| id | path | message |', '|---|---|---|', ...rows, ''].join('\n');
}

function acceptedTable(entries: AcceptedEntry[]): string {
  if (entries.length === 0) return '_(none)_\n';
  const rows = entries.map(
    (e) => `| ${testIdLink(e.id)} | ${escText(e.opClass)} | ${e.delta ?? ''} | ${escText(e.rationale)} |`,
  );
  return ['| id | opClass | delta | rationale |', '|---|---|---:|---|', ...rows, ''].join('\n');
}

/** Dedicated table for the href-bearing subset — the substantive coverage
 * (see map-walk.ts's `hasHref` doc). Every id, verdict spelled out. */
function hrefTable(results: MapWalkResult[]): string {
  const hrefResults = results.filter((r) => r.hasHref).sort((a, b) => a.id.localeCompare(b.id));
  if (hrefResults.length === 0) return '_(none in the surveyed set)_\n';
  const rows = hrefResults.map(
    (r) => `| ${testIdLink(r.id, r.path)} | \`${r.path}\` | ${r.cmapx.verdict} | ${r.imap.verdict} | ${r.verdict} |`,
  );
  return ['| id | path | cmapx | imap | overall |', '|---|---|---|---|---|', ...rows, ''].join('\n');
}

function buildMarkdown(report: MapParityReport, accepted: AcceptedEntry[]): string {
  const byVerdict = (v: MapVerdict): MapWalkResult[] => report.results.filter((r) => r.verdict === v);
  const c: Record<MapVerdict, number> = Object.assign(
    { conformant: 0, diverged: 0, accepted: 0, 'port-error': 0, 'oracle-error': 0, timeout: 0 },
    report.counts,
  );
  const conformantIds = byVerdict('conformant').map((r) => r.id);
  const diverged = divergedRows(report.results);
  const acceptedD = acceptedRows(report.results);
  const hrefResults = report.results.filter((r) => r.hasHref);

  const cmapxConformant = report.results.filter((r) => r.cmapx.verdict === 'conformant').length;
  const imapConformant = report.results.filter((r) => r.imap.verdict === 'conformant').length;

  const parts: string[] = [
    '<!-- SPDX-License-Identifier: EPL-2.0 -->',
    '<!-- GENERATED by test/corpus/map-dashboard.ts from map-parity.json — do not edit by hand. -->',
    '',
    '# imagemap parity dashboard',
    '',
    'Differential survey of graphviz-ts `render(g, \'cmapx\')` / `render(g, \'imap\')`',
    'vs the native `dot -Tcmapx` / `dot -Timap` oracle over the dot-track',
    'SVG-conformant corpus set, sorted by input size. BOTH formats are rendered',
    'and compared for every id; the overall verdict is the worse of the two',
    '(see `test/golden/compare-map.ts`: shape/href/title/alt/target compared',
    'EXACTLY, coords compared exact-after-round — both sides are already',
    '`%.0f`/`Math.round`-integer text, see the comparator header). Regenerate:',
    '`npx tsx test/corpus/map-walk.ts --survey && npx tsx test/corpus/map-dashboard.ts`.',
    '',
    '## Summary',
    '',
    `- **Oracle:** ${report.oracleVersion} · **corpus:** \`${report.corpusRoot}\``,
    `- **Walked (conformant SVG set):** ${report.total}`,
    `- **map-conformant (overall, worst-of-both-formats):** ${c.conformant} (${pct(c.conformant, report.total)})`,
    `- **cmapx-conformant:** ${cmapxConformant} (${pct(cmapxConformant, report.total)}) · ` +
      `**imap-conformant:** ${imapConformant} (${pct(imapConformant, report.total)})`,
    `- **diverged (tracked, will-fix, either format):** ${c.diverged} · ` +
      `**accepted (documented, won't-fix):** ${c.accepted}`,
    `- **port-error:** ${c['port-error']} · **timeout:** ${c.timeout} · ` +
      `**oracle-error:** ${c['oracle-error']} (excluded from scoring)`,
    `- **href-bearing ids in the surveyed set:** ${hrefResults.length} — the substantive`,
    '  coverage (ids whose ORACLE output actually emits ≥1 real href, not an',
    '  empty or tooltip-only map); see the dedicated table below.',
    '',
    `## href-bearing ids (${hrefResults.length}) — the substantive coverage`,
    '',
    'Every id in the surveyed (conformant-SVG) set whose oracle cmapx/imap',
    'output contains a real `href` — i.e. actually exercises anchor emission,',
    'not just an empty/tooltip-only map. Verdict spelled out per format so a',
    'reader does not have to cross-reference `map-parity.json`.',
    '',
    hrefTable(report.results),
    `## map-conformant (${conformantIds.length})`,
    '',
    'Port output is *conformant* with the oracle in BOTH cmapx and imap: every',
    'area/line matches exactly (shape/href/title/alt/target) with coords equal',
    'after rounding.',
    '',
    `_Conformant ids (${conformantIds.length}) are omitted for brevity — the full roster is in`,
    '[map-parity.json](map-parity.json)._',
    '',
    `## Tracked diverged (${diverged.length} format-rows) — worst-first`,
    '',
    divergedTable(diverged),
    '### Diverged buckets — by (format · shape)',
    '',
    bucketTable(bucketize(diverged)),
    `## Accepted divergences (${acceptedD.length} format-rows) — documented, not chased`,
    '',
    'Irreducible C quirks recorded in `test/corpus/accepted-divergences-map.json`.',
    'Each is referenced in the mission decision journal with its mechanism.',
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

const report = JSON.parse(readFileSync(MAP_PARITY, 'utf8')) as MapParityReport;
writeFileSync(OUT, buildMarkdown(report, loadAccepted()));
process.stderr.write(`wrote PARITY-MAP.md (${report.total} walked)\n`);
