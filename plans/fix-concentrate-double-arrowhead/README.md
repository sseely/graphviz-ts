<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: fix concentrate `conc_opp_flag` double-arrowhead

## Objective

Port the `ED_conc_opp_flag` branch of C's `arrow_flags` (lib/common/arrows.c)
into the TypeScript `arrowFlags`. When `concentrate=true` merges an anti-parallel
edge pair (`A->B; B->A`) into one surviving edge, that edge must be drawn with an
arrowhead at **both** ends. The port currently draws only one, and — because the
second arrowhead is absent — leaves the spline unclipped at that end, so the edge
`@d` also diverges. One fix repairs both symptoms.

## Why this is the next thing (from PARITY.md)

In the `element-count` divergence bucket, the largest single shared root cause is
this bug. Verified port-vs-oracle on `graphs-b135` (`digraph{concentrate=true;
A->B; B->A}`): the *only* difference is one missing black arrowhead polygon plus
the unclipped spline. Same signature confirmed on `167` and `2087`.

## Expected impact

| Input | Current | After fix |
|---|---|---|
| `graphs-b135` | diverged (childCount) | byte-match (target) |
| `167` | diverged (childCount) | byte-match / structural |
| `2087` | diverged (childCount) | byte-match / structural |
| `2825`, `1453` | diverged (childCount) | improved → structural/byte |
| `graphs-b15`, `graphs-b69` | diverged | improved; **retain** a separate known x-coord residual (see [[b69-concentrate-undermerge]]) |

`2361` (concentrate **over**-draw — IGNORED back-edges leaking as extra paths) is
a distinct sub-bug and is **out of scope** for this mission.

## Branch

`fix/concentrate-double-arrowhead` (off `main`).

## Constraints

**Stop conditions** — halt and record in `decision-journal.md`:
- Any file outside the declared write-set needs changes.
- Two consecutive survey/test-gate failures on the same check.
- The fix regresses any currently byte/structural-matching corpus input
  (survey 0-regression rule) and the cause is not immediately obvious.
- `graphs-b135` does not reach byte-match after the fix AND the residual is not a
  pre-existing, separately-documented divergence.

**Push-forward** (decide and log, don't stop):
- Whether to add `167` as a second golden alongside `b135` (recommended yes).
- Wording of any `known-divergences` note for the b15/b69 x-coord residual.
- Minor helper placement/naming inside `splines-clip.ts`.

## Quality gates

Run between/after tasks. Definitions in `batch-1/overview.md`.
- `npm run typecheck` → exit 0
- `npm test` → exit 0 (golden suite green; new `b135` golden passes)
- `npm run survey && npm run survey:dashboard` → **0 regressions**; target inputs
  flip as predicted above.

## Batches

| Batch | Tasks | Status |
|---|---|---|
| [batch-1](batch-1/overview.md) | T1 fix+golden, T2 survey-verify | [x] |

## Index

- [decisions.md](decisions.md) — architecture decisions (pre-made)
- [batch-1/overview.md](batch-1/overview.md)
- [batch-1/T1-arrowflags-conc-opp.md](batch-1/T1-arrowflags-conc-opp.md)
- [batch-1/T2-survey-verify.md](batch-1/T2-survey-verify.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)
