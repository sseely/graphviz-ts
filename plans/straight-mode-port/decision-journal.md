<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call.

| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| start | — | Branch `feature/straight-mode-segmentation` off HEAD (main + brief commit), excluding cluster-contain fix | README permits independent diffs; brief files needed during execution |
| start | — | Execute batches solo (no subagents) | batch overviews mark delicate port → default single-agent per parallelism.md |
| T1 | T1 | straightPath pushes 2 value-copies of last pt (not aliases) | C appends pointf by value; aliasing risks downstream in-place mutation. 8 unit tests pass |
| T2a | T2a | Forward routes via routeChainSegmented; back caller left on prior path | Folding back into routeChainSegmented adds recover_slack to the makefwdedge view → changed maxDelta on 4 ids (2413_2, linux.i386-b29, share-b124, windows-b124; 3 improved, 1 ~unchanged) → NOT byte-identical. T2a hard gate is a pure no-op, so the recoverSlack-on-back change is deferred to T2b (behavioral batch, 0-regression rule). AD-1's recoverSlack-inside is realized for forward now, for back in T2b. |
| T2a | T2a | Byte-identity verified by full-corpus port-vs-oracle survey (805 inputs) before/after | Fresh baseline at HEAD=T1; after-refactor diff = 0 verdict/maxDelta/firstDiff changes. tsc clean, 2007 tests pass |
| batch-1 | gate | PASS | vitest 2007 pass; tsc 0 errors; T2a survey 0 changed ids vs baseline |
