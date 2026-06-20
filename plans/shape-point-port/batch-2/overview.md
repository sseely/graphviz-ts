<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — golden + parity verification

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Add shape=point golden; regenerate parity; verify 0 verdict regressions | implementation | `test/golden/inputs/dot-point-shape.dot`, `test/golden/refs/dot-point-shape.svg`, `test/golden/manifest.json`, `test/golden/suite.test.ts`, `test/corpus/PARITY.md`, `test/corpus/parity.json` | T1 | [ ] |

Gate after batch: golden passes at `deterministic`; suite count bumped
(131→132); per-id parity deltas vs baseline show IMPROVED>0, REGRESSED==0; full
`npx vitest run` + `npx tsc --noEmit` clean.

- [T2](T2-goldens-parity.md)
