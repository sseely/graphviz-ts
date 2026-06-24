# Batch 1 — Pin creation-order + anon-id model

Confirm cgraph's anonymous-id model and, crucially, that the port's
object-creation order matches cgraph's (ADR-2). No source-logic changes ship —
only captured oracle dumps and a decision-journal pin.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T0 | **Early impact-confirm (do FIRST):** verify where native `dot -Tsvg` actually emits `agnameof`-derived `%N` — which SVG element(s) (cluster `<title>` only? node/edge titles too?) and how many corpus inputs have anon subgraphs reaching emission. Bounds how many `diverged` verdicts this mission can flip. If the answer is "only cluster `<title>` on a handful of inputs", scope the success bar down accordingly (and confirm with human before investing in Batch 2). | debugger | `plans/anon-subgraph-naming/decision-journal.md` | — | [x] |
| T1 | Oracle dump: for ≥3 sample inputs (incl. a small `cluster=true` extract of 2475_2, a nested-subgraph case, and a `{rank=same}` case), emit each anonymous object's `%N` in cgraph creation order | debugger | `plans/anon-subgraph-naming/probes/**` | T0 | [x] |
| T2 | Port-order pin: list the order the port's `builder.ts` creates root/subgraph/edge objects; diff against T1; record whether the gap is formula-only or also order | debugger | `plans/anon-subgraph-naming/decision-journal.md` | T1 | [x] |

> **Why T0 is first:** `%N` only reaches the SVG via `agnameof` on objects that
> get a `<title>` (clusters do; `{rank=same}` anon subgraphs may not be emitted
> at all). If few inputs surface `%N`, the verdict-flip payoff is small and the
> mission may not be worth Batch 2 — measure before building.

## Notes / how-to

- Oracle: walk objects with `agnameof`. A tiny C probe linking against the build,
  or instrument `lib/cgraph/id.c idmap` to `fprintf` `(objtype, counter, id)` per
  anonymous allocation, then rebuild only what's needed (the id discipline lives
  in `libcgraph`, not the dot plugin — a `make cgraph` + relink of the `dot`
  binary may be required; confirm before assuming the `/tmp/gvplugins` plugin
  recipe applies). Run on the sample inputs.
- Port order: read `src/parser/builder.ts` (`processSubgraph`, statement loop,
  edge creation) and the peggy grammar `src/parser/dot.pegjs` to determine the
  visitation order of `subgraph` vs edge statements and nested subgraphs.

## Exit criteria
- T0 impact estimate recorded: which SVG elements surface `%N` and a count of
  corpus inputs whose verdict this mission could plausibly flip. If that count is
  trivially small, STOP and confirm scope with human before Batch 2.
- Oracle `%N`-per-object dumps exist for ≥3 representative inputs.
- decision-journal records: (a) confirmed `id = 2*counter+1`, shared counter;
  (b) the exact set of object types that advance it (expected: anon root graph,
  anon subgraph, keyless edge); (c) whether port creation order matches cgraph,
  and if not, the precise first divergence.
- If port order cannot match cgraph within `builder.ts` (+1 model file) → STOP.
