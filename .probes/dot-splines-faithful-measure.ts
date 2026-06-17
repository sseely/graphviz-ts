/* T1 (mission-dot-splines) — faithful-routing divergence inventory.
 *
 * For every dot-engine golden AND the divergence corpus, render the graph under
 * each measurement mode of the edge-route faithful switch:
 *   off  — committed default (simplified fitter)
 *   adj  — adjacent-rank plain edges forced through the faithful pathplan path
 *   mr   — multi-rank plain chains forced faithful
 *   all  — both
 * Goldens are compared against the stored C reference SVG; corpus cases against
 * the live dot 15.0.0 oracle. Reports, per case, the worst control-point delta
 * of each mode vs truth, attributing any shift to adj / mr (and flagging
 * rankdir). Read-only measurement: the switch defaults off, so no committed
 * behavior changes. Run: npx tsx .probes/dot-splines-faithful-measure.ts
 *
 * NOTE (T1 finding): with the committed tree the faithful path declines plain
 * regular edges whose bound siblings carry their spline on `to_orig` (the wide
 * fan-out/fan-in/merge cases) — `boundMissing` in edge-route-faithful.ts checks
 * only `ED_spl(e)` one level deep, but C `getsplinepoints` walks the `to_orig`
 * chain. Until that one-line fix lands (T2's first sub-task), the corpus FIXED
 * verdicts below do not reproduce (faithful falls back to the fitter for those).
 * The simpler golden edges (no on-to_orig bound) route either way, so the 3
 * golden divergences DO reproduce here. The full inventory in decision-journal.md
 * was captured WITH that fix applied (then reverted to keep T1 inside its
 * write-set); re-run after T2 to reproduce the corpus fixes.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSvg } from '../src/index.js';
import { setForceFaithfulRegular } from '../src/layout/dot/edge-route.js';
import type { FaithfulForceMode } from '../src/layout/dot/edge-route.js';

const ORACLE = `${process.env.HOME}/git/graphviz/build/cmd/dot/dot`;
const ENV = { ...process.env, GVBINDIR: '/tmp/gvplugins' };
const TOL = 0.5;        // corpus parity threshold (iterative)
const DET_TOL = 0.01;   // golden byte-identical threshold (deterministic gate)

interface ManifestEntry { id: string; engine: string; input: string; reference: string; }
type Pt = { x: number; y: number };

// --- SVG edge extraction (edge groups only; key by title + occurrence) ------
function parseEdges(svg: string): Map<string, Pt[]> {
  const m = new Map<string, Pt[]>();
  const seen = new Map<string, number>();
  const re = /<g[^>]*class="edge"[^>]*>\s*<title>([^<]*)<\/title>\s*<path[^>]*\sd="(M[^"]+)"/g;
  let g: RegExpExecArray | null;
  while ((g = re.exec(svg)) !== null) {
    const nums = g[2].match(/-?[0-9.]+/g) ?? [];
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: +nums[i], y: +nums[i + 1] });
    const occ = seen.get(g[1]) ?? 0; seen.set(g[1], occ + 1);
    m.set(g[1] + '#' + occ, pts);
  }
  return m;
}

function maxDelta(a: Pt[], b: Pt[]): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  return d;
}

/** Worst per-edge control-point delta of `cand` vs `truth` (matched by key). */
function worstVs(cand: Map<string, Pt[]>, truth: Map<string, Pt[]>): number {
  let worst = 0;
  for (const [k, tp] of cand) {
    const rp = truth.get(k);
    if (rp === undefined) continue;
    worst = Math.max(worst, maxDelta(tp, rp));
  }
  return worst;
}

function render(src: string, mode: FaithfulForceMode): string {
  const prev = setForceFaithfulRegular(mode);
  try { return renderSvg(src, 'dot'); } finally { setForceFaithfulRegular(prev); }
}

function fmt(d: number): string { return d === Infinity ? 'PTCNT' : d.toFixed(2); }

// --- Goldens ----------------------------------------------------------------
const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(root, 'test/golden/manifest.json'), 'utf8'),
) as ManifestEntry[];
const dotGoldens = manifest.filter((e) => e.engine === 'dot');

interface Row { id: string; category: string; worst: number; adj: number; mr: number; offRef: number; notes: string; }
const inventory: Row[] = [];

// Classify every dot golden under faithful-all (mode 'all') vs the committed
// default (mode 'off') and vs the stored C reference, at the deterministic
// (0.01pt) threshold the gate enforces:
//   no-op             — all == off: faithful declined or produced identical
//                       output; migration leaves this golden byte-identical.
//   migrated-matches  — all != off but all ~= ref: faithful rerouted and still
//                       matches C; migration keeps it byte-identical.
//   migrated-diverges — all != off and all != ref: faithful BREAKS the golden;
//                       a batch must close it (this is the inventory).
let nNoop = 0, nMatch = 0, maxAllRef = 0;
console.log('=== dot goldens: faithful-all vs default & vs C reference (DET_TOL 0.01) ===');
console.log('id'.padEnd(30), 'all!=off  allΔref  category');
for (const e of dotGoldens) {
  const src = readFileSync(join(root, e.input), 'utf8');
  const ref = parseEdges(readFileSync(join(root, e.reference), 'utf8'));
  if (ref.size === 0) continue; // no edges to route
  const off = parseEdges(render(src, 'off'));
  const adj = parseEdges(render(src, 'adj'));
  const mr = parseEdges(render(src, 'mr'));
  const all = parseEdges(render(src, 'all'));
  const dAllOff = worstVs(all, off);   // did faithful change anything?
  const dAllRef = worstVs(all, ref);   // does faithful match C?
  const dAdjOff = worstVs(adj, off);
  const dMrOff = worstVs(mr, off);
  maxAllRef = Math.max(maxAllRef, dAllRef === Infinity ? maxAllRef : dAllRef);
  const rankdir = /rankdir\s*=\s*"?(LR|RL|BT)/i.test(src);
  const changed = dAllOff > DET_TOL;
  const diverges = changed && dAllRef > DET_TOL;
  if (!changed) { nNoop++; continue; }
  if (!diverges) {
    nMatch++;
    console.log(e.id.padEnd(30), fmt(dAllOff).padEnd(9), fmt(dAllRef).padEnd(8), 'migrated-matches');
    continue;
  }
  const cats: string[] = [];
  if (dAdjOff > DET_TOL) cats.push('adj-plain');
  if (dMrOff > DET_TOL) cats.push('mr-plain');
  if (rankdir) cats.push('rankdir');
  console.log(e.id.padEnd(30), fmt(dAllOff).padEnd(9), fmt(dAllRef).padEnd(8),
    'DIVERGES ' + (cats.join('+') || 'unknown'));
  inventory.push({
    id: e.id, category: cats.join('+') || 'unknown',
    worst: dAllRef, adj: dAdjOff, mr: dMrOff, offRef: worstVs(off, ref),
    notes: 'breaks golden',
  });
}
console.log(`\ngoldens: ${nNoop} no-op, ${nMatch} migrated-matches, ${inventory.length} DIVERGES`
  + ` (max allΔref over all = ${fmt(maxAllRef)})`);

// --- Corpus: which currently-diverging cases reach dot parity faithful ------
const CORPUS: [string, string][] = [
  ['chain', 'digraph{a->b->c->d}'],
  ['tree', 'digraph{a->b;a->c;b->d;b->e;c->f;c->g}'],
  ['diamond', 'digraph{a->b;a->c;b->d;c->d}'],
  ['parallel3', 'digraph{a->b;a->b;a->b}'],
  ['cluster', 'digraph{subgraph cluster_0{a->b} b->c}'],
  ['backedge', 'digraph{a->b->c;c->a}'],
  ['longspan', 'digraph{a->b->c->d; a->d}'],
  ['edgelabel', 'digraph{a->b[label="hi"]; b->c}'],
  ['rankdir-lr', 'digraph{rankdir=LR; a->b->c; a->c}'],
  ['fanout', 'digraph{a->b;a->c;a->d;a->e;a->f}'],
  ['dense', 'digraph{a->x;a->y;b->x;b->y;c->x;c->y; x->z;y->z}'],
  ['wide', 'digraph{a->b;a->c;a->d; b->e;c->e;d->e; b->f;c->f;d->f}'],
  ['fan2', 'digraph{a->b;a->c}'],
  ['fan3', 'digraph{a->b;a->c;a->d}'],
  ['fan7', 'digraph{a->b;a->c;a->d;a->e;a->f;a->g;a->h}'],
  ['merge5', 'digraph{b->z;c->z;d->z;e->z;f->z}'],
  ['lr-fan', 'digraph{rankdir=LR; a->b;a->c;a->d;a->e;a->f}'],
  ['lr-long', 'digraph{rankdir=LR; a->b->c->d; a->d}'],
];
console.log('\n=== corpus: faithful-all vs dot oracle (does faithful fix it?) ===');
console.log('case'.padEnd(12), 'offΔ   allΔ   verdict');
const fixed: string[] = [];
for (const [name, src] of CORPUS) {
  let oracle = '';
  try { oracle = execSync(`${ORACLE} -Tsvg`, { input: src, env: ENV }).toString(); }
  catch { console.log(name.padEnd(12), 'ORACLE FAIL'); continue; }
  const ref = parseEdges(oracle);
  const dOff = worstVs(parseEdges(render(src, 'off')), ref);
  const dAll = worstVs(parseEdges(render(src, 'all')), ref);
  let verdict = 'no change';
  if (dOff > TOL && dAll <= TOL) { verdict = 'FIXED'; fixed.push(name); }
  else if (dOff > TOL && dAll > TOL && dAll < dOff) verdict = 'improved';
  else if (dOff > TOL && dAll >= dOff) verdict = 'still bad';
  else if (dOff <= TOL && dAll > TOL) verdict = 'REGRESSED';
  console.log(name.padEnd(12), fmt(dOff).padEnd(6), fmt(dAll).padEnd(6), verdict);
}

// --- Inventory (markdown, paste into decision-journal) ----------------------
console.log('\n=== INVENTORY (markdown) ===');
console.log('| golden | category | worstΔ(all) | adjΔ | mrΔ | notes |');
console.log('|--------|----------|-------------|------|-----|-------|');
for (const r of inventory) {
  console.log(`| ${r.id} | ${r.category} | ${fmt(r.worst)} | ${fmt(r.adj)} | ${fmt(r.mr)} | ${r.notes} |`);
}
console.log(`\nshifting goldens: ${inventory.length} / ${dotGoldens.length} dot goldens`);
console.log(`corpus fixed by faithful: ${fixed.length} [${fixed.join(', ')}]`);
