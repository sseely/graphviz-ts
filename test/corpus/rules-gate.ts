// SPDX-License-Identifier: EPL-2.0
//
// Rules-gate analyzer (mission: text-measurement architecture, T0.2).
//
// Side-by-side comparison of the headless RULES survey (port EstimateTextMeasurer
// vs native dot headless) against the existing PANGO baseline (port LutTextMeasurer
// vs native dot pango). The decoupling claim is that the layout RULES are faithful,
// so the rules survey must not REGRESS any graph relative to the baseline:
//   - regression  : baseline match (byte/structural) -> rules diverged/errored  = GATE FAIL
//   - improvement : baseline diverged -> rules match                            = kerning fix
//   - pre-existing : diverged in BOTH (font-independent, e.g. cluster bugs)      = allowlist
//   - stable      : match in both
//
//   tsx test/corpus/rules-gate.ts [rulesParity] [baselineParity]
//
// Exit 0 if no regressions; exit 1 (and list them) otherwise.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MATCH = new Set(['byte-match', 'structural-match']);
const OK_NONLAYOUT = new Set(['oracle-error']); // oracle couldn't render → not a rules signal

/**
 * Allowlisted match→diverged cases, each verified NOT to be a layout-rules
 * (node-position) regression of the measurement change. Keyed by id → reason.
 * The estimate measurer produces the correct (headless-matching) node WIDTHS in
 * every case; these divergences are either full-SVG emit artifacts (node geometry
 * byte-exact) or pre-existing font-INDEPENDENT layout gaps surfaced (not caused)
 * by the corrected widths. @see rules-known-divergences.md
 */
const ALLOWLIST: Record<string, string> = {
  // node geometry byte-exact (0.00); divergence is childCount/edge-emit between
  // the headless oracle and the port, not layout rules.
  'graphs-structs': 'nodes 0.00; full-SVG childCount (record/text emit) artifact',
  'nshare-root_circo': 'nodes 0.00 (1054/1054); full-SVG childCount + one edge @d',
  'nshare-root_twopi': 'nodes 0.00 (1054/1054); full-SVG childCount + one edge @d',
  // node WIDTHS match headless exactly (rx 34.64); residual 1pt is node2's x under
  // a :sw compass-port edge — a pre-existing x-NS/compass-port gap the LUT's
  // slightly-narrow widths masked. Out of scope (DESIGN non-goals).
  '2168_2': 'widths match headless (rx 34.64); 1pt is node2 x under :sw compass port (x-NS gap, not measurement)',
};

interface Row { id: string; verdict: string; maxDelta?: number; firstDiffPath?: string }

function load(p: string): Map<string, Row> {
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const rows: Row[] = j.results ?? j;
  return new Map(rows.map((r) => [r.id, r]));
}

const rulesPath = process.argv[2] ?? fileURLToPath(new URL('./parity-rules.json', import.meta.url));
const basePath = process.argv[3] ?? fileURLToPath(new URL('./parity.json', import.meta.url));
const rules = load(rulesPath);
const base = load(basePath);

const regressions: string[] = [];
const improvements: string[] = [];
const preexisting: string[] = [];
const allowlisted: string[] = [];
let stable = 0;

for (const [id, r] of rules) {
  if (OK_NONLAYOUT.has(r.verdict)) continue;
  const b = base.get(id);
  const bMatch = b !== undefined && MATCH.has(b.verdict);
  const rMatch = MATCH.has(r.verdict);
  if (rMatch && (b === undefined || bMatch)) { stable++; continue; }
  if (rMatch && !bMatch) { improvements.push(id); continue; }
  if (!rMatch && bMatch) {
    if (id in ALLOWLIST) { allowlisted.push(`${id} — ${ALLOWLIST[id]}`); continue; }
    regressions.push(`${id} (base=${b!.verdict} → rules=${r.verdict} maxΔ=${(r.maxDelta ?? 0).toFixed(1)} ${r.firstDiffPath ?? ''})`);
    continue;
  }
  preexisting.push(id); // diverged in both
}

const out = process.stderr;
out.write(`rules-gate: stable=${stable} improvements=${improvements.length} pre-existing=${preexisting.length} allowlisted=${allowlisted.length} regressions=${regressions.length}\n`);
if (improvements.length) out.write(`improved (baseline diverged → rules match): ${improvements.join(', ')}\n`);
if (allowlisted.length) { out.write(`allowlisted match→diverged (verified non-rules; see rules-known-divergences.md):\n`); for (const a of allowlisted) out.write(`  ${a}\n`); }
if (preexisting.length) out.write(`pre-existing (diverged in both, font-independent allowlist): ${preexisting.join(', ')}\n`);
if (regressions.length) {
  out.write(`\nREGRESSIONS (GATE FAIL — estimate path made these worse):\n`);
  for (const r of regressions) out.write(`  ${r}\n`);
  process.exit(1);
}
out.write('GATE PASS — no rules regressions vs the pango baseline.\n');
