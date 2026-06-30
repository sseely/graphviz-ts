<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Diagnosis (gated)

Pin the exact routing stage where the port's `constraint=false` edge splines first
diverge from C for `1213-1` (and confirm `1213-2` shares the cause). **Ends with a
hard STOP** — report the mechanism artifact and wait for human confirmation before
Batch 2.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Instrument C + port edge routing for the 3 constraint=false edges; pin origin (classification vs box/corridor vs spline-fit) + confirm 1213-2 shares it; write mechanism artifact | debugger | `plans/fix-1213-splines/decision-journal.md` (+ temporary, reverted instrumentation) | — | [x] |

**T1 result:** Mechanism pinned. Actual count is **5** diverging edges in `1213-1`
(`V0->V2`, `V0->V3`, `V10->V6`, `V10->V7`, `V1->V9`), not 3. Single root cause:
flat-label virtual-node placement order. **Origin = `src/layout/dot/flat.ts:87
flatLimits`** (non-faithful port of `flat.c:104 flat_limits` + `setbounds` +
`findlr`). Stage = **upstream of routing** (mincross-setup vnode ordering), NOT
classification/box/fitter. Box-vs-fitter classified: the corridor `box[2]`
diverges, but only as a *downstream consequence* of the wrong vnode order/position
— the fitter and box-builder are themselves faithful. AD-4 does not apply (not
init_rank). Confirmed on `1213-2`. See decision-journal mechanism artifact.
All instrumentation reverted; both repos `git diff`-clean; C rebuilt clean.

No parallelism (single task). T1 may add **temporary** tracing to C
(`~/git/graphviz/lib/dotgen/{splines.c,dotsplines.c,class2.c}`, rebuild) and to port
edge-route files, but must revert all instrumentation before the batch is marked done
— the only durable output is the decision-journal mechanism artifact.
