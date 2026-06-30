<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Diagnosis (gated)

Pin the exact routing stage where the port's dot edge splines first diverge from
C for `nshare-root_twopi`, focusing on the two dominant edges (`311E->312E`,
`280->586E`) and classifying the ~56 sub-2pt residuals. **Ends with a hard STOP**
— report the mechanism artifact and wait for human confirmation before Batch 2.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Instrument C + port edge routing for `311E->312E` and `280->586E`; pin origin (classification vs box/corridor vs fitter vs routing-order) + classify the ~56 residuals (shared-cause vs irreducible noise); write mechanism artifact | debugger | `plans/fix-root-twopi/decision-journal.md` (+ temporary, reverted instrumentation) | — | [x] |

**T1 DONE.** Origin: `maximal_bbox` walls use `Math.round` (half→+∞) vs C
`round` (half away from zero); on negative half-integer walls they differ by 1.
Fix origin = `src/layout/dot/edge-route-faithful.ts` `bboxLeftX`/`bboxRightX`
(4 `Math.round` sites). Controlled experiment drives all 58 diverging edges to
maxΔ 0.0000 (residuals share the cause). Full artifact in `decision-journal.md`.
GATED: STOP before Batch 2.

No parallelism (single task). T1 may add **temporary** tracing to C
(`~/git/graphviz/lib/dotgen/{dotsplines.c,splines.c}`, rebuild via
`make -j4 -C ~/git/graphviz/build gvplugin_dot_layout`) and to port edge-route
files, but must revert all instrumentation before the batch is marked done — the
only durable output is the decision-journal mechanism artifact, and the C binary
must be rebuilt clean.
