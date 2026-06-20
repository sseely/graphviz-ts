<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — shape=point implementation

One task. Sizing, fill, and label suppression are a tightly-coupled unit: the
golden cannot byte-match with any one alone, and existing point tests would
break on a partial state. Kept whole, committed working.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | shape=point: SH_POINT sizing (`nodeinit.ts`) + filled-black + label suppression (`poly-gencode.ts`) | implementation | `src/common/nodeinit.ts`, `src/common/poly-gencode.ts`, the modules' existing `*.test.ts` (check first), and `src/common/poly-inside.ts` ONLY under the AD-5 contingency | — | [ ] |

Execute solo (delicate faithful port; default single-agent).

Gate after batch: `npx vitest run` (all pass), `npx tsc --noEmit` clean,
synthetic repro point-node ellipse byte-matches the oracle (rx 1.8, fill black,
no `<text>`).

- [T1](T1-shape-point.md)
