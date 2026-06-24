<!-- SPDX-License-Identifier: EPL-2.0 -->

# D3 — Diff and decide the fix path

## Context

D1 (port) and D2 (C) produced side-by-side counters in `findings.md`. This task
turns numbers into a decision per AD-2.

## Task

1. Build the comparison table in `findings.md`: per input (2108/b100/2471), per
   metric, `C | port | ratio`.
2. Apply the decision rule (AD-2 / `batch-1/overview.md#decision-rule`):
   - **Iteration-count gap** if pass count or per-pass `ncross()` diverges, or
     `accumCross`/`rcross` comparison totals exceed C's by more than the node
     count would explain. Localize the FIRST divergence (e.g. `ncross()` value
     on pass 0 already differs → a crossing-count/tiebreak bug upstream of the
     loop; or same `ncross()` but more passes → convergence test differs).
   - **Per-op constant factor** if all counts match C within noise. Then profile
     `reorderInner`/`accumCross` internals (allocation, `.info` access pattern,
     data-structure complexity vs C's) and name the per-op lever.
3. Write the verdict section in `findings.md`: the chosen path, the target
   function(s), the exact divergence (C value vs port value with line refs), and
   the expected speedup. If the only lever is an algorithm change → record
   "STOP — algorithm change required" and do not start Batch 2.

## Write-set

- `plans/mincross-perf-derisk/findings.md` — the comparison table + verdict.

## Read-set

- `findings.md` (D1+D2 data), `decisions.md#ad-2`, `batch-1/overview.md`
- memory `route-corpus-25-25-g2-mincross` (prior accumCross tiebreak bug:
  crossings counted by geometric port p.x, not port.order/VAL — a known way
  `ncross()` can diverge)

## Acceptance criteria

- **Given** the C+port numbers, **when** D3 finishes, **then** `findings.md`
  ends with a single unambiguous verdict: `iteration-count` (with the first
  divergence localized) | `per-op` (with the named lever) | `STOP`.
- **Given** the verdict, **when** it is `iteration-count` or `per-op` and the
  fix is byte-safe + within the permitted write-set, **then** Batch 2 may
  auto-proceed (human pre-authorized).

## Observability / Rollback

N/A — analysis only.

## Quality bar

The verdict must be falsifiable: it names a function, a divergence, and a
predicted effect that Batch 2 can confirm or refute.
