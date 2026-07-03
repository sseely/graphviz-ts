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

| ID | Owns bucket | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T4-edge | `edge-path` cases | debugger | `analysis/bucket-edge-path.md` | T3 | [ ] |
| T4-poly | `polygon-points` cases | debugger | `analysis/bucket-polygon-points.md` | T3 | [ ] |
| T4-ellipse | `node-ellipse` cases | debugger | `analysis/bucket-node-ellipse.md` | T3 | [ ] |
| T4-text | `text-position` cases | debugger | `analysis/bucket-text-position.md` | T3 | [ ] |
| T4-other | `other-numeric` + residue | debugger | `analysis/bucket-other-numeric.md` | T3 | [ ] |

File ownership is disjoint (one `bucket-*.md` per agent) → fully parallel. Adjust
the table to the buckets actually present; delete rows for empty kinds.

Each agent follows the shared spec `T4-per-bucket-diagnosis.md`, parameterized by
its bucket. Gate: every referenced case id must exist in `parity.json` and every
family claim must cite `.agent-notes/` or the seed catalog (decisions.md#ad-5).
