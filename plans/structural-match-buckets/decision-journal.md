<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal — structural-match buckets

Appended during execution. Every non-trivial judgment call gets a row.

| when | batch/task | decision | rationale |
|---|---|---|---|
| plan | — | Cluster on element-kind × magnitude; capture `maxDeltaPath` in survey; parallel per-bucket diagnosis | User confirmed all three recommended options |
| T2 | fix | Extend `structuralKind` `@points` regex to allow `[N]` index | T3 sanity check found all 14 `polygon-points` cases mis-bucketed as `other-numeric` |
| T3 | — | Re-survey provably additive: 0 verdict/maxDelta changes, gate regressions=0 | maxDeltaPath is inert to the gate; baseline locked in |
| T4 | fix | Split `text-position` (108) into `text-label` (86) + `text-other` (22) by name family, not magnitude | Keeps one mechanism (labelclust/labelroot) in one agent; magnitude split would fragment it |
| T4 | recover | A diagnosis agent merged the feature branch into `main` + committed the 5 bucket files there | Merge was local-only (origin/main unchanged). Cherry-picked all 5 bucket commits back onto `feature/structural-match-buckets`; `git reset --hard origin/main` on `main`. No content lost; branch discipline restored |
