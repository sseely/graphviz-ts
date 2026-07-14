// Re-bucket the CURRENT diverged tail per engine, post rounds 3a/3b/3c.
// Signature-only: no injection harness (that decides drift-vs-real; here we
// only need the mechanism families to pick round 3d's target).
//
//   npx tsx rebucket.ts <engine>
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { compareXdot } from '../golden/compare-xdot.js';
import { classifyBucket } from './attribute-divergence.js';

const REPO = '/Users/scottseely/git/graphviz-ts';
const CORPUS = join(homedir(), 'git/graphviz/tests');
const DOT_BIN = join(homedir(), 'git/graphviz/build/cmd/dot/dot');
const engine = process.argv[2];
const ITER = new Set(['neato', 'fdp', 'sfdp']);
const TOL = ITER.has(engine) ? 0.5 : 0.01;

const parity = JSON.parse(readFileSync(join(REPO, `test/corpus/parity-${engine}.json`), 'utf8'));
const manifest = JSON.parse(readFileSync(join(REPO, 'test/corpus/corpus-manifest.json'), 'utf8'));
const entries = Array.isArray(manifest) ? manifest : manifest.entries;
const pathOf = new Map<string, string>(entries.map((e: { id: string; path: string }) => [e.id, e.path]));

const diverged = parity.results.filter((r: { status: string }) => r.status === 'diverged');
const rows: { id: string; n: number; kind: string; signature: string }[] = [];

for (const [i, r] of diverged.entries()) {
  const p = join(CORPUS, pathOf.get(r.id) ?? '');
  let oracle: string;
  try {
    oracle = execFileSync(DOT_BIN, ['-K', engine, '-Txdot', p], {
      encoding: 'utf8', timeout: 120000, env: { ...process.env, GVBINDIR: '/tmp/ghl' },
    });
  } catch { continue; }
  const res = spawnSync('npx', ['tsx', join(REPO, 'test/corpus/render-one-xdot.ts'), p, engine], {
    encoding: 'utf8', timeout: 120000,
  });
  if (res.status !== 0 || !res.stdout) continue;
  const cmp = compareXdot(res.stdout, oracle, TOL);
  if (cmp.pass) continue;
  const b = classifyBucket(cmp.diffs);
  rows.push({ id: r.id, n: cmp.diffs.length, kind: b.kind, signature: b.signature });
  if (i % 25 === 0) console.error(`  ${engine} ${i}/${diverged.length}`);
}

const bySig = new Map<string, { ids: string[]; kind: string }>();
for (const r of rows) {
  const e = bySig.get(r.signature) ?? { ids: [], kind: r.kind };
  e.ids.push(r.id);
  bySig.set(r.signature, e);
}
const fams = [...bySig.entries()].sort((a, b) => b[1].ids.length - a[1].ids.length);
console.log(`\n### ${engine}: ${rows.length} diverged re-bucketed`);
console.log(`  kind: count=${rows.filter(r => r.kind === 'count').length} position=${rows.filter(r => r.kind === 'position').length}`);
for (const [sig, e] of fams.slice(0, 12)) {
  console.log(`  ${String(e.ids.length).padStart(4)}  [${e.kind}]  ${sig.slice(0, 110)}`);
  console.log(`        e.g. ${e.ids.slice(0, 5).join(' ')}`);
}
writeFileSync(`/private/tmp/claude-501/-Users-scottseely-git-graphviz-ts/1e0c3f24-2740-46f3-8bd1-a687cc312179/scratchpad/rebucket-${engine}.json`, JSON.stringify({ engine, rows, families: fams.map(([s, e]) => ({ signature: s, kind: e.kind, count: e.ids.length, ids: e.ids })) }, null, 1));
