// SPDX-License-Identifier: EPL-2.0
import { defineConfig } from 'vitepress';
import { fileURLToPath, URL } from 'node:url';
import { dotLang } from './dot.tmLanguage';
import { renderSvg } from '../../src/index.js';

// Deployed at https://knowvah.github.io/dot-engine/ — base MUST match the repo
// name (Pages serves the site under /<repo>/), or every CSS/JS/font asset 404s
// and the page renders unstyled.

/**
 * Render a ` ```dot render ` fenced block to inline SVG at build time, using the
 * library itself (dogfooding the port), mapping graphviz's black → currentColor
 * so the diagram follows the light/dark theme. Plain ` ```dot ` fences stay
 * highlighted code blocks.
 */
function renderDotFigure(dot: string): string {
  try {
    const raw = renderSvg(dot, 'dot');
    const i = raw.indexOf('<svg');
    const svg = (i >= 0 ? raw.slice(i) : raw)
      .replace(/(stroke|fill)="black"/g, '$1="currentColor"')
      .replace(/(stroke|fill)="#000000"/g, '$1="currentColor"')
      .replace(/(stroke|fill)="#000"/g, '$1="currentColor"');
    return `<figure class="dot-figure">${svg}</figure>\n`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `<pre class="dot-figure-error">DOT render error: ${msg}</pre>\n`;
  }
}

export default defineConfig({
    base: '/dot-engine/',
  title: '@knowvah/dot-engine',
  description:
    'A faithful, pure-TypeScript port of Graphviz. DOT in, SVG out — no Java, ' +
    'no native binary, no WASM. Runs in the browser.',
  lang: 'en-US',
  cleanUrls: true,
  markdown: {
    // Register the DOT grammar so ```dot fences highlight (Shiki bundles none).
    languages: [dotLang],
    // A ```dot render fence → inline SVG rendered by the library (renderDotFigure).
    config(md) {
      const fence = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.info.trim() === 'dot render') return renderDotFigure(token.content);
        return fence(tokens, idx, options, env, self);
      };
    },
  },
  themeConfig: {
    // Built-in offline search (MiniSearch); no external service.
    search: { provider: 'local' },
    nav: [
      { text: 'Overview', link: '/guide/overview' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Showcase', link: '/showcase/' },
      { text: 'Playground', link: '/playground' },
      { text: 'API', link: '/guide/api' },
      { text: 'Conformance', link: '/conformance' },
      { text: 'Parity', link: '/engines' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview (mental model)', link: '/guide/overview' },
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Layout engines', link: '/guide/engines' },
          { text: 'Glossary', link: '/guide/glossary' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Browser usage', link: '/guide/browser' },
          { text: 'Build a graph in code', link: '/guide/build-a-graph' },
          { text: 'Read computed geometry', link: '/guide/geometry' },
          { text: 'Text measurement', link: '/guide/text-measurement' },
          { text: 'Working with images', link: '/guide/images' },
          { text: 'Render to other formats', link: '/guide/render-formats' },
          { text: 'Custom rendering with xdot', link: '/guide/xdot-drawops' },
        ],
      },
      {
        text: 'Showcase',
        items: [
          { text: 'The golden corpus', link: '/showcase/' },
          { text: 'dot', link: '/showcase/dot' },
          { text: 'neato', link: '/showcase/neato' },
          { text: 'fdp', link: '/showcase/fdp' },
          { text: 'sfdp', link: '/showcase/sfdp' },
          { text: 'circo', link: '/showcase/circo' },
          { text: 'twopi', link: '/showcase/twopi' },
          { text: 'osage', link: '/showcase/osage' },
          { text: 'patchwork', link: '/showcase/patchwork' },
        ],
      },
      {
        text: 'Recipes',
        items: [
          { text: 'Recipes cookbook', link: '/guide/recipes' },
        ],
      },
      {
        text: 'Migrating',
        items: [
          { text: 'From the C dot CLI', link: '/guide/migrate-from-c-cli' },
          { text: 'From JS graphviz libraries', link: '/guide/migrate-from-js-libs' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API reference (curated)', link: '/guide/api' },
          { text: 'Types', link: '/guide/types' },
          { text: 'Generated API (TypeDoc)', link: '/reference/' },
          { text: 'Playground', link: '/playground' },
          { text: 'Conformance (what "match" means)', link: '/conformance' },
          { text: 'Known divergences', link: '/divergences' },
          { text: 'Parity dashboard (dot)', link: '/parity' },
          { text: 'Engine parity (all engines)', link: '/engines' },
          { text: 'Performance dashboard', link: '/perf' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/knowvah/dot-engine' },
    ],
  },
  vite: {
    resolve: {
      alias: {
        // The playground imports the *real* engine source, so docs stay in
        // lockstep with the library rather than a copied bundle.
        '@knowvah/dot-engine': fileURLToPath(
          new URL('../../src/index.ts', import.meta.url),
        ),
      },
    },
  },
});
