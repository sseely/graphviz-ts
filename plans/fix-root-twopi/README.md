<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: root-cause and fix `nshare-root_twopi`

## Objective

`nshare-root_twopi` is `diverged` in the parity survey (maxΔ ~21, dot engine).
Despite the `_twopi` filename it renders with **dot**. Node geometry is exact
(1054/1054) and SVG element counts match; the divergence is **dot multi-rank
edge-spline routing**, dominated by two edges (`311E->312E` 21pt; `280->586E`
structural 4-vs-7 segments) plus ~56 sub-2pt residuals. Root-cause the exact
routing stage where the port's splines depart from C, apply a faithful
(C-spec-matching) fix, and restore the case to **conformant** (all edges within
±0.01) with **zero net parity regressions**.

## Confirmed scouting (pre-mission)

Node positions, ranks, clusters, and SVG element-type counts are identical to
the oracle. Two dominant diverging edges:

| edge | symptom | shape |
|---|---|---|
| `311E->312E` | maxΔ **21.08** — first bezier segment near `311E` differs, converges after the 2nd control point | same 7 points, multi-rank |
| `280->586E` | **structural** — oracle 4 ctrl points (1 bezier) vs port 7 (2 beziers) | different point count, multi-rank |

Both are multi-rank chain edges between grey `*E` skeleton nodes. ~56 other
edges diverge <2pt. Full finding: `.agent-notes/root-twopi-spline-divergence.md`.

**Not yet pinned (Batch 1's job):** the routing stage (edge classification, box/
corridor construction, the spline fitter, or routing order / `recover_slack`
vnode mutation) where the splines first depart, and whether the ~56 small
residuals share the dominant cause or are independent libm/FMA noise.

Subsystem: `src/layout/dot/{edge-route*.ts, edge-route-chain.ts, splines*.ts}`;
C spec `~/git/graphviz/lib/dotgen/{dotsplines.c, splines.c}`.

## Branch

`fix/root-twopi-splines` (merge commit on completion — preserves per-task
commit IDs).

## Constraints

**This is a faithful port.** The C source is the spec (project `CLAUDE.md`). Do
not optimize, simplify, or rewrite the routing algorithm. The fix must mirror C
behavior at the divergence origin.

### Stop conditions
- Batch 1 finishes → **STOP and report the mechanism** before any fix (gated).
- The fix would require editing a second routing source (AD-2 violation).
- A residual genuinely traces to an irreducible cross-platform libm/FMA/hypot
  tie-break (cf. accepted A1/A3) — **stop and report** with a controlled
  experiment isolating the variable; do not force a fake match or silently
  accept without sign-off.
- The fix improves `root_twopi` but regresses any currently-conformant case.
- Any file outside the declared write-set needs changing.
- 2 consecutive quality-gate failures on the same check; or the same line changed
  3× without resolving the same failure.

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
| `nshare-root_twopi` re-rendered | all 58 diverging edges match oracle within ±0.01 | stop |
| `git diff --name-only` | matches declared write-set only | stop |

Parity baseline refresh recipe (Batch 2, T3): `npm run survey` (writes
`parity-rules.json`) → `npm run survey:gate` (must be 0 regressions) →
`cp test/corpus/parity-rules.json test/corpus/parity.json` →
`npm run survey:dashboard` (regenerates `PARITY.md`). If the fix changes the
case's accepted status, also reconcile `test/corpus/accepted-divergences.json` +
`rules-known-divergences.md` / `docs/known-divergences.md` (the
`accepted-divergences.test.ts` guard pairs list edits with prose).
Note: use `npx tsx ...` if a bare `tsx` is not on PATH (`GVBINDIR=/tmp/ghl
GV_TEXT_MEASURER=estimate npx tsx test/corpus/survey.ts`, etc.).

## Batches

| Batch | Status | Tasks |
|---|---|---|
| [Batch 1 — Diagnosis (gated)](batch-1/overview.md) | [x] | T1 |
| [Batch 2 — Fix + verify](batch-2/overview.md) | [x] | T2, T3 |

## Index

- [decisions.md](decisions.md) — architecture decisions
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-instrument-spline-routing.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-apply-faithful-fix.md) · [T3](batch-2/T3-regression-test-and-baseline.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior finding: `.agent-notes/root-twopi-spline-divergence.md`
- Reference precedent: `plans/fix-1213-splines/` (same diagnosis-first shape)
