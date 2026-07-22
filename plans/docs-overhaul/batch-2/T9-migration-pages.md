<!-- SPDX-License-Identifier: EPL-2.0 -->
# T9 — Migration pages (from C CLI; from JS libs)

## Context

Per [decisions.md#migration](../decisions.md#migration), add two "coming from
X" pages so readers migrating from the C `dot` CLI or from other JS graphviz
libraries convert quickly.

## Task

### `docs-site/guide/migrate-from-c-cli.md`

- **Mental shift:** the C tool reads files and writes files; graphviz-ts takes a
  DOT **string** and returns a **string** (or a geometry object). No filesystem.
- **Flag/format mapping table:**
  - `-K<engine>` → the `engine` argument (`renderSvg(dot,'neato')` /
    `render(g,'svg',{engine:'neato'})`). List all 8 engines.
  - `-T<format>` → `render(g, '<format>')` / `renderSvg` for svg;
    map `svg`,`json`,`xdot`,`dot`,`cmapx`/`imap` (imagemap). Note unsupported
    `-T` targets (png/pdf/ps) → out of scope; link `/divergences`.
  - `-Gname=val` / `-Nname=val` / `-Ename=val` → set attributes in the DOT
    source (or via the builder). Show the builder equivalent briefly.
- **Getting geometry the CLI can't give you** — `getLayout()` for programmatic
  positions (no `-Tplain` parsing needed). Link `/guide/geometry`.
- **Text measurement / images** differences — link `/guide/text-measurement`
  and `/guide/images` (fonts/images come from the host, injected via
  `setTextMeasurer`/`setImageSizer`, not read from disk).

### `docs-site/guide/migrate-from-js-libs.md`

- **Positioning vs viz.js / @hpcc-js/wasm / d3-graphviz:** those wrap the C via
  **WASM**; graphviz-ts is **pure TypeScript** — no WASM asset to host, no async
  module init, tree-shakeable, "go to definition" into real TS. State this as
  the headline advantage.
- **API deltas table** (approximate — verify claims you make, hedge where
  unsure): typical `new Viz().renderString(dot)` / `graphviz().renderDot(dot)`
  → `renderSvg(dot, engine)` (synchronous, no `await` init). Note d3-graphviz's
  DOM-binding/animation is out of scope — graphviz-ts returns an SVG string; you
  bind it yourself.
- **Getting layout data** — `getLayout()` as the structured alternative to
  parsing `-Tjson`/`-Tplain` output.
- **When to stay on WASM** — be honest: if you need a `-T` format graphviz-ts
  doesn't emit (raster/PDF), the WASM libs still cover it. Link `/divergences`.

Both pages: front-loaded, tables over prose, cross-link the overview, engines,
render-formats, and geometry guides.

## Read-set

- `docs-site/guide/engines.md`, `render-formats.md`, `getting-started.md`
- `src/index.ts` / `src/render/public.ts` (exact `renderSvg`/`render`/format
  names to map to)
- `docs-site/divergences.md` (scope boundary to link)
- WebSearch/WebFetch allowed to confirm the *public API shape* of viz.js /
  @hpcc-js/wasm / d3-graphviz — cite nothing internal; keep claims verifiable
  and hedge uncertain ones.

## Acceptance criteria

- Given `migrate-from-c-cli.md`, then it has a `-K`/`-T`/`-G/N/E` mapping table
  covering all 8 engines and the supported formats, and states the
  file→string shift.
- Given `migrate-from-js-libs.md`, then it names viz.js / @hpcc-js/wasm /
  d3-graphviz, leads with the no-WASM/pure-TS advantage, and honestly notes when
  WASM libs still win (unsupported formats).
- Given `npm run docs:build`, then both pages build and links resolve.

## Observability / Rollback

N/A / Reversible.

## Quality bar

`npm run docs:build` green. API/format mappings match the real exports; external
library claims are accurate or explicitly hedged.

## Boundaries

- **Always:** verify format/engine names against source; hedge uncertain
  third-party API claims.
- **Never:** overstate parity (don't claim graphviz-ts emits formats it
  doesn't); never disparage — state trade-offs factually.

## Commit

`docs(T9): add migration guides from the C CLI and from JS graphviz libs`
