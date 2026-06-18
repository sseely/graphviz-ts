# Batch 2 — verify faithfulness + regenerate goldens

After T1, prove the fix matches C and bring goldens to C ground truth.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T2 | Regenerate churned clustered goldens from the C oracle; full suite green | regenerated golden files, `decision-journal.md` | T1 | [ ] |
| T3 | Ablation sweep + 2471 root-rank STATS == C; final report | `decision-journal.md` (summary) | T1, T2 | [ ] |

T2→T3 sequential (shared journal). T3 depends on T2 so the full suite is green
before the final faithfulness sweep.

## C oracle recipe

`GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg FILE` (or the
project's golden-generation script) emits C ground truth. Plugin is prebuilt at
`/tmp/gvplugins/libgvplugin_dot_layout*.dylib`.

## Ablation reproducers (must all MATCH C on nranks/totalNodes)

`/tmp/ab_*.dot` (regenerate via `/tmp/gen_ablation.py` if absent): plain TB/RL,
HTML-only, self/multi-edge (already matched pre-fix); clusters ±HTML ±RL (must
now match: C 24r/54n). Compare with `/tmp/abl_compare.sh`.

## 2471 target (AD-3)

Root mincross-entry STATS must == C: **23 ranks / 3213 vnodes**. Full render is
OUT of scope (separate mincross perf gap) — record, don't treat as failure.
