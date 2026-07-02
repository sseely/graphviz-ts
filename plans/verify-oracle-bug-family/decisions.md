<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decisions — verify-oracle-bug-family

## D1 — Disposition matrix (Batch 1 output, 2026-07-02)

Upstream evidence: local checkout `~/git/graphviz` @ `9d6e3abfd`
(2026-06-10) — all three issue ids carry `@pytest.mark.xfail(strict=True)`
in `tests/test_regression.py` (lines 899/2212/4359). Draft MR !4849
("Avoid adding auxiliary edges that create cycles", targets #1213 #1939
#2796) is still an **open draft**, created 2026-03-17, last edited
2026-03-20 — not merged, not resolved. Old "init_rank"/"bug 2471" fix
commits in history (2014–2016) predate GitLab numbering and are
unrelated.

Oracle = headless native dot (`GVBINDIR=/tmp/ghl`), the survey's
canonical oracle. Port = `render-one.ts <input> dot` at branch HEAD.

| id | upstream state | oracle behavior (headless) | port behavior | B2 requirement |
|---|---|---|---|---|
| **2471** | OPEN, xfail strict. NOT in !4849's target list (same family; reporter of #2796 cites it). | exit 1: `trouble in init_rank` + 6× `triangulation failed`/`Pshortestpath failed` + **6 lost edges** (n204→n32, n207→n33, n207→n42, n231→n3, n232→n3, n288→n30) | **NOT clean**: 9× `Pshortestpath failed` + **9 lost edges** (5 in common with oracle: n207→n33, n207→n42, n231→n3, n232→n3, n288→n30; port-only: n289→n30, n22→n32, n154→n32, n138→n32) | Full 2796 dump (ranking + x-aux). PLUS: the port's 9 lost edges are a first-class question — a clean init_rank solve should not lose MORE edges than the recovery state. Determine whether the port's triangulation failures stem from its own layout inputs (defect) or faithful pathplan limits on this geometry. |
| **1939** | OPEN, xfail strict. Explicit target of draft !4849. | exit 1: `trouble in init_rank` + node dump | **clean** (no errors, all edges) | 2796 playbook verbatim: verify ranking inputs line-identical; pin the x-aux divergence; accept as A4 if faithful-modulo-the-known-wall-edge-variant. |
| **1435** | OPEN, xfail strict. Issue body = non-deterministic subgraph placement; the triangulation test case was attached later (commit 239629eaf, 2024-02-24). | exit 0: `triangulation failed` + `cannot find triangle path` warnings, **no lost edges** | 1× `Pshortestpath failed`, **no lost edges** | No init_rank stage on either side → NS dump only to confirm ranking parity; the real comparison is the spline-router inputs (routing polygons). Both sides degrade in the same class; quantify. |
| **graphs-structs** | No dedicated upstream test. Signature class = record/port routing loss, acknowledged ancient family (#102, #242, #274, #1323). | exit 1: `Pshortestpath failed` (destination point not in any triangle) + **lost struct1→struct3** | **clean** (both edges routed) | Verify router inputs at the equivalent point (record port geometry + routing boxes); if the port's inputs are faithful and only the oracle's estimate-metric geometry trips pathplan, accept as oracle-bug. |

## D2 — Policy restated (inherited, user-set)

Never replicate C bugs the graphviz team has acknowledged but not
solved. Acceptance requires inputs-verification evidence
(right-for-the-right-reason), an accepted-divergences entry, a
known-divergences section, and a comparison page per id.

## D3 — 2471 port-side edge loss gates acceptance

2471 cannot be accepted on the 2796 pattern while the port itself loses
9 edges. Either the losses trace to faithful pathplan behavior on
equivalent inputs (acceptable, documented), or they are a port input
defect (Batch 3 fix). This is the mission's highest-value question.
