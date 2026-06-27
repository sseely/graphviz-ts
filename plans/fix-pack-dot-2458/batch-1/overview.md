# Batch 1 — Investigate

Single read-only task (probes reverted). Pins the exact wiring + the T2/T3
write-sets and the cluster oracle before any code changes. De-risking gate: if the
fix locus is outside `index.ts` + a new `pack-components.ts`, **stop**.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Pin pack-branch wiring (initSubg need, ccomps aliasing, doSplines/mode, cluster carry) + find a clustered multi-component oracle | debugger (Sonnet) | `plans/fix-pack-dot-2458/comparisons/T1-investigation.md` | — | [x] |

Output of T1 feeds T2 (core wiring, packCall params, initSubg need) and T3
(cluster-carry shape, oracle case).
