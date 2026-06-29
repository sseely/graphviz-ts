<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Implement the order fix + verify blok_60

Needs Batch 0 (T0). Write-set is whichever NS file T0 named as `fixTarget`
(expected: `ns-subtree.ts`, possibly `ns-core.ts`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Match C's subtree-merge add order; verify blok_60 → 611.38 + b51 geom | (inline/opus) | `ns-subtree.ts` (and/or `ns-core.ts`) + a unit test | T0 | [ ] |

Spec: `T1-fix-order.md`.
