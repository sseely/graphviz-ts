---
layout: home
hero:
  name: graphviz-ts
  text: Graphviz, in pure TypeScript
  tagline: DOT in, SVG out — no Java, no native binary, no WASM. Runs in the browser.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Open the playground
      link: /playground
    - theme: alt
      text: View on GitHub
      link: https://github.com/sseely/graphviz-ts
features:
  - title: Faithful to C Graphviz
    details: A line-by-line port of the canonical C implementation. The dot engine matches the native binary byte-for-byte on the golden corpus.
  - title: Browser-native, zero runtime deps
    details: No Java, no PlantUML server, no native binary, no WASM. The layout engine is TypeScript — bundle it and ship.
  - title: All eight layout engines
    details: dot, neato, fdp, sfdp, circo, twopi, osage, and patchwork — rendered to SVG.
---

## Try it

The editor below runs the actual library, in your browser. Edit the DOT on the
left; the SVG updates live.

<Playground height="360px" />
