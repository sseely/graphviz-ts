<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: follow-up residuals (post residual-cleanup)

**Objective.** Close the three follow-ups documented in
[../residual-cleanup/README.md](../residual-cleanup/README.md) mission
summary. Baseline: conformant 752 (b58878c).

| ID | Case | Task | Model | Status |
|---|---|---|---|---|
| F1 | 1949 (maxΔ36.67) | makefwdedge lead-edge forward-normalization in flat-adj aux; find C's discriminator (naive fix regresses 241_0); diag+fix | fable | [ ] |
| F2 | 2620 (diverged, Δ3207) | diagnose dot POSITION-phase defect (±898pt y on 78/237 node glyphs), upstream of ortho; docs-only | fable | [x] fix (mincross transpose gates) |
| F3 | 1447 (719 diffs, Δ192.39) | diagnose fourth ortho mechanism (byte-untouched by qsort/addPEdges/gcell fixes); docs-only | fable | [x] fix (Courier LUT, not ortho) → F4 done 3504e0d |

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
