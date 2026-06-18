# Batch 2 — regenerate goldens + per-rank order verification

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T3 | Regenerate churned cluster goldens from the C oracle; full suite green | regenerated goldens, `decision-journal.md` | T2 | [ ] |
| T4 | Per-rank ORDER verification vs C (all reproducers) + 2471 re-test | `decision-journal.md` (summary) | T2, T3 | [ ] |

T3→T4 sequential (shared journal); T4 needs the suite green.

## C oracle recipe

`GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg FILE`, or the
project golden script. Plugin prebuilt at `/tmp/gvplugins`.

## Per-rank order diff (AD-3 — the success bar)

Dump, per rank, the L-to-R node sequence (real nodes by name; virtuals as `_v`)
from BOTH C and TS for each reproducer; diff per rank. This — not crossing count
— is the success predicate. Temporary order probes both sides; revert after.

## Reproducers

`mc3` (minimal stuck), 6-cluster chain (`/tmp/ab_clusters_tb.dot`), and the
ablation cluster variants. Cluster-free / crossing-free graphs must stay
byte-identical.

## 2471 (AD-4)

Re-test. If it renders, record it. If a further divergence surfaces (predicted:
x-coord under clusters) or the mincross perf gap, record as the next mission —
not a failure.
