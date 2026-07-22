<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (locked)

Confirmed with the user during planning. Treat as locked; if a task
discovers a conflicting constraint, STOP and log to
[decision-journal.md](./decision-journal.md) — do not silently override.

## AD-1: Image-embedding API — global resolver + render option {#image-api}

**Context.** graphviz-ts emits external images as a verbatim passthrough:
`src/render/svg.ts:usershape()` (≈line 268) writes
`<image xlink:href="src" …>`. There is no way to produce a self-contained
SVG (one that carries the image bytes inline). The library must stay
browser-safe (no `Buffer`, no filesystem).

**Decision.** Add a process-global caller-injected resolver mirroring the
existing `setImageSizer` pattern (AD3 / `usershape.ts`):
- `setImageResolver(fn | null)` where
  `ImageResolver = (src: string) => { bytes: Uint8Array; mime?: string } | Uint8Array | null`.
- `RenderOptions.inlineImages?: boolean` (default `false`). When `true`, the
  SVG emitter consults the resolver and, on a hit, writes
  `xlink:href="data:<mime>;base64,<b64>"` instead of the raw src. `mime` is
  inferred from the src extension when the resolver omits it.
- Base64 is encoded with a browser-safe helper (chunked
  `String.fromCharCode` + `btoa`, or a manual encoder) — no `Buffer`.

**Consequences.** Additive, non-breaking (default off ⇒ byte-identical
output). Threads one flag through the render path and adds one emit branch
behind it. One seam (`usershape()`) covers both node `image=` and HTML
`<IMG>` cells. Reversible by revert.

## AD-2: TypeDoc integrates as Markdown into VitePress {#typedoc}

**Context.** The site is VitePress with hand-authored guides and local
(MiniSearch) search. Public symbols already carry solid TSDoc.

**Decision.** Use `typedoc` + `typedoc-plugin-markdown` to emit `.md` into
`docs-site/reference/`, wired into `docs:build` via a `docs:api` script. The
generated pages are added to the VitePress sidebar (a "Reference (generated)"
group) and are **gitignored** — regenerated at build time. Entry points:
`graphviz-ts`, `graphviz-ts/api`, `graphviz-ts/render`.

**Consequences.** One unified site (shared theme + search). Adds a build
dependency (accepted trade-off). Generated pages never hand-edited.

## AD-3: Migration pages — from C CLI and from JS libs {#migration}

**Context.** React/Angular docs include "coming from X" pages that convert
readers quickly.

**Decision.** Two short guide pages:
- **From the C `dot` CLI** — flag/format mapping (`-K` → engine, `-T` →
  format), what's out of scope (raster/PDF/GUI), file-in → string-in shift.
- **From other JS graphviz libs** — viz.js / @hpcc-js/wasm / d3-graphviz API
  deltas and the no-WASM / pure-TS advantages.

**Consequences.** Two new files; no code impact.

## AD-4: Dashboard test references link to gitlab, never local paths {#gitlab-links}

**Context.** `test/corpus/dashboard.ts` already gitlab-links the corpus
*root* (`CORPUS_GITLAB`), but per-id error tables in the generated
`parity-<engine>.md` leak raw absolute paths, e.g.
`Command failed: /Users/scottseely/git/graphviz/build/cmd/dot/dot -K circo
-Txdot /Users/scottseely/git/graphviz/tests/1447.dot`.

**Decision.** Add a shared helper (`test/corpus/corpus-links.ts`):
- `gitlabTestUrl(corpusRelPath)` → `https://gitlab.com/graphviz/graphviz/-/blob/main/tests/<path>`.
- `scrubLocalPaths(msg)` → replace any absolute path under the corpus/oracle
  roots (and `$HOME`) with a stable placeholder or the gitlab blob URL.
Apply in the per-id tables of `parity-report.ts`, `dashboard.ts`,
`json-dashboard.ts`, `map-dashboard.ts`, `xdot-dashboard.ts`. Turn the test
`id` column into a gitlab blob link where a corpus-relative path is known.
Regenerate the `PARITY-*.md` sources; `copy-reports.mjs` mirrors them.

**Consequences.** Generated docs stop leaking machine paths and become
navigable to upstream. Helper is unit-tested. No behavior change to the port.

## AD-5: `plans/` stays tracked (project override) {#plans-tracked}

The project CLAUDE.md mandates keeping `plans/` as archaeology, so this brief
is committed (unlike the plan-mission default of gitignoring `plans/`).
`.claude/settings.autonomous.json` is already gitignored.

## Rollback classification

All tasks are **Reversible** (revert the deploy/commit). No migrations, no
irreversible steps, no data-format changes.
