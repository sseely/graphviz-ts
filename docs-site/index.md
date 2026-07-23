---
layout: home
hero:
  name: "@knowvah/dot-engine"
  text: Graphviz, in pure TypeScript
  tagline: DOT in, SVG out — no C. No native Graphviz binary, no WASM. Pure TypeScript, runs in the browser.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Open the playground
      link: /playground
    - theme: alt
      text: View on GitHub
      link: https://github.com/knowvah/dot-engine
features:
  - title: Faithful to C Graphviz
    details: A line-by-line port of the canonical C implementation. The dot engine matches the native binary to a tight deterministic tolerance (±0.01 on coordinates, exact non-numeric content) on the golden corpus.
  - title: Browser-native, zero runtime deps
    details: No C — no native Graphviz binary, no WASM port, no rendering server. The layout engine itself is TypeScript — bundle it and ship.
  - title: All eight layout engines
    details: dot, neato, fdp, sfdp, circo, twopi, osage, and patchwork — rendered to SVG.
  - title: Programmatic layout + geometry
    details: Don't just render — read back computed node positions, edge splines, and cluster bounds as a plain JSON-serializable snapshot via getLayout(), no -Tplain parsing required.
---

## Try it

The editor below runs the actual library, in your browser. Edit the DOT on the
left; the SVG updates live.

<Playground height="360px" />

## Choose your path

New here? Pick the door that matches what you're doing:

| I want to… | Start here |
| --- | --- |
| Understand how the pieces fit | [Overview — the mental model](/guide/overview) |
| Install and render my first graph | [Getting started](/guide/getting-started) |
| Solve a concrete task | [Recipes cookbook](/guide/recipes) |
| Look up a function or type | [API reference](/guide/api) · [Types](/guide/types) |
| Experiment without installing | [Playground](/playground) |

Coming from another tool? See [From the C `dot` CLI](/guide/migrate-from-c-cli)
or [From JS graphviz libraries](/guide/migrate-from-js-libs).

For exhaustive, auto-generated signatures see the
[generated API reference](/reference/). Embedding rendered graphs on a page?
Read [Working with images](/guide/images) for image inlining and CSP guidance.
