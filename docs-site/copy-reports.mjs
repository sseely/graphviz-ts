// SPDX-License-Identifier: EPL-2.0
//
// Mirror the generated corpus reports (test/corpus/PARITY-dot.md, PERF.md) into the
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
    src: '../test/corpus/PARITY-dot.md',
    dst: 'parity.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY.md',
    dst: 'engines.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      // map-conformance (BEGIN)
      [/\]\(\.\/PARITY-MAP\.md\)/g, '](/parity-map)'],
      // map-conformance (END)
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY-XDOT.md',
    dst: 'parity-xdot.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(xdot-parity\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  // map-conformance (BEGIN): dot (imagemap) dashboard mirror — twin of the
  // PARITY-XDOT.md block above.
  {
    src: '../test/corpus/PARITY-MAP.md',
    dst: 'parity-map.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(map-parity\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  // map-conformance (END)
  {
    src: '../test/corpus/PARITY-JSON.md',
    dst: 'parity-json.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(json-parity\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY-circo.md',
    dst: 'parity-circo.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY-twopi.md',
    dst: 'parity-twopi.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY-osage.md',
    dst: 'parity-osage.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY-patchwork.md',
    dst: 'parity-patchwork.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY-neato.md',
    dst: 'parity-neato.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY-fdp.md',
    dst: 'parity-fdp.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
    ],
  },
  {
    src: '../test/corpus/PARITY-sfdp.md',
    dst: 'parity-sfdp.md',
    rewrites: [
      [/\]\(\.\.\/\.\.\/docs\/known-divergences\.md(#[^)]*)?\)/g, '](/divergences$1)'],
      [/\]\(\.\.\/\.\.\/docs\/conformance\.md\)/g, '](/conformance)'],
      [/\]\(\.\.\/\.\.\/plans\/([^)]+)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/plans/$1)'],
      [/\]\(\.\/PARITY\.md\)/g, '](/engines)'],
      [/\]\(\.\/PARITY-dot\.md\)/g, '](/parity)'],
      [/\]\(\.\/PARITY-(circo|twopi|osage|patchwork|neato|fdp|sfdp)\.md\)/g, '](/parity-$1)'],
      [/\]\(\.\/PARITY-XDOT\.md\)/g, '](/parity-xdot)'],
      [/\]\(\.\/PARITY-JSON\.md\)/g, '](/parity-json)'],
      [/\]\(\.\/(parity[^)]*\.json[l]?)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
      [/\]\(\.\/(accepted-divergences[^)]*\.json)\)/g, '](https://github.com/sseely/graphviz-ts/blob/main/test/corpus/$1)'],
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
