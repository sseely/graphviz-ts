<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 4 — parallel per-bucket mechanism diagnosis

The auto-buckets (element-kind × magnitude) say *where* the worst diff is; this
batch says *why* — attributing each structural-match case to a known root-cause
family (or flagging it novel), so buckets become fixable missions.

## Fan-out (determined at runtime from Batch 3 output)

The orchestrator **scouts first**: read the regenerated
"Tracked structural-match — by worst-diff signature" table in `PARITY.md`, list
the element-kind buckets present (expected: `edge-path`, `polygon-points`,
`node-ellipse`, `text-position`, maybe `other-numeric`). Then launch **one agent
per element-kind** (magnitude bands stay together under one agent — they share a
mechanism surface). Cap ≈6 agents; if a kind holds >~40 cases, split by magnitude.

Actual fan-out (from the T3 re-survey; 159 tracked structural-match). The 108
`text-position` cases split by NAME family (not magnitude) so one mechanism stays
with one agent; `node-ellipse` (1 case, 2521) folds into edge; `other-numeric` is
empty after the `@points[N]` classifier fix.

| ID | Owns bucket | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T4-textlabel | `text-position` ∧ `label(clust\|root)\|train11\|fsm` (86) | debugger | `analysis/bucket-text-label.md` | T3 | [x] |
| T4-textother | `text-position` ∧ rest (22) | debugger | `analysis/bucket-text-other.md` | T3 | [x] |
| T4-edge | `edge-path` (28) + `node-ellipse` (2521) | debugger | `analysis/bucket-edge-path.md` | T3 | [x] |
| T4-poly | `polygon-points` (14) | debugger | `analysis/bucket-polygon-points.md` | T3 | [x] |
| T4-canvas | `canvas-extent` (12) | debugger | `analysis/bucket-canvas-extent.md` | T3 | [x] |

File ownership is disjoint (one `bucket-*.md` per agent) → fully parallel.

NOTE: the diagnosis agents' `git` commits initially landed via a stray
`main` merge; reconciled by cherry-picking all five bucket commits back onto
this branch and resetting `main` to `origin/main`. See decision-journal.md.

Each agent follows the shared spec `T4-per-bucket-diagnosis.md`, parameterized by
its bucket. Gate: every referenced case id must exist in `parity.json` and every
family claim must cite `.agent-notes/` or the seed catalog (decisions.md#ad-5).
