<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Implement the fix + ldbxtried oracle test

Needs Batch 0 (T0). Write-set = whichever file T0 named as `fixTarget` (expected:
a `mincross*.ts` cluster-ordering file, possibly `position*.ts` / `ns.ts`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Match C's ldbxtried horizontal layout; verify node X conformant + a regression test | (inline/opus) | T0's `fixTarget` file + a `*.test.ts` | T0 | [x] |

**Done.** `cluster.ts:interclexp` now iterates `[...n.outEdges(g), ...n.inEdges(g)]`
(C `agfstedge` order). All 13 node X conformant (±0 vs oracle); rank y=-38 order
matches C; `compareSvg` pass=true; ldbxtried whole-SVG golden un-skipped + green.
New `src/layout/dot/cluster-ldbxtried-xorder.test.ts` (sensitive: fails pre-fix).
tsc=0, full unit suite 2512/2512.

Spec: `T1-fix.md`.
