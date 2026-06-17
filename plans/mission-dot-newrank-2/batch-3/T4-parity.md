# T4 — newrank oracle parity + corpus

## Context

After T2 (dispatch) + T3 (no double-install), `newrank=true` renders. This task
confirms it matches the `dot` oracle and converts the prior mission's residual
test (`src/layout/dot/newrank.test.ts`, currently pinning the WRONG current
output) into oracle-parity pins.

## Task

1. Render the repro via `renderSvg(dot,'dot')`; parse node ellipse `cy`.
2. Assert oracle parity ≤0.5pt: `a≈-178, b≈-106, c≈-106 (= b), e≈-34, d≈-34`.
   Core invariant: `|cy(c)−cy(b)| ≤ 0.5` (c reconciled to b's rank) and `c` is
   NOT at `a`'s rank. (If TS applies a uniform constant offset vs the oracle,
   assert rank-relative structure and document the offset — do not loosen tol.)
3. Replace the RESIDUAL assertions in `newrank.test.ts` (which assert the old
   wrong `c=-178`) with these parity pins. Keep the non-regression checks (no
   `_new_rank`/`__fill_`/anonymous node renders; exactly 5 real nodes; no hang).
4. Add 1–2 more newrank cases to a small corpus (e.g. a 3-cluster rank=same, a
   newrank graph without clusters) and pin each to the oracle ≤0.5pt.
5. If parity is still off, apply at most the remaining faithful fixes within
   AD-3's 3-fix cap, each derived from the C; if the cap is hit, STOP and
   rescope `comparisons/newrank.md` with the residual.

## Write-set

- `src/layout/dot/newrank.test.ts` — flip residual → parity pins + corpus
- (if needed, within AD-3) one more faithful fix file + its test

## Read-set

- `docs/newrank-c-trace.md`
- `src/layout/dot/newrank.test.ts` (current residual pins)
- `comparisons/newrank.md` (prior residual table)
- oracle: `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg/-Tplain`

## Acceptance criteria

- **Given** the repro with `newrank=true`, **then** `c` aligns with `b` (≤0.5pt)
  and all five node centers match the oracle (or rank-relative + documented
  offset).
- **Given** the same graph WITHOUT `newrank`, **then** `c` does NOT align with
  `b` (flag drives the change).
- **Given** the corpus cases, **then** each matches the oracle ≤0.5pt.
- **Given** the 122 goldens, **then** byte-identical.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green; goldens byte-identical.
Commit: `feat(T4): newrank reaches dot oracle parity (cross-cluster rank=same)`.

## Observability / Rollback

N/A. Reversible (revert; newrank-gated, goldens byte-identical).
