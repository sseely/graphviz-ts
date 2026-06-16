import { renderSvg } from '../src/index.js';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const DOT = homedir() + '/git/graphviz/build/cmd/dot/dot';
const ENV = { ...process.env, GVBINDIR: '/tmp/gvplugins' };

function dotSvg(src: string): string {
  return execFileSync(DOT, ['-Tsvg'], { input: src, env: ENV, encoding: 'utf8' });
}

interface Parsed { vb: [number, number]; paths: number[][]; polys: number[][]; ell: number; texts: number; }
function parse(svg: string): Parsed {
  const Q = '"';
  const vbm = svg.match(new RegExp('viewBox=' + Q + '([^' + Q + ']+)'));
  const vbn = (vbm?.[1] ?? '0 0 0 0').split(/\s+/).map(Number);
  const nums = (s: string) => (s.match(/-?[0-9.]+/g) ?? []).map(Number);
  const grabAll = (re: RegExp): number[][] => {
    const out: number[][] = []; let m; re.lastIndex = 0;
    while ((m = re.exec(svg)) !== null) out.push(nums(m[1]));
    return out;
  };
  return {
    vb: [vbn[2], vbn[3]],
    paths: grabAll(new RegExp('<path[^>]*\\sd=' + Q + '([^' + Q + ']+)' + Q, 'g')),
    polys: grabAll(new RegExp('<polygon[^>]*points=' + Q + '([^' + Q + ']+)' + Q, 'g')),
    ell: (svg.match(/<ellipse/g) ?? []).length,
    texts: (svg.match(/<text/g) ?? []).length,
  };
}
function maxDelta(a: number[][], b: number[][]): number {
  let mx = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const pa = a[i], pb = b[i];
    for (let j = 0; j + 1 < Math.min(pa.length, pb.length); j += 2) {
      mx = Math.max(mx, Math.hypot(pa[j] - pb[j], pa[j + 1] - pb[j + 1]));
    }
  }
  return mx;
}

const CORPUS: [string, string][] = [
  ['multi-rank transitive', 'digraph{a->b->c; a->c}'],
  ['diamond', 'digraph{a->b;a->c;b->d;c->d}'],
  ['parallel edges x3', 'digraph{a->b;a->b;a->b}'],
  ['long skip edge', 'digraph{a->b->c->d->e; a->e}'],
  ['back edge', 'digraph{a->b->c; c->a}'],
  ['dense fan in/out', 'digraph{a->b;a->c;a->d;a->e;b->f;c->f;d->f;e->f}'],
  ['flat unlabeled', 'digraph{rank=same; a->b}'],
  ['flat labeled', 'digraph{{rank=same a b} a->b[label="lbl"]}'],
  ['flat adjacent port', 'digraph{{rank=same a b} a:n->b:n}'],
  ['self-loop', 'digraph{a->a}'],
  ['self-loop labeled', 'digraph{a->a[label="x"]}'],
  ['compass ports', 'digraph{a:n->b:s}'],
  ['record ports', 'digraph{a[shape=record,label="<f0>x|<f1>y"]; b; a:f0->b}'],
  ['cluster basic', 'digraph{subgraph cluster_0{a->b} a->c}'],
  ['cluster edge endpoint', 'digraph{subgraph cluster_0{a} b; a->b}'],
  ['two clusters', 'digraph{subgraph cluster_0{a->b} subgraph cluster_1{c->d} b->c}'],
  ['rankdir LR', 'digraph{rankdir=LR; a->b->c; a->c}'],
  ['node shapes', 'digraph{a[shape=box]; b[shape=diamond]; a->b}'],
  ['bidirectional', 'digraph{a->b; b->a}'],
  ['undirected chain', 'graph{a--b--c; a--c}'],
  ['edge label mid', 'digraph{a->b[label="mid"]; b->c}'],
  ['ports both dense', 'digraph{a:e->b; a:w->c; a->d}'],
  ['nested cluster', 'digraph{subgraph cluster_0{subgraph cluster_1{a} b} a->b}'],
  ['multi parallel labeled', 'digraph{a->b[label="1"]; a->b[label="2"]}'],
  ['wide tree', 'digraph{r->a;r->b;r->c;r->d;a->a1;a->a2;b->b1;c->c1;d->d1}'],
];

const rows: string[] = [];
let diverge = 0, near = 0, match = 0, structFail = 0;
for (const [label, src] of CORPUS) {
  let c: Parsed, t: Parsed;
  try { c = parse(dotSvg(src)); } catch (e) { rows.push(`${label.padEnd(24)} DOT-ERROR`); continue; }
  try { t = parse(renderSvg(src, 'dot')); } catch (e) { rows.push(`${label.padEnd(24)} TS-THROW ${(e as Error).message.slice(0,40)}`); diverge++; continue; }
  const struct = c.paths.length === t.paths.length && c.polys.length === t.polys.length
    && c.ell === t.ell && c.texts === t.texts;
  const pd = maxDelta(c.paths, t.paths);
  const vbd = Math.max(Math.abs(c.vb[0] - t.vb[0]), Math.abs(c.vb[1] - t.vb[1]));
  let verdict: string;
  if (!struct) { verdict = 'STRUCT'; structFail++; diverge++; }
  else if (pd <= 0.5 && vbd <= 1) { verdict = 'MATCH'; match++; }
  else if (pd <= 2 && vbd <= 2) { verdict = 'near'; near++; }
  else { verdict = 'DIVERGE'; diverge++; }
  const structStr = struct ? `p${c.paths.length} g${c.polys.length} e${c.ell} t${c.texts}`
    : `C[p${c.paths.length} g${c.polys.length} e${c.ell} t${c.texts}] TS[p${t.paths.length} g${t.polys.length} e${t.ell} t${t.texts}]`;
  rows.push(`${label.padEnd(24)} ${verdict.padEnd(8)} pathΔ=${pd.toFixed(2).padStart(6)} vbΔ=${vbd.toFixed(0).padStart(3)}  ${structStr}`);
}
console.log('\n=== ROUTING RE-VERIFICATION CORPUS (graphviz-ts vs built dot) ===\n');
console.log(rows.join('\n'));
console.log(`\nSUMMARY: ${match} MATCH, ${near} near, ${diverge} DIVERGE (of which ${structFail} structural) / ${CORPUS.length} total`);
