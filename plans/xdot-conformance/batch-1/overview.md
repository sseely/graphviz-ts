# Batch 1 — xdot conformance harness

Build the seams. **No renderer changes in this batch** — only new dev/test infra
under `test/`. Baseline the walk at the end (record starting pass-count in the
decision journal); do NOT fix anything yet.

## Tasks

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T1 | Render one input to xdot via the port | `test/corpus/render-one-xdot.ts` | — | [x] |
| T2 | Semantic xdot comparator (parseXDot + tolerance) | `test/golden/compare-xdot.ts`, `test/golden/compare-xdot.test.ts` | — | [x] |
| T3 | Walker: conformant set, size-sorted, stop-on-first / `--survey` | `test/corpus/xdot-walk.ts` | T1, T2 | [x] |
| T4 | Dashboard: `PARITY-XDOT.md` from `xdot-parity.json` | `test/corpus/xdot-dashboard.ts` | T3 | [x] |

T1 and T2 write disjoint files with no dependency → run in parallel. T3 needs
both. T4 needs T3's `xdot-parity.json` shape (defined in T3's interface contract).

## Exit criteria
- `npx tsc --noEmit` clean; `npm test` green (compare-xdot.test.ts included).
- `npx tsx test/corpus/xdot-walk.ts` runs end-to-end and reports the **first**
  diverging item (expected: the smallest graph exercising a node/edge — the
  a→b-class bugs from the probe).
- `npx tsx test/corpus/xdot-walk.ts --survey` writes `test/corpus/xdot-parity.json`;
  `xdot-dashboard.ts` writes `test/corpus/PARITY-XDOT.md`.
- Record the baseline pass-count (conformant xdot / 759) in the decision journal.
