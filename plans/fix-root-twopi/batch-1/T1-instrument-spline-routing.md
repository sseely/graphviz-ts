<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Instrument edge routing; pin the root_twopi spline divergence origin

## Context
graphviz-ts is a faithful TypeScript port of C Graphviz; the C source is the spec.
`nshare-root_twopi` (rendered with **dot**, not twopi) diverges only in
edge-spline control points; node positions, ranks, and SVG element counts match
the oracle exactly (see README scouting table and
`.agent-notes/root-twopi-spline-divergence.md`).

The two dominant diverging edges:
- `311E->312E` — maxΔ 21.08; same 7 control points; first bezier segment near
  `311E` differs, then converges to identical points after `36104.59,-464.8`.
- `280->586E` — structural: oracle 4 control points (1 bezier) vs port 7 (2
  beziers); port emits an extra segment.

Both are multi-rank chain edges between grey `*E` skeleton nodes. ~56 other edges
diverge <2pt.

## Task (Tier-1: instrument, enumerate, identify the exact origin)
Determine **where** the port's spline for these edges first departs from C's, and
**why**, for `nshare-root_twopi`. Specifically answer all of:

1. **Edge classification.** How does each dominant edge get classified/routed
   (flat / back / multi-rank forward chain / merged)? Confirm C and port route
   them through the same path. Dump the classized type / virtual chain for both.
2. **Routing boxes / corridor.** For each dominant edge, dump the routing box
   sequence (the corridor the spline is fit through) in C and port. Identify the
   first edge+box where they differ. (Equal boxes ⇒ delta is in the fitter;
   different boxes ⇒ delta is upstream in box construction.) Remove any uniform
   port↔C coordinate offset before comparing (node positions match, so an offset
   normalizes out — see #1213 precedent).
3. **Routing order / recover_slack.** `280->586E`'s extra segment suggests a
   piece-count difference (cf. memory `edge-routing-order-done`,
   `recover-slack-and-c-harness`). Check whether `recover_slack` vnode mutation
   or `edgecmp` routing order changes the corridor this edge reads.
4. **Spline fit.** At the final control points, classify the `311E->312E` delta:
   uniform offset (box delta) vs fitter/parameterization difference (Bézier clip,
   endpoint port, beginslope/endslope, Proutespline renorm).
5. **Residual classification.** For a representative sample of the ~56 sub-2pt
   edges, determine whether they share the dominant cause (would be fixed by the
   same change) or are independent libm/FMA/hypot ULP noise (AD-4 candidates).

## Instrumentation guidance
- C oracle: native dot at `~/git/graphviz/build/cmd/dot/dot` (GVBINDIR=/tmp/ghl);
  source `~/git/graphviz/lib/dotgen/{dotsplines.c,splines.c}`. Add temporary
  `fprintf(stderr,...)` dumps keyed by edge (tail->head name), rebuild
  (`make -j4 -C ~/git/graphviz/build gvplugin_dot_layout`), render, capture.
  **Revert C edits + rebuild after.** (Recipe: memory `recover-slack-and-c-harness`,
  `instrument-c-before-quarantine`; the #1213 mission used the identical harness —
  box/endpoint dump before `routesplines`, `maximal_bbox` neighbor dump.)
- Port: add temporary dumps in `src/layout/dot/{edge-route*.ts,
  edge-route-chain.ts}` (router trace + the `routeChainSegmented` box dump).
  Render via `GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx
  test/corpus/render-one.ts ~/git/graphviz/tests/nshare/root_twopi.gv dot`.
  **Revert all port edits after.**
- The graph is large (1054 nodes); gate every dump by the target edge name so
  output stays readable.

## Write-set
- `plans/fix-root-twopi/decision-journal.md` — append the mechanism artifact.
- Temporary instrumentation in C and port files — **must be reverted** before the
  batch is done (`git diff` clean except the journal, both repos; C rebuilt clean).

## Read-set
- `~/git/graphviz/lib/dotgen/dotsplines.c` (`make_regular_edge`, `maximal_bbox`,
  `rank_box`, `recover_slack`, `edgecmp`), `splines.c` (clip/route)
- `src/layout/dot/edge-route.ts` (dispatch), `edge-route-chain.ts`
  (`routeChainSegmented`, `routeMultiRankEdgeFaithful`, `routeBackEdge`),
  `edge-route-faithful.ts` (`maximalBbox`, `rankBox`), `splines-route*.ts`,
  `common/splines-routespl.ts` (`routeSplines`)
- `.agent-notes/root-twopi-spline-divergence.md` and spline/edge-route memory
  notes (opposing-edge-spline, parallel-corridor, bezier-clip, edge-routing-order,
  recover-slack entries)
- `plans/fix-1213-splines/` — the identical-shape precedent (instrumentation +
  artifact format)

## Architecture decisions in scope
- AD-1 (gated): end with a STOP. AD-2: name the single fix-origin file+line.
- AD-3: the bar is matching C's control points for all 58 edges, so identify what
  makes C produce its spline. AD-4: if a residual traces to an irreducible
  libm/FMA tie-break, STOP and report with a controlled experiment — do not
  silently accept.

## Acceptance criteria (mechanism artifact)
- **Given** instrumented C and port runs, **when** `311E->312E` and `280->586E`
  routing is compared stage-by-stage, **then** the journal states the first stage
  and `file:line` where the splines diverge (classification / boxes / fitter /
  order).
- **Given** the box/fitter comparison, **then** the journal classifies the delta
  as box-construction vs fitter/parameterization vs routing-order, with evidence.
- **Given** the classification, **then** the journal names the single C primitive
  responsible and its corresponding port line (AD-2 fix origin).
- **Given** the ~56 residuals, **then** the journal states whether they share the
  dominant cause or are independent noise (with evidence for a sample).
- **Given** the artifact is complete (Mechanism / Origin `file:line` / Causal
  chain / Ruled-out, per `diagnosis.md`), **then** all temporary instrumentation
  is reverted (`git -C ~/git/graphviz diff` and repo `git diff` show none) and the
  C binary is rebuilt clean.

## Observability requirements
N/A — no new observable runtime operations. The decision-journal artifact is the
deliverable.

## Rollback notes
Reversible. T1 produces only documentation + temporary, reverted tracing.

## Quality bar
Return only the mechanism artifact in the journal (Mechanism, Origin `file:line`,
Causal chain, Ruled-out with evidence). No fix in this task. No preamble.

## Boundaries
- **Always:** revert every temporary edit (C and port) and rebuild C clean.
- **Ask first:** proceeding to any code fix — Batch 1 is gated (AD-1).
- **Never:** apply the fix in T1; never leave C instrumented/rebuilt-dirty; never
  declare a residual "accepted" without the AD-4 controlled experiment + sign-off.

## Commit format
`docs(T1): pin root_twopi spline divergence to <stage>` (decision-journal only;
instrumentation is not committed).
