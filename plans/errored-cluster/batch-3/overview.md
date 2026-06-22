<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — Verify + finalize

Depends on Batch 1 + 2.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T5 | Regenerate parity, 0-regression check, finalize journal + memory | `test/corpus/parity.json`, `test/corpus/PARITY.md`, `decision-journal.md`, project memory (+ MEMORY.md pointer) | T1, T2, T3, T4 | [ ] |

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; `errored` dropped by the
number of fixed cases; **0 per-id regressions**; every fixed case's verdict
recorded; any case that lands `diverged` (ADR-4) has its new first-diff noted.
