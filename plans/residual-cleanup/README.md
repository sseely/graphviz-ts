<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: residual cleanup (5 tracked ids + scoped-in 2620)

**Objective.** Drive the endgame's 5 residuals (1949, 1453, 2646, 2371,
1447_1 — plus 2620 scoped into the ortho family) to conformant or
documented-irreducible acceptance. Build on the fresh evidence in
[../structural-match-endgame/analysis/](../structural-match-endgame/analysis/)
— do not re-derive. Baseline snapshot: conformant 749, tracked 5 (396792c).

**Decisions.** Inherit [endgame decisions](../structural-match-endgame/decisions.md)
D1-D4 + amendments WHOLESALE (user-approved 2026-07-05): bounded pass before
acceptance; split diag→fix; diag agents worktree-isolated, docs returned as
final messages; one registry writer per batch; ask-to-expand write-sets;
per-batch survey gates on an idle box; maxΔ=0.0 timeout = standalone-verify,
not regression; NEVER rebuild the dot binary; revert C + rebuild /tmp/ghl
with byte-verification; checkpoint-first when resuming dropped agents.

**Quality gates per batch** (same as endgame README, incl. snapshot refresh
after pass): tsc → vitest → survey (idle, LPT) → rules-gate 0 regressions.

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — R1 check + R2-R5 diagnoses (parallel, docs-only) | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — R6-R10 outcomes (one registry writer: R6) | [x] | [batch-2/overview.md](batch-2/overview.md) |
| 3 — R11 closeout | [x] | [batch-3/overview.md](batch-3/overview.md) |

[decision-journal.md](decision-journal.md) · analysis/ (diag outputs) ·
[diagrams/component-map.md](diagrams/component-map.md)

Model routing: R4/R5 fable; rest sonnet; opus only if an outcome needs a
multi-path call. Rollback: everything Reversible (squash commits, registry
entries removable). Observability: SLIs = corpus metrics; dashboard = PARITY.md.

## Mission summary (closed 2026-07-05)

**Result: conformant 749 → 752; tracked residual set 5 → 0** (all driven to
conformant or documented acceptance). structurally-equal 768/789 (97.3%);
timeout 1 (2621 — native C itself >300s, out of scope).

| id | outcome |
|---|---|
| 1447_1 | **CONFORMANT** — three fixes: Apple-libc qsort semantics (+heapsort fallback), addPEdges parallel-precedence port (ortho.c:918), gcell bb from ND_coord/ND_xsize + CHANSZ exact |
| 1453 | **CONFORMANT** — medians restructured to C's two loops (unconditional case-0 mval reset, mincross.c:1643) |
| 2475_2 | **CONFORMANT** (bonus — moved by batch-2 fixes, was pre-existing diverged) |
| 2371 | **accepted → A3** (findMaxDev/hypot mirror tie, qualified origin) |
| 2646 | **accepted → A8 (new class)** — clang/arm64 -ffp-contract FMA knife-edge tangency in Proutespline; port == strict-IEEE C, proven bit-exact both directions |
| 1949 | fixed ×2 (virtualNode agnode invariant; getmainedge flat grouping) — stays structural-match at maxΔ36.67: the C-correct grouping EXPOSES a pre-existing makefwdedge lead-edge normalization gap (follow-up below) |
| 2620 | **split** — dominant Δ is dot position-phase (±898pt y, 78 nodes), upstream of ortho; needs its own diagnosis mission |

**Tasks:** 11 planned (R10 collapsed into R6), 10 executed, 0 stopped.
**Gates:** batch-2 survey green (1 improvement beyond targets; sole flag =
1652 marginal-timeout, standalone-verified PASS 0-diff). vitest 2683 green,
tsc clean. **Agents:** 5 diagnosis (fable/sonnet, worktree-isolated) + 4 fix
(sonnet); 2 API drops recovered via checkpoint-first resume.

**Follow-up candidates (user decision):**
1. makefwdedge forward-normalization in splines-flat.ts flat-adj aux
   pipeline, coordinated with 241_0 swap behavior (prior mission
   plans/fix-1949-flat-aux found the naive fix regresses 241_0) — closes
   1949's remaining residual.
2. 2620 dot position-phase diagnosis (±898pt y-shift signature, 78-node
   census in R4 transcript).
3. 1447 (Δ192.39) — fourth, distinct ortho mechanism, byte-untouched by
   the R4/R9 fixes.
