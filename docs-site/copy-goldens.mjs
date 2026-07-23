// SPDX-License-Identifier: EPL-2.0
// Copy step (run in docs:build / docs:dev, like copy-reports.mjs): read the
// golden manifest + input .dot sources and inject them into the docs site —
// (1) a data file the showcase gallery imports, and (2) one generated page per
// layout engine plus a showcase index. The goldens render CLIENT-SIDE in the
// browser via the library; see .vitepress/theme/GoldenGallery.vue.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // docs-site/
const REPO = join(HERE, '..'); // repo root
const MANIFEST = join(REPO, 'test/golden/manifest.json');

const ENGINE_ORDER = [
  'dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi', 'osage', 'patchwork',
];
const ENGINE_BLURB = {
  dot: 'Hierarchical, layered layout for directed graphs.',
  neato: 'Spring-model (Kamada–Kawai) layout for undirected graphs.',
  fdp: 'Force-directed (Fruchterman–Reingold) layout for undirected graphs.',
  sfdp: 'Scalable force-directed layout for large undirected graphs.',
  circo: 'Circular layout for cyclic / biconnected structures.',
  twopi: 'Radial layout around a root node.',
  osage: 'Clustered layout that packs subgraphs.',
  patchwork: 'Squarified treemap of clusters by area.',
};

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const byEngine = {};
for (const e of manifest) {
  const dot = readFileSync(join(REPO, e.input), 'utf8');
  (byEngine[e.engine] ??= []).push({
    id: e.id,
    description: e.description,
    toleranceClass: e.toleranceClass,
    dot,
  });
}
const order = ENGINE_ORDER.filter((eng) => byEngine[eng]?.length);
const counts = Object.fromEntries(order.map((eng) => [eng, byEngine[eng].length]));
const total = order.reduce((n, eng) => n + counts[eng], 0);

// (1) data the client gallery imports (gitignored, generated).
writeFileSync(
  join(HERE, '.vitepress/goldens.json'),
  JSON.stringify({ order, counts, byEngine }),
);

// (2) generated pages: a showcase index + one page per engine (gitignored).
mkdirSync(join(HERE, 'showcase'), { recursive: true });

const rows = order
  .map(
    (eng) =>
      `- [**${eng}**](/showcase/${eng}) — ${ENGINE_BLURB[eng]} _(${counts[eng]} goldens)_`,
  )
  .join('\n');

writeFileSync(
  join(HERE, 'showcase/index.md'),
  `---
title: Showcase
---

# Showcase — the golden corpus

Every graph in this section is one of **${total} golden test cases** the library is
held to, rendered **live in your browser** by \`@knowvah/dot-engine\` — the exact
code that ships. One page per layout engine:

${rows}

Each card shows the graph the library produced, a short description, and — folded
away — its DOT source. Deterministic cases match the native \`dot\` binary to
±0.01; iterative engines match within a looser tolerance
(see [Conformance](/conformance)).
`,
);

for (const eng of order) {
  writeFileSync(
    join(HERE, `showcase/${eng}.md`),
    `---
title: ${eng} goldens
---

# ${eng} — ${counts[eng]} goldens

${ENGINE_BLURB[eng]} Each graph below is rendered live in your browser by the library.

<GoldenGallery engine="${eng}" />
`,
  );
}

console.log(
  `[copy-goldens] ${total} goldens / ${order.length} engines → goldens.json + ${order.length + 1} pages`,
);
