# T2 — Measure C's opposing/parallel routing recipe

> **STATUS: DONE via pre-mission spike (2026-06-17).** The recipe was captured by
> instrumenting the C `make_regular_edge`/`clip_and_install` and is recorded in
> `decision-journal.md` → "T2 spike recipe — C opposing/parallel routing (for
> T3)". The remaining task spec below is retained for provenance; no further work
> needed before T3. Key result: C routes back members via `makefwdedge` +
> `clip_and_install` + a separate `edge_normalize`/`swap_spline` pass — NOT by
> reversing the base (the DOT-1 mistake).

## Context

DOT-1 left an unresolved puzzle: reversing a shared *forward* base does NOT
reproduce dot's opposing `b→a` geometry. For `digraph{a->b; b->a}` (a at cy=-90,
b at cy=-18), the dot oracle gives:
- a→b: `M21.12,-72.05 C20.33,-64.57 20.08,-55.58 20.37,-47.14` (left, arrow at b)
- b→a: `M32.86,-35.79 C33.66,-43.25 33.92,-52.24 33.64,-60.69` (right, arrow at a)

The two edges span DIFFERENT y-ranges, not reverses of each other. AD-2 chose to
mirror C's shared-base model — so T3 needs the exact recipe. This task produces
it. **No production code** (measurement/study only).

## Task

1. Read C `make_regular_edge` cnt>1 section (`dotsplines.c` ~1877-1908) and
   `makefwdedge`, and `clip_and_install` + the `swapEnds`/`getsplinepoints`
   handling in `lib/common/splines.c`. Determine precisely how the shared base
   (routed for `fe`), the per-member interior x-shift, `makefwdedge` for BWDEDGE
   members, and `clip_and_install(e, aghead(e), …)` combine to yield the opposing
   `b→a` geometry above.
2. Confirm whether opposing edges are one group in C (`getmainedge`) or routed
   separately, and how the TS `swapEndsP`/`swapSpline` pass must interact with
   `clipAndInstall` to reproduce it (the DOT-1 double-reversal trap).
3. Optionally instrument with a throwaway probe (delete before commit) to confirm
   the model against the oracle.
4. Write the **recipe** into `decision-journal.md`: point order of the shared
   base, which member clips to which node, where `makeFwdEdge` applies, and the
   exact swapEnds/swapSpline sequence T3 must use.

## Write-set

- `plans/mission-dot-1b/decision-journal.md` — the recipe table/notes

## Read-set

- `decisions.md#ad-2`; DOT-1 journal T6 (the failed attempts + geometry data)
- `~/git/graphviz/lib/dotgen/dotsplines.c:make_regular_edge`, `makefwdedge`
- `~/git/graphviz/lib/common/splines.c:clip_and_install`, `getsplinepoints`
- `src/layout/dot/splines.ts` (`swapEndsP`, `swapSpline`),
  `src/common/splines-clip.ts` (`clipAndInstall`, `arrowClip`, swap handling)

## Interface contract (consumed by T3)

A decision-journal section "T3 recipe" stating: (a) one shared base for the
group's forward representative; (b) per-member interior x-shift formula; (c) how
back members use `makeFwdEdge` + which end clips; (d) the swapEnds/swapSpline
ordering so back members are reversed exactly once.

## Acceptance criteria

- **Given** the study, **then** the journal explains how C's shared base +
  makefwdedge yields the opposing `b→a` (-35.8→-60.7), reconciling DOT-1's failed
  reverse attempt.
- **Given** the recipe, **then** it is concrete enough for T3 to implement without
  re-deriving (point order, clip ends, swap sequence).

## Quality bar

No code change (or a probe deleted before commit); gates unaffected.
Commit: `docs(T2): measure C opposing/parallel routing recipe`.

## Observability / Rollback

N/A — documentation only. Reversible.
