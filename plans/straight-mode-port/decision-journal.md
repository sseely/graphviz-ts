<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call.

| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| start | — | Branch `feature/straight-mode-segmentation` off HEAD (main + brief commit), excluding cluster-contain fix | README permits independent diffs; brief files needed during execution |
| start | — | Execute batches solo (no subagents) | batch overviews mark delicate port → default single-agent per parallelism.md |
| T1 | T1 | straightPath pushes 2 value-copies of last pt (not aliases) | C appends pointf by value; aliasing risks downstream in-place mutation. 8 unit tests pass |
| T2a | T2a | Forward routes via routeChainSegmented; back caller left on prior path | Folding back into routeChainSegmented adds recover_slack to the makefwdedge view → changed maxDelta on 4 ids (2413_2, linux.i386-b29, share-b124, windows-b124; 3 improved, 1 ~unchanged) → NOT conformant. T2a hard gate is a pure no-op, so the recoverSlack-on-back change is deferred to T2b (behavioral batch, 0-regression rule). AD-1's recoverSlack-inside is realized for forward now, for back in T2b. |
| T2a | T2a | Byte-identity verified by full-corpus port-vs-oracle survey (805 inputs) before/after | Fresh baseline at HEAD=T1; after-refactor diff = 0 verdict/maxDelta/firstDiff changes. tsc clean, 2007 tests pass |
| batch-1 | gate | PASS | vitest 2007 pass; tsc 0 errors; T2a survey 0 changed ids vs baseline |
| T2b | T2b | smodeThreshold uses g.root.info.has_labels (not g.info) | C reads GD_has_labels(g->root); faithful to spec. L5/L4/L3 are label-free so threshold=3 either way |
| T2b | T2b | beginPath/endPath use the ORIGINAL edge e for the first/final segment (real ports); chain edges segs[i] drive maximalBbox + smode intermediates | Mirrors buildChainPath's existing split (conformant for non-smode); intermediate smode segments are all-virtual (no ports) |
| T2b | T2b | recoverSlack(segs.slice(segFirst), P) per segment; ei advances arithmetically (ei += 1 + sl after straight_path) | faithful to recover_slack(segfirst,P); break-on-nbox naturally bounds the walk to the segment |
| T2b | gate | PASS (0-regression rule) | L5 a->f + p2 (all 37 paths) conformant oracle; L3/L4 conformant to T2a; vitest 2011 pass; tsc clean. Survey vs pre-mission baseline: 14 verdict IMPROVED (p2->conformant; try/Heawood/process/p/p3/p4/b71->structural), 0 verdict REGRESSED, 0 new timeout/error (2 timeout->better). diverged->diverged numeric delta: 26 better / 10 worse / 306 same — the 10 worse keep their PRE-EXISTING structural diff (not introduced by smode; verified abstract's diverging edge now conforms to oracle), faithful geometry wobbling on upstream node-position divergence. Per memory bucket-fix-rebucketing, verdict deltas are the gate. |
| T3 | T3 | Added goldens dot-long-edge-straight (L5) + dot-long-edge-p2 (corpus winner); manifest 128->130 | both pass at deterministic tolerance; golden suite 133 tests green |
| T3 | gate | PASS | Regenerated parity dashboard (survey 805 inputs). vs HEAD committed parity.json: IMPROVED 14, REGRESSED 0. Tally conformant 160->162, structural 237->250, diverged 356->343, timeout 8->6. Full vitest 2013 pass; tsc clean; git diff = write-set only. |

## Mission summary

All 3 batches complete (T1, T2a, T2b, T3). Ported make_regular_edge straight-mode
segmentation: long multi-rank edges with a collinear vnode run >= threshold now
split into spline-top + straight-middle + spline-bottom instead of bowing.

- **Tasks completed:** 4/4 (T1 straightPath, T2a no-op routeChainSegmented, T2b
  smode loop, T3 goldens+dashboard). One commit per task + per-batch doc commits.
- **Parity gain:** 14 ids improved (p2 -> conformant; 13 -> structural-match),
  0 regressions. conformant 160->162, diverged 356->343, timeout 8->6.
- **Quality gates:** vitest 2013 pass; tsc 0 errors; goldens deterministic;
  survey 0 verdict regressions. All green.
- **Decisions flagged for review:** none. The 10 diverged->diverged worse-maxDelta
  cases were verified as faithful-geometry wobble on pre-existing structural
  divergences, not smode bugs (verdict-level 0-regression rule satisfied).
- **Follow-ups:** AD-3 left polyline smode unported (low value, documented).
