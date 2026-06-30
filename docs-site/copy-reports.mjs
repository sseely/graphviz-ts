// SPDX-License-Identifier: EPL-2.0
//
// Mirror the generated corpus reports (test/corpus/PARITY.md, PERF.md) into the
// VitePress site as parity.md / perf.md so they publish on GitHub Pages. Run as
// the first step of `docs:dev` / `docs:build` (see package.json), so CI's
// `npm run docs:build` picks them up automatically. The copies are gitignored —
// the source files in test/corpus are the originals; edit those, never these.
//
// Each source has relative links written for its test/corpus location; rewrite
// them to site paths so they resolve on the published site.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const REPORTS = [
  {
    src: '../test/corpus/PARITY.md',
    dst: 'parity.md',
    // ../../docs/{known-divergences,conformance}.md (from test/corpus) -> site pages
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md\)/g, '](/divergences)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
    ],
  },
  {
    src: '../test/corpus/PERF.md',
    dst: 'perf.md',
    // ./PARITY.md (sibling in test/corpus) -> the site's /parity page
    rewrites: [[/\]\(\.\/PARITY\.md\)/g, '](/parity)']],
  },
];

for (const { src, dst, rewrites } of REPORTS) {
  let md = readFileSync(here(src), 'utf8');
  for (const [re, to] of rewrites) md = md.replace(re, to);
  const note =
    `<!-- Mirrored from ${src.replace('../', '')} by docs-site/copy-reports.mjs ` +
    `at docs build time. Edit the source report, not this copy. -->\n`;
  writeFileSync(here(dst), note + md);
  process.stderr.write(`copy-reports: wrote docs-site/${dst}\n`);
}
