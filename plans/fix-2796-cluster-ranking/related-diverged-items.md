<!-- SPDX-License-Identifier: EPL-2.0 -->
# Diverged corpus items related to the 2796 oracle-bug family (2026-07-02)

Method: every pre-existing `diverged` corpus id rendered through the
headless oracle; stderr grepped for the failure signatures; upstream
status read from graphviz's own `tests/test_regression.py` decorators
(local checkout `9d6e3abfd2c7`).

## The acknowledged-open upstream family (`xfail(strict=True)`)

| id | oracle stderr signature | upstream status | notes |
|---|---|---|---|
| **2471** | `trouble in init_rank` + **6×** `triangulation failed`/`Pshortestpath failed` + **6 lost edges** | **xfail #2471** | The worst instance; reporter of #2796 cites it. Project memory `2471-blocker-is-cluster-ranking` predates this finding — its "cluster ranking" framing should be re-read as this aux-cycle family. |
| **1939** | `trouble in init_rank` | **xfail #1939** | Explicit target of draft MR !4849 (with #1213, #2796). |
| **1435** | `triangulation failed` | **xfail #1435** | Pathplan triangulation debris without the init_rank stage. |
| *(2796)* | init_rank + lost `3->16` | **xfail #2796** | Disposed this mission (accepted; inputs verified). |

Related by signature, no upstream xfail:
- **graphs-structs** — oracle loses `struct1->struct3` (`Pshortestpath
  failed`); no dedicated upstream test. Same pathplan-loss class; upstream
  fixed-or-never-filed status unknown.
- **1367** — oracle prints an overlap warning but upstream `test_1367`
  passes; probably NOT this family (keep in the general backlog).
- **1213** — in MR !4849's target list, but our corpus `1213-1`/`1213-2`
  are already **conformant** — no action.

Everything else in the diverged list (1436, 1447, 1581, 1718, 1879, 1880,
2183, 2239, 2475_2, 2521, 2619_1/2, 2620, 2825, graphs-b15/b51/b69/
decorate/user_shapes) renders with a CLEAN oracle stderr — those are
ordinary port gaps, not this family.

## Policy (user-set, this mission)

Do not replicate C bugs the graphviz team has acknowledged but not
solved. For each family member: verify the port's INPUTS to the failing
C stage match (right-for-the-right-reason), review the upstream issue +
any closing/attempted MR for how (and whether) it was resolved to
satisfaction, then either fix a genuine port input defect or accept with
evidence. Follow-up mission: `plans/verify-oracle-bug-family/`.
