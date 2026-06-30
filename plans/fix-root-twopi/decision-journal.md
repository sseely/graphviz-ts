<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. Batch 1 (T1) writes the mechanism artifact here
(Mechanism / Origin `file:line` / Causal chain / Ruled-out), which T2 consumes.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-06-30 | pre-mission | Scouting: `nshare-root_twopi` `diverged` (maxΔ ~21) renders with **dot** (manifest `"engine": "dot"`), not twopi — `_twopi` is the source filename. Node geometry exact (1054/1054), SVG element counts identical. Divergence is dot multi-rank edge-spline routing: 2 dominant edges (`311E->312E` 21pt first-segment; `280->586E` structural 4-vs-7) + ~56 sub-2pt residuals. Mechanism UNKNOWN (positions exact → corridor/fitter/routing-order, not a vnode-ordering cascade). Stale `accepted-divergences.json` entry (`scope: rules`, "one edge") to reconcile. See `.agent-notes/root-twopi-spline-divergence.md`. |
| 2026-06-30 | T1 (reboot recovery) | Session rebooted mid-T1; prior background agent dead, no mechanism artifact written → T1 incomplete. Verified both repos clean of spline instrumentation (only pre-existing `.serena/cache/` line in C `.gitignore`, left as-is). `/tmp/ghl` was wiped by reboot; rebuilt via `gen-headless-gvbindir.sh` (oracle smoke-test = 1083 paths, OK). Re-launched T1 debugger agent (id `ae09666f082adda01`) with the full T1 spec + prior finding. Still GATED: stop and report mechanism before Batch 2 (AD-1). |
| 2026-06-30 | T1 (inline rerun) | T1 redone inline (prior background agent died twice on reboot; ran in main session for incremental journaling + gate control). Cleanup: the dead agent had left behaviour-neutral `fprintf`/`process.stderr.write` instrumentation in `lib/dotgen/dotsplines.c` (44 lines, `DIAG`), `src/layout/dot/edge-route-chain.ts` (`TSDIAG`) — reverted; clean-rebuild oracle is **byte-identical** to the instrumented oracle (proves all probes were behaviour-neutral). **MECHANISM ARTIFACT below.** |

## T1 mechanism artifact (gated — STOP here per AD-1; no fix committed)

**Mechanism.** `nshare-root_twopi`'s 58 diverging edges all share ONE cause:
the port computes `maximal_bbox` box walls with JS `Math.round()`, which rounds a
half-integer **toward +∞**; C's `maximal_bbox` uses libm `round()`, which rounds
**half away from zero**. This graph routes in a frame with large **negative**
x-coords, so any wall landing on a negative half-integer (`X.5`) diverges by 1:
`Math.round(-30823.5) = -30823` but `round(-30823.5) = -30824` (verified both in
node and against the C oracle). The 1-unit-too-high (less-negative) left wall
perturbs the `Pshortestpath` corridor and the `Proutespline` fit.

**Origin (`file:line`).** `src/layout/dot/edge-route-faithful.ts`:
`bboxLeftX` lines **155, 162** and `bboxRightX` lines **171, 178** —
`Math.round(...)`. C spec: `lib/dotgen/dotsplines.c:maximal_bbox` lines
**2191, 2193, 2212, 2214** — `round(b)` / `fmin(round(b), sp.LeftBound)` /
`fmax(round(b), sp.RightBound)`. AD-2 fix origin = those 4 port call sites
(single file). Precedent helper already in repo:
`src/layout/pack/poly-place.ts:28` (`/** C round(): half away from zero. */`).

**Causal chain (instrumented, both sides, same frame).**
- Probe of the `routesplines_` choke point (C `lib/common/routespl.c:routesplines_`;
  port `src/common/splines-routespl.ts:routeSplinesInternal`) dumped boxes / start
  / end / shortest-path `pl` / fitted `spl` per target edge.
- `311E->312E`: every input identical EXCEPT box[0] (the begin maximal_bbox) —
  C `LL.x=-30824`, port `-30823`. Same `pl` (1 bend at the box[2] corner
  `-31065,464.8`, the shared knot). The 1px-wider box[0] lets `routeSpline` pull
  the FIRST control point: C `(-31009.16,516.93)` vs port `(-31037.08,490.86)` →
  21.08pt maxΔ. Second bezier (knot→head) byte-identical both sides.
- `280->586E`: every input identical EXCEPT box[2] (a vnode maximal_bbox) —
  C `LL.x=-46709`, port `-46708`. The straight start→end line sits at
  x≈-46708.5 at that rank: C wall -46709 **clears** it → `pl` straight (2 pts) →
  `spl` 1 bezier (4 pts); port wall -46708 **blocks** it → `pl` bends (3 pts) →
  `spl` 2 beziers (7 pts). This is the 4-vs-7 structural delta.

**Classification.** Box-construction (upstream of the fitter), NOT fitter /
parameterization / routing-order. With `pl` and all other boxes identical, the
sole lever is the one box wall; `Pshortestpath` and `Proutespline` are faithful.

**Residuals — share the dominant cause (NOT independent noise).** Controlled
experiment: swap the 4 `Math.round` → C-faithful round-away-from-zero (only
those sites), re-render the full graph. Full-SVG per-edge diff vs the byte-clean
oracle: **baseline 58 diverging (maxΔ 21.08) → experiment 0 diverging
(maxΔ 0.0000)**. All ~56 sub-2pt residuals are the same 1px wall perturbation
producing smaller fitter drift on other chain edges. No AD-4 libm/FMA residual
remains. (Experiment reverted; nothing committed.)

**Ruled out (with evidence).** Edge classification — both edges route the same
multi-rank forward chain (identical boxn=5, same start/end). Routing order /
`recover_slack` — `pl`, start, end, and all non-divergent boxes are identical
pre-fix, so no shared-vnode displacement is involved. `Pshortestpath` /
`Proutespline` — identical inputs give identical outputs; feeding the C-faithful
wall reproduces the C `pl`/`spl` exactly. X-frame fraction — `shiftAllXcoords`
already rounds (node positions exact, 1054/1054). Independent libm/FMA — the
experiment drives ALL 58 edges to 0.0000.

**State at gate.** Both repos clean (C: only pre-existing `.gitignore`; port:
no instrumentation). C plugin rebuilt clean; oracle byte-identical to the probed
oracle. Ready for Batch 2 T2 (apply the 4-site fix) + T3 (full survey gate +
parity baseline). STOPPING per AD-1.
