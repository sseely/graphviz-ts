<!-- SPDX-License-Identifier: EPL-2.0 -->

# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-23 | plan | Spike-first brief; fix file unknown until S1 localizes. Scope = under-segmentation class; D5 governs the rankdir_dot rows (flip if same class, else document + report). | Routing order already matches C (`edge-spline-routing`, `465b24a`); the residual is corridor/segmentation. User chose "whole class must flip" — encoded as required-if-same-class with a separate-residual escape (D5). Prior art: `plans/edge-spline-routing/`, memory `edge-routing-order-done`. |
| 2026-06-23 | S1 | Localized: NOT box-corridor/smode (brief premise wrong) and NOT the fitter (premise on `route.ts` holds). Root cause = `normalizeXcoords` (position.ts) shifting node x by a non-integer delta (`coord.x − lw`), putting routing in a non-integer frame off C's integer frame by +138.36728; `maximal_bbox`'s faithful `round()` then straddles boundaries → perturbed `Pshortestpath` pl → fitter flips 4→3. | Instrumented C (`/tmp/gvplugins`) + port; `.probes/isolate.mjs` proved port-pl→3 / C-pl→4 (pl is the lever, fitter faithful); all chain nodes share fractional `.36728` (uniform offset). Pinned to C: C does not normalize here (its own comment said "no-op in C") and routes in integer x. |
| 2026-06-23 | T2 | Fix = `shiftAllXcoords(g, Math.round(minX))` in `normalizeXcoords`. Folded into S1 per brief (≤3-line obvious fix pinned to C). | Keeps routing frame integer (C invariant); fraction washes out in postprocess translate so final node positions unchanged. End-to-end: p3 `sleep--runmem` 3→4, full p3 geometry conformant to oracle. |
| 2026-06-23 | T3 | Survey: conformant 282→297, **0 per-id regressions**, 18 improvements (incl. `graphs-p3` diverged→conformant — hard floor met; pm2way/process/b36/awilliams families flipped forward). | Per-id diff vs `main` parity.json (`/tmp/pdiff.mjs`). Exceeds D4 floor (≥281, 0 regr). |
| 2026-06-23 | T3/D5 | rankdir_dot/dot2 (4 rows) stay diverged — the x-axis fix does NOT resolve them (LR-rotation/other-axis residual); classified SEPARATE class, documented in `comparisons/rankdir-classification.md`, NOT chased (D3). | Nodes conformant (not the label-height layout residual); single-edge piece flip survives the x-frame fix, so a different residual blocks them. Hard floor (p3 + 0 regr) is independent of these. |
