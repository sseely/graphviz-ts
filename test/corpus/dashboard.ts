// SPDX-License-Identifier: EPL-2.0
//
// Parity dashboard + divergence triage (mission: dot-corpus-harness, T3).
//
// Reads parity.json (T2) + corpus-manifest.json (T1) and writes PARITY.md: a
// front-loaded summary, collapsed match lists, worst-first diverged/errored
// tables, and a TRIAGED divergence backlog — named buckets (count + example
// inputs + a one-line hypothesis) that are the prioritized next-mission list.
//
// Triage = categorize + hypothesize. It does NOT fix any divergence (AD-5).
// Node-only dev/test infra.

import { readFileSync, writeFileSync } from 'node:fs';
import type { SurveyResult, Verdict } from './survey.js';
import type { CorpusEntry, QuarantineReason } from './enumerate.js';

const PARITY = new URL('./parity.json', import.meta.url);
const MANIFEST = new URL('./corpus-manifest.json', import.meta.url);
const OUT = new URL('./PARITY.md', import.meta.url);
const DIVERGED_TABLE_CAP = 60; // full set is in parity.json + the buckets below.

interface ParityReport {
  oracleVersion: string;
  corpusRoot: string;
  total: number;
  counts: Record<Verdict, number>;
  results: SurveyResult[];
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

/** Quarantine totals per reason (from the T1 manifest). */
function quarantineTotals(manifest: CorpusEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of manifest) {
    if (e.status === 'quarantined') {
      const r: QuarantineReason | 'unknown' = e.reason ?? 'unknown';
      out[r] = (out[r] ?? 0) + 1;
    }
  }
  return out;
}

/** Map a diverged result's firstDiffPath shape to a triage bucket + hypothesis. */
function divergedBucket(path: string): { key: string; hypothesis: string } {
  if (path.includes('childCount')) {
    return { key: 'element-count', hypothesis: 'missing/extra SVG elements — node, edge, cluster box, or arrowhead count differs' };
  }
  if (path.includes('text()')) {
    return { key: 'text-content', hypothesis: 'rendered text string differs — label content, escaping, or character encoding' };
  }
  if (path.endsWith('@d')) {
    return { key: 'path-structure', hypothesis: 'edge path has a different command sequence or point count — spline routing structure' };
  }
  if (path.endsWith('@points')) {
    return { key: 'polygon-points', hypothesis: 'polygon vertex count differs — node-shape or arrowhead geometry' };
  }
  if (path.includes('font')) {
    return { key: 'font-metrics', hypothesis: 'font-size/family differs — text-metric model or label sizing' };
  }
  if (path.includes('fill') || path.includes('stroke')) {
    return { key: 'color-stroke', hypothesis: 'fill/stroke value differs — color resolution or default styling' };
  }
  if (path.includes('transform')) {
    return { key: 'transform', hypothesis: 'group transform differs — coordinate-system or translation placement' };
  }
  if (path.includes('compare-threw')) {
    return { key: 'compare-threw', hypothesis: 'compareSvg threw on the port SVG — malformed or partial output' };
  }
  return { key: 'attr-or-tag', hypothesis: 'element tag or a non-coordinate attribute differs' };
}

/** Map an errored result's message to a triage bucket + hypothesis. */
function erroredBucket(msg: string): { key: string; hypothesis: string } {
  if (msg.startsWith('ParseError') || msg.startsWith('Expected ')) {
    return { key: 'parser-gap', hypothesis: 'peggy parser rejects DOT the native parser accepts — parser-gap backlog' };
  }
  const prop = readingProp(msg);
  if (prop) {
    return { key: `undefined-${prop}`, hypothesis: `null/undefined access on .${prop} during layout — unported field or invariant gap` };
  }
  if (msg.includes('not registered') || msg.includes('engine')) {
    return { key: 'engine', hypothesis: 'engine/plugin not registered — out-of-scope engine reached' };
  }
  return { key: shortKey(msg), hypothesis: 'port threw — see message; group for a focused fix' };
}

/** Extract X from "Cannot read properties of undefined (reading 'X')". */
function readingProp(msg: string): string | null {
  const marker = "reading '";
  const i = msg.indexOf(marker);
  if (i < 0) return null;
  const rest = msg.slice(i + marker.length);
  const end = rest.indexOf("'");
  return end > 0 ? rest.slice(0, end) : null;
}

/** A short, stable-ish bucket key from a free-form message. */
function shortKey(msg: string): string {
  return msg.slice(0, 32).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

/** Group results into buckets via `bucketOf`, sorted by count desc. */
function bucketize(
  results: SurveyResult[],
  bucketOf: (r: SurveyResult) => { key: string; hypothesis: string },
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of results) {
    const { key, hypothesis } = bucketOf(r);
    const b = map.get(key) ?? { key, hypothesis, ids: [] };
    b.ids.push(r.id);
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.ids.length - a.ids.length);
}

/** Render a bucket table (count + up to 3 examples + hypothesis). */
function bucketTable(title: string, buckets: Bucket[]): string {
  if (buckets.length === 0) return '';
  const rows = buckets.map(
    (b) => `| \`${b.key}\` | ${b.ids.length} | ${b.ids.slice(0, 3).map((i) => `\`${i}\``).join(', ')} | ${b.hypothesis} |`,
  );
  return [`### ${title}`, '', '| bucket | count | examples | hypothesis |', '|---|---:|---|---|', ...rows, ''].join('\n');
}

/** Worst-first diverged table (capped; full set in parity.json + buckets). */
function divergedTable(diverged: SurveyResult[]): string {
  const sorted = [...diverged].sort((a, b) => (b.maxDelta ?? 0) - (a.maxDelta ?? 0));
  const shown = sorted.slice(0, DIVERGED_TABLE_CAP);
  const rows = shown.map(
    (r) => `| \`${r.id}\` | ${(r.maxDelta ?? 0).toFixed(2)} | \`${cell(r.firstDiffPath)}\` |`,
  );
  const more = sorted.length > shown.length ? `\n_… and ${sorted.length - shown.length} more diverged inputs (see parity.json + the buckets below)._\n` : '';
  return ['| id | maxDelta | firstDiffPath |', '|---|---:|---|', ...rows, ''].join('\n') + more;
}

/** Simple table for errored/timeout/oracle-error (id + message). */
function msgTable(results: SurveyResult[]): string {
  const rows = results
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `| \`${r.id}\` | \`${r.path}\` | ${cell(r.errMsg)} |`);
  return ['| id | path | message |', '|---|---|---|', ...rows, ''].join('\n');
}

function summary(report: ParityReport, manifest: CorpusEntry[]): string {
  const c = report.counts;
  const q = quarantineTotals(manifest);
  const qLine = Object.entries(q).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
  const matched = c['byte-match'] + c['structural-match'];
  return [
    '## Summary',
    '',
    `- **Oracle:** ${report.oracleVersion} · **corpus root:** \`${report.corpusRoot}\``,
    `- **Surveyed (applicable):** ${report.total}`,
    `- **byte-match:** ${c['byte-match']} · **structural-match:** ${c['structural-match']} ` +
      `→ ${matched}/${report.total} structurally equal (${pct(matched, report.total)})`,
    `- **diverged:** ${c.diverged} · **errored:** ${c.errored} · **timeout:** ${c.timeout} · **oracle-error:** ${c['oracle-error']}`,
    `- **Quarantined (not surveyed, from corpus-manifest.json):** ${qLine}`,
    '',
  ].join('\n');
}

function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${((100 * n) / d).toFixed(1)}%`;
}

/** Build the full PARITY.md body. */
function buildMarkdown(report: ParityReport, manifest: CorpusEntry[]): string {
  const byVerdict = (v: Verdict): SurveyResult[] => report.results.filter((r) => r.verdict === v);
  const diverged = byVerdict('diverged');
  const errored = byVerdict('errored');
  const byteIds = byVerdict('byte-match').map((r) => r.id);
  const parts: string[] = [
    '<!-- SPDX-License-Identifier: EPL-2.0 -->',
    '<!-- GENERATED by test/corpus/dashboard.ts from parity.json — do not edit by hand. -->',
    '',
    '# Dot parity dashboard',
    '',
    'Differential survey of graphviz-ts vs the native `dot` oracle over the dot',
    'test corpus. A report, not a gate (AD-1). Regenerate: `npx tsx',
    'test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts`.',
    '',
    summary(report, manifest),
    `## byte-match (${byteIds.length})`,
    '',
    'Port SVG matches the oracle within the `deterministic` tolerance (0.01).',
    '',
    collapsedIds(byteIds),
    '',
    `## structural-match (${report.counts['structural-match']})`,
    '',
    'Same element tree; only numeric coordinate diffs above tolerance (no missing',
    'or extra elements). These are near-misses — sub-pixel-to-modest position drift.',
    '',
    `## diverged (${diverged.length}) — worst-first`,
    '',
    divergedTable(diverged),
    `## errored (${errored.length})`,
    '',
    msgTable(errored),
    `## timeout (${report.counts.timeout})`,
    '',
    msgTable(byVerdict('timeout')),
    `## oracle-error (${report.counts['oracle-error']}) — excluded from port scoring`,
    '',
    'The native oracle did not emit a complete SVG (usually a hard syntax error',
    'it rejects entirely); there is no reference to compare against.',
    '',
    msgTable(byVerdict('oracle-error')),
    '## Divergence backlog (next missions)',
    '',
    'Named buckets, largest first. Each is a candidate oracle-pinned fix mission.',
    '',
    bucketTable('diverged — by firstDiffPath shape', bucketize(diverged, (r) => divergedBucket(r.firstDiffPath ?? ''))),
    bucketTable('errored — by thrown message', bucketize(errored, (r) => erroredBucket(r.errMsg ?? ''))),
  ];
  return parts.join('\n') + '\n';
}

/** Collapse an id list to a count-friendly, wrapped inline-code blob. */
function collapsedIds(ids: string[]): string {
  return ids.length === 0 ? '_(none)_' : ids.map((i) => `\`${i}\``).join(' ');
}

const report = JSON.parse(readFileSync(PARITY, 'utf8')) as ParityReport;
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as CorpusEntry[];
writeFileSync(OUT, buildMarkdown(report, manifest));
process.stderr.write(`wrote PARITY.md (${report.total} surveyed)\n`);
