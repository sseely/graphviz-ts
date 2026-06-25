// SPDX-License-Identifier: EPL-2.0
import { defineConfig } from 'vitepress';
import { fileURLToPath, URL } from 'node:url';

// Deployed at https://sseely.github.io/graphviz-ts/ — base must match the repo.
export default defineConfig({
  base: '/graphviz-ts/',
  title: 'graphviz-ts',
  description:
    'A faithful, pure-TypeScript port of Graphviz. DOT in, SVG out — no Java, ' +
    'no native binary, no WASM. Runs in the browser.',
  lang: 'en-US',
  cleanUrls: true,
  themeConfig: {
    // Built-in offline search (MiniSearch); no external service.
    search: { provider: 'local' },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Playground', link: '/playground' },
      { text: 'API', link: '/guide/api' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Layout engines', link: '/guide/engines' },
          { text: 'Browser usage', link: '/guide/browser' },
          { text: 'Build a graph in code', link: '/guide/build-a-graph' },
          { text: 'Read computed geometry', link: '/guide/geometry' },
          { text: 'Text measurement', link: '/guide/text-measurement' },
          { text: 'Render to other formats', link: '/guide/render-formats' },
          { text: 'Custom rendering with xdot', link: '/guide/xdot-drawops' },
          { text: 'API reference', link: '/guide/api' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Playground', link: '/playground' },
          { text: 'Known divergences', link: '/divergences' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/sseely/graphviz-ts' },
    ],
  },
  vite: {
    resolve: {
      alias: {
        // The playground imports the *real* engine source, so docs stay in
        // lockstep with the library rather than a copied bundle.
        'graphviz-ts': fileURLToPath(
          new URL('../../src/index.ts', import.meta.url),
        ),
      },
    },
  },
});
