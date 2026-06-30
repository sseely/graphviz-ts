<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Implement the fix + L→U oracle test

Needs Batch 0 (T0). Write-set = whichever file T0 named as `fixTarget` (expected:
`edge-route-chain.ts`, possibly `edge-route-boxes.ts` / `splines.ts`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Match C's L→U routing; verify L→U conformant + a regression test | (inline/opus) | `bsd-qsort.ts` (new) + `ns.ts:tbSortNodes` + `bsd-qsort.test.ts` | T0 | [x] |

Spec: `T1-fix.md`.
