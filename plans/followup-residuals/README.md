<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: follow-up residuals (post residual-cleanup)

**Objective.** Close the three follow-ups documented in
[../residual-cleanup/README.md](../residual-cleanup/README.md) mission
summary. Baseline: conformant 752 (b58878c).

| ID | Case | Task | Model | Status |
|---|---|---|---|---|
| F1✓ | 1949 (maxΔ36.67) | makefwdedge lead-edge forward-normalization in flat-adj aux; find C's discriminator (naive fix regresses 241_0); diag+fix | fable | [x] CONFORMANT (b51dab5) |
| F2✓ | 2620 (diverged, Δ3207) | diagnose dot POSITION-phase defect (±898pt y on 78/237 node glyphs), upstream of ortho; docs-only | fable | [x] fix (mincross transpose gates) → F5 done 606e1c2 |
| F3✓ | 1447 (719 diffs, Δ192.39) | diagnose fourth ortho mechanism (byte-untouched by qsort/addPEdges/gcell fixes); docs-only | fable | [x] fix (Courier LUT, not ortho) → F4 done 3504e0d |

**Decisions.** Inherit residual-cleanup / endgame decisions WHOLESALE
(D1-D4 + amendments): worktree-isolated agents; diag docs returned as final
messages; per-batch survey gate on idle box; maxΔ=0.0 timeout =
standalone-verify; NEVER rebuild the dot binary; revert C instrumentation +
rebuild /tmp/ghl plugins with byte-verification; checkpoint-first resume;
one registry writer if any acceptance results.

Batch 1 = F1+F2+F3 parallel (F1 writes src in its worktree; F2/F3
docs-only; C instrumentation on disjoint files: F1 dotsplines.c, F2
position/rank files, F3 lib/ortho — leave sibling instrumentation intact).
Batch 2 = outcomes (fixes/registry per verdicts) + ONE survey gate +
closeout.

## Mission summary (closed 2026-07-05)

**Result: conformant 752 → 754; all three follow-ups closed** (two to
conformant, one lifted diverged→structural-match). structurally equal
770/789 (97.6%). timeout 1 (2621 only).

| id | outcome |
|---|---|
| 1447 | **CONFORMANT** — F3 refuted the "fourth ortho mechanism": it was a truncated Courier width LUT (124/128 entries; `{ | } ~` silently measured 0). F4 completed CW + Consolas CR/CBI + faithful Nunito italic; added a 128-length guard over ALL_FONT_METRICS |
| 1949 | **CONFORMANT** — F1 ported make_flat_edge's makefwdedge lead-normalization (lead pair tail = lower ND_order) — the feared 241_0 swap conflict dissolved because the `:N` edge becomes a forward aux clone as in C — plus the stale-symbol aux arrowsize quirk (aux dict re-declaration makes E_arrowsz read a color string; C's strtod fails to 1.0) |
| 2620 | **diverged → structural-match (maxΔ585)** — F2 found the "position-phase" defect was really mincross: transpose_step must gate in-crossings on r>0 and out-crossings on GD_rank[r+1].n>0 (allocate_ranks over-allocates maxrank+2, so a cluster's bottom-rank exit crossings are ignored). F5's 2-line gate removed all 78 node-order diffs; the remaining 423-diff/Δ585 residual is now pure edge-path (ortho), a separate follow-on |

**Tasks:** 5 (3 diagnosis fable + F4/F5 sonnet fixes; F1 diag+fix combined).
**Gate:** survey green, 2 improvements beyond the flagged 1652 marginal-timeout
(standalone-verified PASS 0-diff). vitest 2733 green, tsc clean.
**Agents:** one monitor-stall (F5) recovered by nudging it to poll directly;
its commit was already clean.

**New backlog item:** 2620's residual (423 diffs / maxΔ585) is now a pure
ortho edge-routing divergence — measurable for the first time since the maze
input matches C. Candidate for a future ortho-corridor diagnosis.
