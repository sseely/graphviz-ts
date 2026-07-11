// SPDX-License-Identifier: EPL-2.0
//
// Cross-engine parity overview generator.
//
// Reads the per-track survey artifacts — parity.json (dot SVG, survey.ts),
// xdot-parity.json (dot xdot, xdot-walk.ts --survey), and parity-<engine>.json
// (non-dot engine walks, engine-walk.ts) — plus test/golden/manifest.json, and
// writes:
//
//   • PARITY.md          — the cross-engine SUMMARY page: one row per track,
//                          the golden-suite counts, and links to the per-track
//                          dashboards. Engines without a survey artifact are
//                          noted as "not yet surveyed".
//   • PARITY-<engine>.md — per-engine detail (diverged + error rosters) for
//                          each engine whose parity-<engine>.json exists.
//
// A report, not a gate. Regenerate: `npx tsx test/corpus/parity-report.ts`.
// Node-only dev/test infra — never imported by src/index.ts.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SurveyResult, Verdict } from './survey.js';
import type { XdotVerdict, XdotWalkResult } from './xdot-walk.js';
import type { EngineParityReport, EngineWalkRow } from './engine-walk.js';
import type { CorpusEntry } from './enumerate.js';
import { loadAccepted, matchAccepted } from './accepted.js';

/** Non-dot deterministic engines swept by engine-walk.ts. */
const ENGINES = ['circo', 'twopi', 'osage', 'patchwork'] as const;

const PARITY = new URL('./parity.json', import.meta.url);
const XDOT_PARITY = new URL('./xdot-parity.json', import.meta.url);
const MANIFEST = new URL('./corpus-manifest.json', import.meta.url);
const GOLDEN_MANIFEST = new URL('../golden/manifest.json', import.meta.url);
const OUT = new URL('./PARITY.md', import.meta.url);

interface SvgParityReport {
  total: number;
  counts: Record<Verdict, number>;
  results: SurveyResult[];
}

interface XdotParityReport {
  total: number;
  counts: Record<XdotVerdict, number>;
  results: XdotWalkResult[];
}

/** One summary-table row (a "track" = one engine × one comparison surface). */
interface TrackRow {
  track: string;
  surveyed: number;
  pass: number;
  diverged: number;
  accepted: number;
  errors: number;
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

/**
 * The dot (SVG) track: parity.json joined with the accepted-divergence
 * registry (same join dashboard.ts performs) so `accepted` splits out of the
 * non-conformant set and `diverged` counts only tracked gaps.
 */
function dotSvgRow(report: SvgParityReport, manifest: CorpusEntry[]): TrackRow {
  const c: Record<Verdict, number> = Object.assign(
    { conformant: 0, 'structural-match': 0, diverged: 0, errored: 0, timeout: 0, 'oracle-error': 0 },
    report.counts,
  );
  const acceptedReg = loadAccepted();
  const engineOf = new Map(manifest.map((e) => [e.id, e.engine]));
  let accepted = 0;
  for (const r of report.results) {
    if (r.verdict !== 'diverged' && r.verdict !== 'structural-match') continue;
    if (matchAccepted(r.id, engineOf.get(r.id), 'parity', acceptedReg)) accepted++;
  }
  return {
    track: 'dot (SVG)',
    surveyed: report.total,
    pass: c.conformant,
    diverged: c.diverged + c['structural-match'] - accepted,
    accepted,
    errors: c.errored + c.timeout + c['oracle-error'],
  };
}

function dotXdotRow(report: XdotParityReport): TrackRow {
  const c: Record<XdotVerdict, number> = Object.assign(
    { conformant: 0, diverged: 0, accepted: 0, 'port-error': 0, 'oracle-error': 0, timeout: 0 },
    report.counts,
  );
  return {
    track: 'dot (xdot)',
    surveyed: report.total,
    pass: c.conformant,
    diverged: c.diverged,
    accepted: c.accepted,
    errors: c['port-error'] + c['oracle-error'] + c.timeout,
  };
}

function engineRow(engine: string, report: EngineParityReport): TrackRow {
  const c = Object.assign(
    { pass: 0, diverged: 0, 'oracle-error': 0, 'port-error': 0, timeout: 0 },
    report.counts,
  );
  return {
    track: `${engine} (xdot)`,
    surveyed: report.total,
    pass: c.pass,
    diverged: c.diverged,
    accepted: 0, // no acceptance list for this engine yet
    errors: c['oracle-error'] + c['port-error'] + c.timeout,
  };
}

function trackTable(rows: TrackRow[]): string {
  const body = rows.map(
    (r) =>
      `| ${r.track} | ${r.surveyed} | ${r.pass} | ${r.diverged} | ${r.accepted} | ` +
      `${r.errors} | ${pct(r.pass, r.surveyed)} |`,
  );
  return [
    '| track | surveyed | conformant / pass | diverged | accepted | errors | pass % |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...body,
    '',
  ].join('\n');
}

/** Golden counts per engine from test/golden/manifest.json. */
function goldensSection(): string {
  const manifest = JSON.parse(readFileSync(GOLDEN_MANIFEST, 'utf8')) as Array<{ engine: string }>;
  const byEngine = new Map<string, number>();
  for (const e of manifest) byEngine.set(e.engine, (byEngine.get(e.engine) ?? 0) + 1);
  const rows = [...byEngine.entries()].map(([eng, n]) => `| ${eng} | ${n} |`);
  return [
    '## Goldens',
    '',
    `${manifest.length} pinned golden inputs (\`test/golden/manifest.json\`), by engine:`,
    '',
    '| engine | goldens |',
    '|---|---:|',
    ...rows,
    '',
    'The golden xdot suite gates these in CI (`test/golden/xdot-suite.test.ts`).',
    '',
  ].join('\n');
}

/** Per-engine detail page (PARITY-<engine>.md). */
function engineMarkdown(engine: string, report: EngineParityReport): string {
  const c = Object.assign(
    { pass: 0, diverged: 0, 'oracle-error': 0, 'port-error': 0, timeout: 0 },
    report.counts,
  );
  const diverged = report.results
    .filter((r) => r.status === 'diverged')
    .sort((a, b) => (b.nDiffs ?? 0) - (a.nDiffs ?? 0) || a.id.localeCompare(b.id));
  const faults = report.results
    .filter((r) => r.status === 'oracle-error' || r.status === 'port-error' || r.status === 'timeout')
    .sort((a, b) => a.status.localeCompare(b.status) || a.id.localeCompare(b.id));

  const divergedTable = diverged.length === 0
    ? '_(none)_\n'
    : [
        '| id | size | #diffs | firstDiff |',
        '|---|---:|---:|---|',
        ...diverged.map(
          (r: EngineWalkRow) =>
            `| \`${r.id}\` | ${r.size} | ${r.nDiffs ?? 0} | \`${cell(r.firstDiff)}\` |`,
        ),
        '',
      ].join('\n');

  const faultTable = faults.length === 0
    ? '_(none)_\n'
    : [
        '| id | status | message |',
        '|---|---|---|',
        ...faults.map((r) => `| \`${r.id}\` | ${r.status} | ${escText(r.err)} |`),
        '',
      ].join('\n');

  return [
    '<!-- SPDX-License-Identifier: EPL-2.0 -->',
    `<!-- GENERATED by test/corpus/parity-report.ts from parity-${engine}.json — do not edit by hand. -->`,
    '',
    `# ${engine} parity dashboard`,
    '',
    `Differential survey of graphviz-ts \`${engine}\` xdot output vs the native`,
    `\`dot -K ${engine} -Txdot\` oracle over the dot-track SVG-conformant corpus`,
    'set (semantic draw-op comparison at ±0.01 — see `test/golden/compare-xdot.ts`;',
    'per [docs/conformance.md](../../docs/conformance.md), not byte equality).',
    `Regenerate: \`npx tsx test/corpus/engine-walk.ts ${engine} && npx tsx`,
    'test/corpus/parity-report.ts`.',
    '',
    '## Summary',
    '',
    `- **Surveyed:** ${report.total} (generated ${report.generatedAt})`,
    `- **pass:** ${c.pass} (${pct(c.pass, report.total)}) · **diverged:** ${c.diverged}`,
    `- **oracle-error:** ${c['oracle-error']} · **port-error:** ${c['port-error']} · ` +
      `**timeout:** ${c.timeout}`,
    '',
    `## Diverged (${diverged.length})`,
    '',
    divergedTable,
    `## Errors and timeouts (${faults.length})`,
    '',
    faultTable,
    `_Passing ids (${c.pass}) are omitted for brevity — the full roster is in`,
    `\`parity-${engine}.json\`._`,
    '',
  ].join('\n');
}

/** Build the cross-engine PARITY.md summary page. */
function buildSummary(
  rows: TrackRow[],
  missingEngines: string[],
  presentEngines: string[],
): string {
  const links = [
    '- [PARITY-dot.md](./PARITY-dot.md) — dot (SVG) dashboard (`dashboard.ts`)',
    '- [PARITY-XDOT.md](./PARITY-XDOT.md) — dot (xdot) dashboard (`xdot-dashboard.ts`)',
    ...presentEngines.map(
      (e) => `- [PARITY-${e}.md](./PARITY-${e}.md) — ${e} (xdot) dashboard (\`parity-report.ts\`)`,
    ),
  ];
  const missingNote = missingEngines.length
    ? `_Not yet surveyed: ${missingEngines.map((e) => `\`${e}\``).join(', ')} ` +
      '(run `npx tsx test/corpus/engine-walk.ts <engine>` to add a track)._'
    : '';
  return [
    '<!-- SPDX-License-Identifier: EPL-2.0 -->',
    '<!-- GENERATED by test/corpus/parity-report.ts — do not edit by hand. -->',
    '',
    '# Parity overview',
    '',
    'Cross-engine conformance summary of graphviz-ts vs the native Graphviz',
    'oracle, one row per track (engine × comparison surface). A report, not a',
    'gate. Regenerate: `npx tsx test/corpus/parity-report.ts` (after refreshing',
    'the per-track surveys it reads).',
    '',
    '**conformant / pass** is the ±0.01 deterministic-tolerance verdict per',
    '[docs/conformance.md](../../docs/conformance.md) — numeric payloads agree',
    'within tolerance and non-numeric content is exactly equal — not byte',
    'equality. **errors** = oracle-error + port-error/errored + timeout',
    '(excluded from scoring). **accepted** = documented won\'t-fix deltas',
    '(0 for engines without an acceptance list).',
    '',
    '## Tracks',
    '',
    trackTable(rows),
    missingNote,
    '',
    goldensSection(),
    '## Per-track dashboards',
    '',
    ...links,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------

const svgReport = JSON.parse(readFileSync(PARITY, 'utf8')) as SvgParityReport;
const xdotReport = JSON.parse(readFileSync(XDOT_PARITY, 'utf8')) as XdotParityReport;
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as CorpusEntry[];

const rows: TrackRow[] = [dotSvgRow(svgReport, manifest), dotXdotRow(xdotReport)];
const presentEngines: string[] = [];
const missingEngines: string[] = [];
for (const engine of ENGINES) {
  const url = new URL(`./parity-${engine}.json`, import.meta.url);
  if (!existsSync(url)) {
    missingEngines.push(engine);
    continue;
  }
  const report = JSON.parse(readFileSync(url, 'utf8')) as EngineParityReport;
  rows.push(engineRow(engine, report));
  presentEngines.push(engine);
  const out = fileURLToPath(new URL(`./PARITY-${engine}.md`, import.meta.url));
  writeFileSync(out, engineMarkdown(engine, report));
  process.stderr.write(`wrote PARITY-${engine}.md (${report.total} surveyed)\n`);
}

writeFileSync(OUT, buildSummary(rows, missingEngines, presentEngines));
process.stderr.write(
  `wrote PARITY.md (${rows.length} tracks; not yet surveyed: ${missingEngines.join(', ') || 'none'})\n`,
);
