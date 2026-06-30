// SPDX-License-Identifier: EPL-2.0
//
// Rules-gate analyzer (mission: text-measurement architecture, T0.2).
//
// Side-by-side comparison of the headless RULES survey (port EstimateTextMeasurer
// vs native dot headless) against the existing PANGO baseline (port LutTextMeasurer
// vs native dot pango). The decoupling claim is that the layout RULES are faithful,
// so the rules survey must not REGRESS any graph relative to the baseline:
//   - regression  : baseline match (conformant/structural) -> rules diverged/errored = GATE FAIL
//   - improvement : baseline diverged -> rules match                            = kerning fix
//   - pre-existing : diverged in BOTH (font-independent, e.g. cluster bugs)      = allowlist
//   - stable      : match in both
//
//   tsx test/corpus/rules-gate.ts [rulesParity] [baselineParity]
//
// Exit 0 if no regressions; exit 1 (and list them) otherwise.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadAccepted, matchAccepted } from './accepted.js';

const MATCH = new Set(['conformant', 'structural-match']);
const OK_NONLAYOUT = new Set(['oracle-error']); // oracle couldn't render → not a rules signal
// Verdicts where the PORT produced a full SVG (so clipOverflow is meaningful).
// timeout/errored/oracle-error did not render, so their clipping state is unknown.
const RENDERED = new Set(['conformant', 'structural-match', 'diverged']);

// Allowlisted match→diverged cases (verified NOT layout-rules regressions of the
// measurement change) now live in the unified `accepted-divergences.json`
// registry (scope `rules`/`both`), joined via accepted.ts. @see
// rules-known-divergences.md and docs/known-divergences.md.
const accepted = loadAccepted();

/** id → engine, for the registry's engineIn matching (the A1 force-directed
 *  family). The dot corpus is all-`dot`, so this only ever returns `dot` today. */
const engineOf = ((): ((id: string) => string | undefined) => {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('./corpus-manifest.json', import.meta.url)), 'utf8'),
  ) as Array<{ id: string; engine?: string }>;
  const m = new Map(manifest.map((e) => [e.id, e.engine]));
  return (id: string) => m.get(id);
})();

interface Row { id: string; verdict: string; maxDelta?: number; firstDiffPath?: string; clipOverflow?: number }

/**
 * Port-specific viewport overflow (pt) above this is treated as a clipped render
 * — geometry drawn outside the canvas where native keeps it in view. Below it is
 * sub-pixel/boundary noise (e.g. a node margin grazing the edge). The
 * position-blind structural-match verdict cannot see clipping (corpus 2592 /
 * packed clusters slipped through as "structural-match" while rendering clipped),
 * so the gate checks it independently.
 */
const CLIP_THRESHOLD = 4;

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
    const acc = matchAccepted(id, engineOf(id), 'rules', accepted);
    if (acc) { allowlisted.push(`${id} [${acc.class}] — ${acc.reason}`); continue; }
    regressions.push(`${id} (base=${b!.verdict} → rules=${r.verdict} maxΔ=${(r.maxDelta ?? 0).toFixed(1)} ${r.firstDiffPath ?? ''})`);
    continue;
  }
  preexisting.push(id); // diverged in both
}

// Clipping check (independent of the verdict): the port draws geometry outside
// the viewport where native does not. Fail only on NEW clipping vs the baseline;
// pre-existing port clipping is tracked as a watchlist (same philosophy as
// pre-existing diverged). @see survey.ts:svgOverflow / clipOverflow
const clipRegressions: string[] = [];
const clipWatch: string[] = [];
for (const [id, r] of rules) {
  const co = r.clipOverflow ?? 0;
  if (co <= CLIP_THRESHOLD) continue;
  const b = base.get(id);
  // A regression only if the baseline RENDERED in-view (so we know it didn't
  // clip before). If the baseline timed out / errored, its clipping state is
  // unknown — track it, don't fail (avoids false regressions from flaky timeouts).
  const baselineWasInView = b !== undefined && RENDERED.has(b.verdict) && (b.clipOverflow ?? 0) <= CLIP_THRESHOLD;
  if (baselineWasInView) {
    clipRegressions.push(`${id} (port clips ${co.toFixed(1)}pt outside the viewport; native does not)`);
  } else {
    clipWatch.push(`${id} (${co.toFixed(1)}pt)`);
  }
}

const out = process.stderr;
out.write(`rules-gate: stable=${stable} improvements=${improvements.length} pre-existing=${preexisting.length} allowlisted=${allowlisted.length} regressions=${regressions.length} clip-regressions=${clipRegressions.length} clip-watch=${clipWatch.length}\n`);
if (improvements.length) out.write(`improved (baseline diverged → rules match): ${improvements.join(', ')}\n`);
if (allowlisted.length) { out.write(`allowlisted match→diverged (accepted, from accepted-divergences.json):\n`); for (const a of allowlisted) out.write(`  ${a}\n`); }
if (preexisting.length) out.write(`pre-existing (diverged in both — tracked gaps, not accepted): ${preexisting.join(', ')}\n`);
if (clipWatch.length) out.write(`clip-watch (port clips outside viewport, pre-existing): ${clipWatch.join(', ')}\n`);
if (regressions.length) {
  out.write(`\nREGRESSIONS (GATE FAIL — estimate path made these worse):\n`);
  for (const r of regressions) out.write(`  ${r}\n`);
}
if (clipRegressions.length) {
  out.write(`\nCLIPPING REGRESSIONS (GATE FAIL — port now renders outside the viewport):\n`);
  for (const r of clipRegressions) out.write(`  ${r}\n`);
}
if (regressions.length || clipRegressions.length) process.exit(1);
out.write('GATE PASS — no rules or clipping regressions vs the baseline.\n');
