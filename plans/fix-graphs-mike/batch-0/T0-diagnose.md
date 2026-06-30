<!-- SPDX-License-Identifier: EPL-2.0 -->
# T0 — Diagnose the L→U edge-spline divergence

## Context
graphviz-ts is a faithful C→TS port; `~/git/graphviz` is the spec. On
`graphs/mike.gv` the port routes edge **L→U** as an over-segmented spline (14
points, start `M397.09,-504.12`) where C uses one cubic (8 points, start
`M387.79,-434.5`); maxΔ 72.12. Counts and bbox match, so this is pure edge
geometry. K→L (maxΔ 72.1, shares node L) is almost certainly downstream of L→U.

## Task
Find the FIRST point where the port's routing of L→U diverges from C, and name
the exact C rule + the port locus to fix. Determine which layer diverges:
1. **Virtual-node chain span** — does L→U cross the same ranks / same number of
   virtual nodes in both? (a different span → different piece count)
2. **Box corridor** — are the routing boxes (per-rank) the same? (`edge-route-
   boxes.ts` vs `dotsplines.c` boxes)
3. **recover_slack / routing order** — does vnode placement differ before
   routing? (see `.agent-notes/edge-routing-order`, `lone-edge-recoverslack`)
4. **Fitter piece count** — given identical boxes, does the spline fitter emit a
   different number of beziers? (`splines.ts` / `edge-route-chain.ts`)

## Read-set
- `.agent-notes/long-edge-undersegment*.md`, `edge-routing-order*.md`,
  `lone-edge-recoverslack*.md`, `dot-splines-reverification.md` (prior art)
- C: `~/git/graphviz/lib/dotgen/dotsplines.c` (`make_regular_edge`,
  `place_portlabel`/box build, `completeregularpath`), `lib/common/routespl.c`
  (`Proutespline` / piece emission)
- Port: `src/layout/dot/edge-route-chain.ts`, `edge-route.ts`,
  `edge-route-boxes.ts`, `edge-route-rank.ts`, `splines.ts`, `splines-route.ts`

## Method (paired instrumentation — proven technique)
1. Instrument C: gated `getenv("MIKEDBG")`, dump for edge L→U the routing boxes
   (count + LL/UR), the vnode chain (ranks spanned), and the emitted Bezier
   piece count. Rebuild: `touch lib/dotgen/dotsplines.c && make -C build
   gvplugin_dot_layout`; refresh `sh test/corpus/gen-headless-gvbindir.sh`.
2. Instrument the port the same way (MIKEDBG env) at the matching points.
3. Render both:
   - C: `MIKEDBG=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/graphs/mike.gv`
   - port: `MIKEDBG=1 GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/mike.gv dot`
4. Diff box-by-box / piece-by-piece; locate the first divergence; read the C
   decision there vs the port's.
5. **Revert ALL probes** (C `git checkout` + rebuild; port `git checkout`) before
   finishing. Leave both trees `git diff`-clean.

## Acceptance (Given/When/Then)
- Given mike L→U, when C vs port routing is compared, then the first divergent
  stage is identified (boxes / chain span / order / fitter) with both values.
- Given that divergence, when the C path is read, then the exact C rule (named
  function + comparison/loop) producing C's result is documented.
- Given the finding, then Batch 1's write-set is named precisely
  (`<file>::<function>`).

## Output (interface for T1)
Append to `.agent-notes/graphs-mike-LtoU-routing.md`:
`{ divergentStage: "boxes|chainSpan|order|fitter", cValue, portValue,
   cRule: "<fn + comparison>", fixTarget: "<file>::<function>" }`.

## Boundaries
- **Never** leave instrumentation in C or port (both `git diff`-clean at finish).
- **Ask first / stop** if the divergence is NOT in edge-spline routing — e.g. it
  traces to node x-placement (x-coord NS) or mincross order. That changes scope.
- Diagnosis only — no port logic edits in this task.

## Observability / Rollback
N/A — diagnostic task, no runtime behavior, no commit beyond the agent-note.

## Quality bar
Return only the structured finding (the Output block) + the one-line fixTarget.
No code changes committed except the agent-note.
