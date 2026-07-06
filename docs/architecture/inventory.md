<!-- SPDX-License-Identifier: EPL-2.0 -->

# Repository Inventory

Repos analyzed: the current project (`graphviz-ts`) plus its directly related
siblings in `~/git`. All three relatives were already cloned
locally; no new clones were required.

| Repo | Language | Runtime | Framework | Database | Key Deps | Entry | Notes |
|------|----------|---------|-----------|----------|----------|-------|-------|
| graphviz-ts | TypeScript (ES2022, strict) | Node 26.3.1 (Volta) + browser | none (zero runtime deps) | — | esbuild, peggy, vitest, vitepress | `src/index.ts` → `renderSvg` / `render` | This project; faithful port of C Graphviz |
| graphviz | C | native binary | none | — | autotools, libgvc | `lib/` (cgraph, dotgen, …) | Canonical C spec (gitlab upstream, tag 15.0.0) |
| plantuml-js | TypeScript (ES2022) | Node + browser | none | — | jsonc-parser, katex, vite, vitest | `src/index.ts` | Downstream consumer; PlantUML port |
| plantuml | Java | JVM | none | — | maven | `net.sourceforge.plantuml` | Java reference for plantuml-js (sseely fork) |

## Per-repo detail

### graphviz-ts (this project)

- **Runtime versions**: TypeScript `^5.4.0`, target ES2022, `module: NodeNext`,
  `strict: true`. Pinned Node 26.3.1 via Volta. Designed to run in a browser
  with **zero runtime dependencies** and no Node-only APIs.
- **Languages**: TypeScript only (plus a Peggy grammar compiled to the DOT
  parser).
- **Key components**: eight layout engines (`dot`, `neato`, `fdp`, `sfdp`,
  `twopi`, `circo`, `osage`, `patchwork`), a DOT parser, a render pipeline,
  and a programmatic graph-builder API. 454 `.ts` files.
- **Databases**: none.
- **External services**: none. `setImageSizer` is a caller-supplied callback
  for image intrinsic dimensions (the one I/O seam).
- **Entry points**:
  - `graphviz-ts` (root) → `renderSvg(dot, engine)`, `tryRenderSvg`,
    `render(ctx, g, format)` (as `renderWithContext`), `parse`.
  - `graphviz-ts/api` → `createGraph`, `addEdge`, `getLayout` (geometry
    snapshot).
  - `graphviz-ts/render` → `render(g, format, opts)`, `getDrawOps`.
  - Output formats: `svg`, `json`, `dot`, `xdot`, `plain`, `imap`, `cmapx`.

### graphviz (C — canonical spec)

- **Runtime versions**: C, built with autotools; local checkout at tag
  `15.0.0` (+82 commits). This is the upstream `gitlab.com/graphviz/graphviz`,
  not a fork.
- **Languages**: primarily C, with build tooling.
- **Key components**: `lib/cgraph` (graph model), `lib/dotgen` (dot engine),
  `lib/neatogen`, `lib/circogen`, `lib/osage`, `lib/sfdpgen`, `lib/pathplan`,
  `lib/common`, `lib/label`, `lib/gvc`, `lib/cdt`, `lib/ast`.
- **Entry points**: the `dot`/`neato`/… CLIs and `libgvc`.
- **Role**: the canonical specification. graphviz-ts ports it module-by-module
  (`cdt` → `ast` → `cgraph` → `common` → engines → `gvc`).

### plantuml-js (downstream consumer)

- **Runtime versions**: TypeScript `^5.4.0`, target ES2022, bundler module
  resolution. Built with Vite.
- **Languages**: TypeScript.
- **Key components**: diagram parsers/renderers under `src/diagrams`, a core
  under `src/core`, and an **in-house dot layout** under `src/core/dot/`
  (ported from PlantUML's Smetana). graphviz-ts is intended to replace this
  in-house dot port.
- **Databases / external services**: none. `katex` for math, `jsonc-parser`
  for config.
- **Entry points**: `src/index.ts`.

### plantuml (Java reference)

- **Runtime versions**: Java on the JVM (sseely fork of upstream PlantUML).
- **Languages**: Java.
- **Role**: the Java source plantuml-js is ported from. Indirectly related to
  graphviz-ts (it is the origin of the Smetana dot port that graphviz-ts
  replaces). Not a build- or run-time dependency of graphviz-ts.
