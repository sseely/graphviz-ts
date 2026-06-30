<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: root-cause and fix `1213-1` / `1213-2`

## Objective

`1213-1` and `1213-2` are `diverged` in the parity survey (maxΔ ~20–22, firstDiff
an edge `path/@d`). Pre-mission investigation proved the divergence is **purely
`constraint=false` edge-spline routing** — node positions, ranks, clusters, and 14
of 17 edges match the oracle byte-for-byte. Root-cause the exact routing stage where
the port's splines for the non-constraint edges depart from C, apply a faithful
(C-spec-matching) fix, and restore both cases to conformant / structural-match with
**zero net parity regressions**.

## Confirmed diagnosis (pre-mission)

Node positions are **identical** to the oracle (same viewBox 507×238, same clusters).
Only three edges diverge in their spline control points — all `constraint=false`:

| edge | attr | oracle C1 (sample) | port C1 (sample) |
|---|---|---|---|
| `V0->V2` | constraint=false | `58.52,-119.74 68.1,-122.81` | `58.24,-120.05 67.94,-123.1` |
| `V0->V3` | constraint=false | `58.92,-119.07 68.35,-122.24` | `58.26,-119.99 67.95,-123.05` |
| `V1->V9` | label=b, constraint=false | `290.66,-140.23 273.64,-160.44` | `288.74,-140.31 269.75,-161.33` |

**Red herring:** the C oracle exits 1 with `Error: trouble in init_rank` (the unfixed
upstream xfail #1213 — `ns.c:171`, a cycle leaves `ctr != N_nodes`; the port's
`initRank` at `ns.ts:56` omits that counter/error). This does **not** affect geometry:
C limps along and lands on the identical node layout. The mission is an edge-spline
routing fix, **not** a ranking or init_rank fix. Do not chase init_rank.

**Not yet pinned (Batch 1's job):** which routing stage produces the control-point
delta — edge classification of `constraint=false` edges, the box/corridor
construction, or the spline fitter — and whether `1213-2` shares the exact cause.

Subsystem: `src/layout/dot/edge-route*.ts` (+ `splines*.ts`, `classify.ts`); C spec
`~/git/graphviz/lib/dotgen/{splines.c,dotsplines.c,class2.c}`. Full finding:
`.agent-notes/1213-constraint-false-spline-divergence.md`.

## Branch

`fix/1213-constraint-false-splines` (merge commit on completion — preserves per-task
commit IDs).

## Constraints

**This is a faithful port.** The C source is the spec (project `CLAUDE.md`). Do not
optimize, simplify, or rewrite the routing algorithm. The fix must mirror C behavior
at the divergence origin. The oracle's init_rank error is incidental — the emitted C
SVG is the reference; treat it as a normal diverged case.

### Stop conditions
- Batch 1 finishes → **STOP and report the mechanism** before any fix (gated).
- Matching C's spline requires reproducing C's init_rank-degraded state (i.e. the
  geometry delta genuinely traces back to the ranking error, not a routing bug) —
  stop and re-scope (would change the mission from routing to faithful-error-repro).
- The fix improves 1213 but regresses any currently-conformant case.
- Any file outside the declared write-set needs changing.
- 2 consecutive quality-gate failures on the same check; or the same line changed 3×
  without resolving the same failure.

### Push-forward conditions
- Choosing which edge-route file holds the fix, once Batch 1 pins the origin.
- Test phrasing, instrumentation details, decision-journal wording.
- Stylistic choices with no behavioral effect.

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npx vitest run src/layout/dot` | exit 0 | fix_and_rerun |
| `npm run survey && npm run survey:gate` | exit 0 (no regressions) | stop |
| `1213-1` + `1213-2` re-rendered | the 3 constraint=false splines match oracle | stop |
| `git diff --name-only` | matches declared write-set only | stop |

Parity baseline refresh recipe (Batch 2, T3): `npm run survey` (writes
`parity-rules.json`) → `npm run survey:gate` (must be 0 regressions) →
`cp test/corpus/parity-rules.json test/corpus/parity.json` →
`npm run survey:dashboard` (regenerates `PARITY.md`).
Note: `npm run survey`/`survey:gate`/`survey:dashboard` may need `npx tsx` directly if
a bare `tsx` is not on PATH (`GVBINDIR=/tmp/ghl GV_TEXT_MEASURER=estimate npx tsx
test/corpus/survey.ts`, etc.).

## Batches

| Batch | Status | Tasks |
|---|---|---|
| [Batch 1 — Diagnosis (gated)](batch-1/overview.md) | [x] | T1 |
| [Batch 2 — Fix + verify](batch-2/overview.md) | [ ] | T2, T3 |

## Index

- [decisions.md](decisions.md) — architecture decisions
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-instrument-spline-routing.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-apply-faithful-fix.md) · [T3](batch-2/T3-regression-test-and-baseline.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior finding: `.agent-notes/1213-constraint-false-spline-divergence.md`
