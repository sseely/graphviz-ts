// SPDX-License-Identifier: EPL-2.0
//
// Corpus blind-spot scanner: feature CO-OCCURRENCE, not line coverage.
//
// WHY THIS EXISTS. Line/branch coverage says `abomination` is covered — plenty
// of corpus graphs reach it. What no corpus graph reaches is `abomination` AND
// a cluster, and that conjunction is where the crash lived. Every defect the
// 2026-07-14 audit turned up sat in an EMPTY CELL of this matrix:
//
//   record      x xlabel        -> 0 graphs  (record nodes silently lost xlabels)
//   abomination x cluster       -> 0 graphs  (rank-window hole; a hard crash)
//   pack        x flat-label    -> 0 graphs  (has_labels read from the wrong graph)
//
// Single features are all well covered. The conjunctions are the dark matter,
// and a passing sweep over them proves nothing because they never ran.
//
// The scan is syntactic on purpose: it reports what a graph DECLARES, because
// that is what a fixture author can control when closing a gap.
//
//   npx tsx test/corpus/blind-spots.ts
//
// Node-only dev/test infra — never imported by src/index.ts.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CORPUS = join(homedir(), 'git/graphviz/tests');

/** Feature detectors, keyed by the DOT construct a fixture author would write. */
const FEATURES: Record<string, (s: string) => boolean> = {
  cluster: (s) => /\bsubgraph\s+["']?cluster/i.test(s),
  pack: (s) => /\bpack\s*=/i.test(s),
  concentrate: (s) => /\bconcentrate\s*=\s*true/i.test(s),
  minlen0: (s) => /\bminlen\s*=\s*"?0/i.test(s),
  ranksame: (s) => /\brank\s*=\s*"?same/i.test(s),
  edgelabel: (s) => /->|--/.test(s) && /\blabel\s*=/i.test(s),
  headtaillabel: (s) => /\b(head|tail)label\s*=/i.test(s),
  xlabel: (s) => /\bxlabel\s*=/i.test(s),
  record: (s) => /\bshape\s*=\s*"?M?record/i.test(s),
  htmllabel: (s) => /label\s*=\s*</i.test(s),
  compound: (s) => /\bcompound\s*=\s*true|\bl(head|tail)\s*=/i.test(s),
  ports: (s) => /(->|--)\s*[\w"]+\s*:\s*\w/.test(s),
  samehead: (s) => /\bsame(head|tail)\s*=/i.test(s),
  splines: (s) => /\bsplines\s*=/i.test(s),
  rankdir: (s) => /\brankdir\s*=/i.test(s),
  ratio_size: (s) => /\bratio\s*=|\bsize\s*=/i.test(s),
  newrank: (s) => /\bnewrank\s*=\s*true/i.test(s),
  constraint: (s) => /\bconstraint\s*=\s*false/i.test(s),
  ordering: (s) => /\bordering\s*=/i.test(s),
  selfloop: (s) => /(\b[\w"]+)\s*->\s*\1\b/.test(s),
  fixedsize: (s) => /\bfixedsize\s*=\s*true/i.test(s),
  invis: (s) => /\bstyle\s*=\s*"?invis/i.test(s),
};

const KEYS = Object.keys(FEATURES);

function walk(dir: string, out: string[]): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(dot|gv)$/i.test(e)) out.push(p);
  }
  return out;
}

const rows = walk(CORPUS, []).flatMap((p) => {
  let s: string;
  try {
    s = readFileSync(p, 'utf8');
  } catch {
    return [];
  }
  return [{ p, feats: new Set(KEYS.filter((k) => FEATURES[k]!(s))) }];
});

process.stdout.write(`corpus inputs scanned: ${rows.length}\n\n`);

const count = (k: string): number => rows.filter((r) => r.feats.has(k)).length;

process.stdout.write('=== single-feature counts (low = thin ice) ===\n');
for (const [k, n] of KEYS.map((k) => [k, count(k)] as const).sort((a, b) => a[1] - b[1])) {
  process.stdout.write(`  ${String(n).padStart(4)}  ${k}\n`);
}

process.stdout.write('\n=== DARK CELLS: pairs that NEVER co-occur ===\n');
process.stdout.write('    (both features exist in the corpus, but no graph has both.\n');
process.stdout.write('     A sweep can never exercise this combination.)\n');
let dark = 0;
for (let i = 0; i < KEYS.length; i++) {
  for (let j = i + 1; j < KEYS.length; j++) {
    const a = KEYS[i]!;
    const b = KEYS[j]!;
    const na = count(a);
    const nb = count(b);
    if (na === 0 || nb === 0) continue;
    if (rows.some((r) => r.feats.has(a) && r.feats.has(b))) continue;
    process.stdout.write(`  ${`${a} x ${b}`.padEnd(34)}  (${na} x ${nb} graphs, never together)\n`);
    dark++;
  }
}
process.stdout.write(`\n  ${dark} dark cells.\n`);

process.stdout.write('\n=== THIN ICE: pairs carried by 1-2 graphs ===\n');
process.stdout.write('    (one quarantined input away from becoming a dark cell)\n');
for (let i = 0; i < KEYS.length; i++) {
  for (let j = i + 1; j < KEYS.length; j++) {
    const a = KEYS[i]!;
    const b = KEYS[j]!;
    const both = rows.filter((r) => r.feats.has(a) && r.feats.has(b));
    if (both.length === 0 || both.length > 2) continue;
    const ids = both.map((r) => r.p.split('/').pop()).join(', ');
    process.stdout.write(`  ${`${a} x ${b}`.padEnd(34)}  n=${both.length}  ${ids}\n`);
  }
}
