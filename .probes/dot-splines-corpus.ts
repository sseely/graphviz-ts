/* DOT-1 re-verification corpus: diff TS routing vs the dot oracle across varied
 * graph shapes. Edge paths matched by <title>; reports max control-point delta. */
import { execSync } from 'node:child_process';
import { renderSvg } from '../src/index.js';

const ORACLE = `${process.env.HOME}/git/graphviz/build/cmd/dot/dot`;
const ENV = { ...process.env, GVBINDIR: '/tmp/gvplugins' };

const CORPUS: [string, string][] = [
  ['chain', 'digraph{a->b->c->d}'],
  ['tree', 'digraph{a->b;a->c;b->d;b->e;c->f;c->g}'],
  ['diamond', 'digraph{a->b;a->c;b->d;c->d}'],
  ['parallel3', 'digraph{a->b;a->b;a->b}'],
  ['ports-ew', 'digraph{a:e->b:w}'],
  ['ports-sn', 'digraph{rankdir=LR; a:s->b:n}'],
  ['cluster', 'digraph{subgraph cluster_0{a->b} b->c}'],
  ['selfloop', 'digraph{a->a;a->b}'],
  ['backedge', 'digraph{a->b->c;c->a}'],
  ['longspan', 'digraph{a->b->c->d; a->d}'],
  ['edgelabel', 'digraph{a->b[label="hi"]; b->c}'],
  ['rankdir-lr', 'digraph{rankdir=LR; a->b->c; a->c}'],
  ['fanout', 'digraph{a->b;a->c;a->d;a->e;a->f}'],
  ['dense', 'digraph{a->x;a->y;b->x;b->y;c->x;c->y; x->z;y->z}'],
  ['wide', 'digraph{a->b;a->c;a->d; b->e;c->e;d->e; b->f;c->f;d->f}'],
];

function parseEdges(svg: string): Map<string, { x: number; y: number }[]> {
  const m = new Map<string, { x: number; y: number }[]>();
  const seen = new Map<string, number>();
  const re = /<title>([^<]*&#45;&gt;[^<]*)<\/title>\s*<path[^>]*\sd="(M[^"]+)"/g;
  let g: RegExpExecArray | null;
  while ((g = re.exec(svg)) !== null) {
    const nums = g[2].match(/-?[0-9.]+/g) ?? [];
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: +nums[i], y: +nums[i + 1] });
    const occ = (seen.get(g[1]) ?? 0); seen.set(g[1], occ + 1);
    m.set(g[1] + '#' + occ, pts); // match TS<->dot by title + occurrence
  }
  return m;
}

function bbox(svg: string): string {
  return (svg.match(/viewBox="([^"]+)"/)?.[1] ?? '?').trim();
}

function maxDelta(a: { x: number; y: number }[], b: { x: number; y: number }[]): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  return d;
}

for (const [name, src] of CORPUS) {
  let ts = '', dot = '';
  try { ts = renderSvg(src, 'dot'); } catch (e) { console.log(`${name.padEnd(12)} TS THREW: ${(e as Error).message}`); continue; }
  try { dot = execSync(`${ORACLE} -Tsvg`, { input: src, env: ENV }).toString(); } catch { console.log(`${name.padEnd(12)} ORACLE FAIL`); continue; }
  const tm = parseEdges(ts), dm = parseEdges(dot);
  const bbMatch = bbox(ts) === bbox(dot);
  let worst = 0, mism = 0; const bad: string[] = [];
  for (const [k, tp] of tm) {
    const dp = dm.get(k); if (dp === undefined) continue;
    const d = maxDelta(tp, dp); if (d > worst) worst = d;
    if (d > 0.5) { mism++; bad.push(`${k}(Δ${d === Infinity ? 'PTCNT' : d.toFixed(1)})`); }
  }
  const edgeCntMatch = tm.size === dm.size;
  const flag = (!bbMatch || !edgeCntMatch || worst > 0.5) ? ' <-- DIVERGES' : '';
  console.log(`${name.padEnd(12)} bbox ${bbMatch ? 'ok ' : 'DIFF'} edges TS${tm.size}/dot${dm.size} worstΔ=${worst === Infinity ? 'PTCOUNT' : worst.toFixed(2)} bad=${mism}${flag}${bad.length ? '  ' + bad.join(' ') : ''}`);
}

// --- extra characterization for DOT-1 scoping ---
const EXTRA: [string, string][] = [
  ['fan2', 'digraph{a->b;a->c}'],
  ['fan3', 'digraph{a->b;a->c;a->d}'],
  ['fan7', 'digraph{a->b;a->c;a->d;a->e;a->f;a->g;a->h}'],
  ['merge5', 'digraph{b->z;c->z;d->z;e->z;f->z}'],
  ['lr-fan', 'digraph{rankdir=LR; a->b;a->c;a->d;a->e;a->f}'],
  ['lr-long', 'digraph{rankdir=LR; a->b->c->d; a->d}'],
  ['skew', 'digraph{a->b; a->c; c->d; rank0[style=invis]; rank0->a}'],
];
console.log('--- extra ---');
for (const [name, src] of EXTRA) {
  let ts = '', dot = '';
  try { ts = renderSvg(src, 'dot'); } catch (e) { console.log(`${name} TS THREW`); continue; }
  try { dot = execSync(`${ORACLE} -Tsvg`, { input: src, env: ENV }).toString(); } catch { console.log(`${name} ORACLE FAIL`); continue; }
  const tm = parseEdges(ts), dm = parseEdges(dot);
  let worst = 0, mism = 0; const bad: string[] = [];
  for (const [k, tp] of tm) { const dp = dm.get(k); if (!dp) continue; const d = maxDelta(tp, dp); if (d > worst) worst = d; if (d > 0.5) { mism++; bad.push(k.replace('&#45;&gt;','>')); } }
  console.log(`${name.padEnd(10)} bbox ${bbox(ts)===bbox(dot)?'ok ':'DIFF'} worstΔ=${worst===Infinity?'PTCNT':worst.toFixed(1)} bad=${mism} ${bad.join(' ')}`);
}
