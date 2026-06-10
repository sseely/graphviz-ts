# T6 — Verify all osage goldens; residual fixes; merge

## Task
1. Run the suite; all 6 osage goldens must pass. Chase residuals
   (likely candidates: osage-nested multi-level margins, DFLT_SZ empty
   box path, rounding in array cell centering) with targeted fixes in
   src/layout/osage/* only.
2. Update ../baseline-after-m2.md (same format as baseline-after-m1).
3. Update mission 3-8 overviews if any cross-family diff moved.
4. Journal entry; tick mission 2 in ../README.md; update the task
   table in overview.md; merge `feature/parity-m2-osage` into
   `feature/ts-port` with a merge commit.

## Acceptance criteria
- 6/6 osage goldens pass; failure count ≤ 38
- No previously passing test fails; 11 dot goldens green
- tsc --noEmit clean

## Write-set
src/layout/osage/* (residuals only), plans/test-parity/*

## Commit
`chore(plans): re-baseline after mission 2 osage` (+ fix commits as needed)
