<!-- SPDX-License-Identifier: EPL-2.0 -->
# T10 — Glossary (`docs-site/guide/glossary.md`)

## Context

The docs use domain terms (engine, xdot, conformance, oracle, cluster, spline,
rank, DOT) that a newcomer won't know. A glossary — standard in mature doc sets
— gives one authoritative definition per term and lets other pages link to it.

## Task

Write `docs-site/guide/glossary.md` as an alphabetized definition list. Each
entry: 1-3 sentences, and a link to the guide page that covers it in depth.
Include at least:

- **DOT** — the graph description language graphviz-ts parses. Link
  getting-started.
- **Layout engine** — `dot`/`neato`/`fdp`/`sfdp`/`circo`/`twopi`/`osage`/
  `patchwork`; what each is for. Link `/guide/engines`.
- **Rank / rankdir** — dot's layered levels; direction.
- **Cluster** — a `subgraph cluster_*`; note the `cluster<N>` internal naming
  and the re-key recipe. Link `/guide/recipes`.
- **Spline / edge routing** — curved edge paths; the `points` in `EdgeGeometry`.
- **xdot** — the extended DOT draw-op stream; structured draw ops. Link
  `/guide/xdot-drawops`.
- **Conformance** — what "matches the C" means (±0.01 numeric, exact non-numeric
  on the golden corpus). Link `/conformance`.
- **Oracle** — the native C `dot` binary graphviz-ts is verified against. Link
  `/conformance` / `/parity`.
- **Divergence** — an accepted, catalogued difference from the oracle. Link
  `/divergences`.
- **Coordinate frame / y-axis** — y-up (native) vs y-down (screen). Link
  `/guide/geometry`.
- **Text measurer** — the injected font-metrics provider. Link
  `/guide/text-measurement`.
- **Image sizer / resolver** — injected image dimension/bytes providers. Link
  `/guide/images`.
- **Usershape** — Graphviz's term for an external image node.

Definitions must be consistent with how the rest of the docs and the source use
each term — verify against the linked pages / source rather than inventing.

## Read-set

- `docs-site/conformance.md`, `divergences.md`, `guide/engines.md`,
  `guide/geometry.md`, `guide/xdot-drawops.md`, `guide/text-measurement.md`
- `src/api/geometry.ts` (EdgeGeometry `points`, cluster naming)

## Acceptance criteria

- Given the page, then it defines ≥12 terms, alphabetized, each linking to a
  relevant page.
- Given each definition, then it agrees with the linked page / source usage.
- Given `npm run docs:build`, then the page builds and links resolve.

## Observability / Rollback

N/A / Reversible.

## Quality bar

`npm run docs:build` green. Terms consistent with existing docs.

## Boundaries

- **Always:** one definition per term; link to the authoritative page.
- **Never:** contradict conformance/divergence definitions already in the site.

## Commit

`docs(T10): add glossary of graphviz-ts and Graphviz domain terms`
