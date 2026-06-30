<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. Batch 1 (T1) writes the mechanism artifact here
(Mechanism / Origin `file:line` / Causal chain / Ruled-out), which T2 consumes.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-06-30 | pre-mission | Scouting: `nshare-root_twopi` `diverged` (maxΔ ~21) renders with **dot** (manifest `"engine": "dot"`), not twopi — `_twopi` is the source filename. Node geometry exact (1054/1054), SVG element counts identical. Divergence is dot multi-rank edge-spline routing: 2 dominant edges (`311E->312E` 21pt first-segment; `280->586E` structural 4-vs-7) + ~56 sub-2pt residuals. Mechanism UNKNOWN (positions exact → corridor/fitter/routing-order, not a vnode-ordering cascade). Stale `accepted-divergences.json` entry (`scope: rules`, "one edge") to reconcile. See `.agent-notes/root-twopi-spline-divergence.md`. |
