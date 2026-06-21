# Mission (DRAFT): Expose pack + pathplan capabilities

**Status: Draft — run `/plan-mission` to complete before executing.**

Follow-on to [`expose-library-api`](../expose-library-api/decisions.md#adr-7),
which deferred `pack` and `pathplan` (ADR-7). Same philosophy: the C library
defines the **capability**; the TS public surface is **idiomatic**, not an
`agpack`/`Pobs` clone.

## Objective

Surface, through the `graphviz-ts/api` + `graphviz-ts/render` entries, two
capabilities that are already implemented internally but unreachable publicly:

- **pack** — multi-component packing (lay out disconnected components, then
  combine into one canvas). Internals exist: `src/layout/pack/array-pack.ts`,
  `src/layout/pack/poly-pack.ts`.
- **pathplan** — standalone shortest-path / spline routing around obstacles.
  Internals exist: `src/pathplan/` (`route.ts`, `shortest.ts`, `solvers.ts`,
  `triang.ts`, `visibility.ts`, `vispath.ts`).

## Open questions (resolve in planning)

1. **pack reachability** — `src/layout/pack/` is implemented; is it invoked by
   any engine today, and what is the public entry shape? A `pack(graphs[],
   opts): Graph` (combine N laid-out graphs) vs a `packMode` option on
   `render`/`getLayout`? Grep the call sites before promoting (cf. memory
   "Backlog catalog is stale" — verify the stub before scoping).
2. **pathplan standalone use** — is `src/pathplan/` usable independently of the
   dot edge router, or only through it? What would a public
   `routePath(obstacles, start, end): Point[]` look like, and which of
   `vispath`/`shortest`/`route` is the right entry?
3. **Consumer demand** — does the primary consumer (plantuml-js, dot-centric)
   need either, or is this completeness-only? Scope/priority follows the answer.
4. **Coordinate + units contract** — reuse `getLayout`'s `yAxis`/points
   conventions (ADR-3/ADR-4) for any geometry these return.

## Blast-radius stub

Expected **additive**: new `src/api/` (pack/pathplan wrappers) + barrel
re-exports, mirroring this mission's structure. No internal-model changes
anticipated; the internals already exist. Single rollback risk is the
`exports` map (already in place).

## Pointer

Parent decision: [`expose-library-api/decisions.md#adr-7`](../expose-library-api/decisions.md#adr-7).
