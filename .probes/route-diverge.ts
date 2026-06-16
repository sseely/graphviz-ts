import { renderSvg } from '../src/index.js';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
const DOT = homedir() + '/git/graphviz/build/cmd/dot/dot';
const ENV = { ...process.env, GVBINDIR: '/tmp/gvplugins' };
const dotSvg = (s: string) => execFileSync(DOT, ['-Tsvg'], { input: s, env: ENV, encoding: 'utf8' });

// Map edge <title> -> path d, by pairing each <g class="edge"><title>X</title>...<path d="Y">
function edgePaths(svg: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<title>([^<]*&#45;&gt;[^<]*|[^<]*&#45;&#45;[^<]*)<\/title>\s*<path[^>]*\sd="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg)) !== null) out.set(m[1].replace(/&#45;/g,'-').replace(/&gt;/g,'>'), m[2]);
  return out;
}
const cases: [string,string][] = [
  ['rankdir LR', 'digraph{rankdir=LR; a->b->c; a->c}'],
  ['bidirectional', 'digraph{a->b; b->a}'],
  ['ports both dense', 'digraph{a:e->b; a:w->c; a->d}'],
  ['nested cluster', 'digraph{subgraph cluster_0{subgraph cluster_1{a} b} a->b}'],
  ['multi parallel labeled', 'digraph{a->b[label="1"]; a->b[label="2"]}'],
];
for (const [label, src] of cases) {
  console.log(`\n##### ${label}: ${src}`);
  const c = edgePaths(dotSvg(src)), t = edgePaths(renderSvg(src,'dot'));
  const keys = new Set([...c.keys(), ...t.keys()]);
  for (const k of keys) {
    console.log(`  [${k}]`);
    console.log(`    C : ${c.get(k) ?? '(none)'}`);
    console.log(`    TS: ${t.get(k) ?? '(none)'}`);
  }
}
