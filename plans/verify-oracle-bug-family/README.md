<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: verify-oracle-bug-family — 2471, 1939, 1435, graphs-structs

**Status: NOT STARTED (authored 2026-07-02 by the fix/2796-cluster-ranking
mission; execute with a fresh session).**

## Objective

Apply the 2796 playbook to the remaining diverged corpus ids whose oracle
is in an acknowledged-broken state (`xfail(strict=True)` upstream):
**2471** (init_rank + 6 lost edges — the worst instance), **1939**
(init_rank; MR !4849 target), **1435** (triangulation failure), and
signature-relative **graphs-structs** (oracle loses `struct1->struct3`;
no upstream test). Per the standing policy: do NOT replicate C bugs the
graphviz team has acknowledged but not solved. Per id: (1) review the
upstream issue + any attempted/closing MR (was it resolved? to
satisfaction? — !4849 is draft and perf-contested as of 2026-03); (2)
verify the port's INPUTS to the failing C stage match C's
(right-for-the-right-reason — the 2796 dump recipe:
`.agent-notes/2796-ns-inputs-verification.md`); (3) fix genuine input
defects faithfully, accept the rest with evidence + a comparison page per
id (CLAUDE.md requires one for every accepted/excluded case).

## Key facts carried over (do not re-derive)

- The failing C stage for the init_rank members is the **x-coord aux
  graph** (rank2 call with balance=2), NOT cluster ranking. 2796's
  ranking inputs matched C line-identically; its aux graph diverged in ~10
  cluster-wall edges from `make_lrvn` + `keepout_othernodes`
  (position-cluster.ts:61/:184) — C's version is cyclic, the port's
  acyclic. Open question inherited: which side computes the faithful
  wall-edge lengths (26/24.8 vs 18/18), and does the port's variant
  mislay any CLEAN-oracle graph?
- Sub-ULP FP-print class flagged in make_LR_constraints (30.2 vs
  30.2+3e-15) — watch for int-truncation flips.
- Instrumentation recipe: DUMP-gated rank2-entry constraint dump +
  site-tagged make_aux_edge dump, virtual-name normalization, line diff.
  Revert + rebuild + byte-verify oracle (several of these exit 1 by
  design — verify stdout bytes).
- Upstream refs: issues #2471/#1939/#1435; draft MR !4849; graphviz
  checkout `9d6e3abfd2c7`; xfail decorators in tests/test_regression.py.

## Constraints

Same as fix/2796-cluster-ranking: interactive write-set-expansion asks
(never halt); no bug replication; no per-graph special cases; survey +
rules-gate 0 regressions; ≤2 survey runs; 180s cap (2475_2 canary if
position code changes); comparison page per disposed id.

## Suggested shape (refine at execution)

- B1: per-id upstream review (issue + MRs) → disposition matrix.
- B2: per-id inputs verification at the failing stage (2471 first — it
  also has SIX lost edges, so its aux/corridor inputs matter most).
- B3: fixes for genuine input defects only (asks as needed).
- B4: dispositions (accepted entries + doc sections + comparison pages),
  survey, merge.
