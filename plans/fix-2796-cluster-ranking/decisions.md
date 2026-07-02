<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (pre-made; REDUCED SCOPE user-approved 2026-07-02)

## D1 — Verify, then accept (recovery-state porting is OFF the table)

Upstream #2796 is an open bug (`xfail(strict=True)`, commit `6da78b364`;
reporter links #2471) whose only fix attempt is draft MR !4849 (aux-edge
cycle detection for #1213/#1939/#2796; perf-contested; unmerged). The port
already meets every expectation in the issue (0 overlapping cluster pairs
vs C's 5; 213/213 edges routed; silent NS) — measured on the comparison
page. The user decided (2026-07-02): do NOT port C's error-recovery layout
for byte-conformance; it replicates an acknowledged bug and unwinds when
any form of !4849 lands.

Outcomes:
1. **Inputs match** → dispose of 2796 as an accepted divergence, new
   evidence-backed class ("oracle lays out from an acknowledged-broken
   init_rank recovery state; upstream xfail #2796, draft !4849, cf.
   #2471"), linked to the comparison page. No src changes.
2. **Inputs diverge** → the INPUT defect (not the recovery state) is the
   fix target — faithful, at the origin, expansion asks as usual. Fixing
   it likely matters for the still-diverged cluster family (2471, 2475_2,
   b51). 2796's own disposition afterwards is still outcome 1 unless the
   input fix happens to change the picture (re-measure; journal).

"Verdict forced without a mechanism" is not an outcome. No 2796 special
cases; never fake C's diagnostic.

## D2 — The verification question (T1's single deliverable)

Does the constraint graph the port feeds network simplex during cluster
ranking match C's? Compare, line-wise via env-gated dumps (`DUMP2796`,
mirrored both sides): the cluster collapse/leader sets, the aux/constraint
edge list (endpoints, minlen, weight) handed to rank2/NS, and which of
those edges C's init_rank flags as unscanned. The verdict must be stated
either way with the diff evidence attached. This is the
right-for-the-right-reason check: a clean port solve from DIFFERENT inputs
would be accidental and could silently mislay other cluster graphs.

## D3 — Method + hygiene (unchanged from prior missions)

C-first differential dumps; C tree instrument → revert → rebuild →
byte-verify oracle stdout (2796's exit 1 + stderr is its normal state).
Write-set expansion = interactive ask (denial = document-and-halt for that
locus). One commit per mechanism if Batch 2 runs.

## Operational notes

- Rollback: **Reversible** (branch `fix/2796-cluster-ranking`, merge
  commit, revert-only).
- SLIs: T1 inputs verdict; full vitest; survey + rules-gate vs committed
  HEAD (0 regressions) — survey needed only if Batch 2 ran or the JSON/doc
  disposition changes verdict inputs (guard tests decide); watch gate only
  if Batch 2 ran (same set as planned: b53, 1767, 1221, 2721, 2471,
  2475_2, 1332, NaN ×3 + picks; 2475_2 = perf canary).
- Budget: ≤1 full survey run (2 only if a Batch-2 gate fix forces a rerun).
- Backwards compat: none if inputs match (metadata/docs only).
