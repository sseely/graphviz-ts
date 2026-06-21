# T11 — pack/pathplan follow-on brief scaffold

## Context

ADR-7 deferred `pack` (multi-component packing) and `pathplan` (standalone
shortest-path / spline routing) from this mission. The Graphviz Doxygen public
API lists both as public groups. This task scaffolds the next mission brief so
`/plan-mission` can complete it later — it does NOT implement anything.

## Task

Create `plans/expose-pack-pathplan/README.md` as a brief stub containing:
- **Objective** — expose `pack` and `pathplan` capabilities idiomatically (same
  philosophy as this mission: capability spec = C, shape = idiomatic TS).
- **Open questions** to resolve in planning:
  - Is `pack` reachable today (is multi-component packing implemented internally,
    e.g. `src/...`)? Grep before promoting (cf. memory: "Backlog catalog is
    stale" — verify the stub location before promoting any mission).
  - Is `pathplan` (`src/pathplan/`) usable standalone, or only via the edge
    router? What would a public `routePath(obstacles, start, end)` look like?
  - Consumer demand: does plantuml-js need either, or is this completeness-only?
- **Blast-radius stub** — likely additive, `src/api/` + `src/render/` style.
- **Pointer** — link back to this mission's `decisions.md#adr-7`.

Keep it under 60 lines. Mark status: "Draft — run /plan-mission to complete."

## Write-set

- `plans/expose-pack-pathplan/README.md` (create)

## Read-set

- `plans/expose-library-api/decisions.md` — ADR-7
- `ls src/pathplan` — confirm what exists for the open questions

## Architecture decisions

ADR-7.

## Acceptance criteria

- Given the file, then it states objective, ≥3 open questions, a blast-radius
  stub, and the ADR-7 backlink.
- Given the status line, then it clearly marks the brief as a draft needing
  `/plan-mission`.

## Observability / Rollback

N/A. Rollback: Reversible (plan doc only).

## Quality bar

No code gate (doc only). One commit:
`docs(plans): scaffold pack/pathplan follow-on mission`.
