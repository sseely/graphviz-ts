<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Instrument edge routing; pin the constraint=false spline divergence origin

## Context
graphviz-ts is a faithful TypeScript port of C Graphviz; the C source is the spec.
`1213-1`/`1213-2` diverge only in the spline control points of three
`constraint=false` edges; node positions, ranks, and 14/17 edges match the oracle
exactly (see README diagnosis table and
`.agent-notes/1213-constraint-false-spline-divergence.md`). The C oracle emits
`Error: trouble in init_rank` (unfixed xfail #1213) but still produces the matching
node layout — **the init_rank error is a red herring; do not chase it** (AD-4).

The three diverging edges (1213-1):
- `V0->V2` (constraint=false)
- `V0->V3` (constraint=false)
- `V1->V9` (label=b, constraint=false)

## Task (Tier-1: instrument, enumerate, identify the exact origin)
Determine **where** the port's spline for these `constraint=false` edges first departs
from C's, and **why**, for `1213-1`. Specifically answer all of:

1. **Edge classification.** How does each edge get classified/routed? `constraint=false`
   edges do not constrain ranks but are still drawn. Confirm both C and port route them
   through the same path (flat? back? chain across ranks?). Dump the edge's classized
   type / virtual-chain in both. Identify if the port classifies any of the three
   differently from C.
2. **Routing boxes / corridor.** For each diverging edge, dump the routing box sequence
   (the corridor the spline is fit through) in C and port. Identify the first edge+box
   where they differ. (Equal boxes ⇒ the delta is in the fitter; different boxes ⇒ the
   delta is upstream in box construction.)
3. **Spline fit.** At the final control points, compare C vs port. Record whether the
   control-point delta is a uniform offset (box delta) or a fitter/parameterization
   difference (e.g. Bézier clip, endpoint port, beginslope/endslope).
4. **1213-2 parity.** Confirm `1213-2` (same topology, cluster-renamed S*/H*) diverges
   on the analogous edges and via the same stage. Note if it differs.

## Instrumentation guidance
- C oracle: native dot at `~/git/graphviz/build/cmd/dot/dot` (GVBINDIR=/tmp/ghl);
  source `~/git/graphviz/lib/dotgen/{splines.c,dotsplines.c,class2.c}`. Add temporary
  `fprintf(stderr,...)` dumps keyed by edge (tail->head name), rebuild
  (CMake: `make -j4 -C ~/git/graphviz/build dotgen gvplugin_dot_layout`, then the
  /tmp/ghl dylib updates), render `tests/1213-1.dot`, capture. **Revert C edits +
  rebuild after.** (Recipe used by the shells mission; see memory
  `recover-slack-and-c-harness`, `instrument-c-before-quarantine`.)
- Port: add temporary dumps in `src/layout/dot/edge-route*.ts` / `splines*.ts` /
  `classify.ts`. Render via `GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx
  test/corpus/render-one.ts ~/git/graphviz/tests/1213-1.dot dot`. **Revert all port
  edits after.**
- The C oracle exits 1 but still writes the SVG to stdout before aborting; capture
  stdout for the reference. Ignore the init_rank stderr.

## Write-set
- `plans/fix-1213-splines/decision-journal.md` — append the mechanism artifact.
- Temporary instrumentation in C and port files — **must be reverted** before the batch
  is done (`git diff` clean except the journal).

## Read-set
- `~/git/graphviz/lib/dotgen/splines.c`, `dotsplines.c`, `class2.c` (edge routing,
  box construction, spline fitting for non-constraint/cross/back edges)
- `src/layout/dot/edge-route.ts`, `edge-route-chain.ts`, `edge-route-faithful.ts`,
  `edge-route-routing.ts`, `edge-route-boxes.ts`, `edge-route-clip.ts`,
  `splines-clone.ts`, `classify.ts`
- `.agent-notes/1213-constraint-false-spline-divergence.md` and spline/edge-route
  memory notes (e.g. opposing-edge-spline, parallel-corridor, bezier-clip entries)

## Architecture decisions in scope
- AD-1 (gated): end with a STOP. AD-2: name the single fix-origin file+line.
- AD-3: the bar is matching C's control points, so identify what makes C produce its
  spline, not just "a valid spline". AD-4: do not reproduce the init_rank error; if the
  delta traces to it, STOP and re-scope.

## Acceptance criteria (mechanism artifact)
- **Given** instrumented C and port runs on 1213-1, **when** the three constraint=false
  edges' routing is compared stage-by-stage, **then** the journal states the first stage
  and `file:line` where the splines diverge (classification / boxes / fitter).
- **Given** the box/fitter comparison, **then** the journal classifies the delta as a
  box-construction divergence vs a fitter/parameterization divergence, with evidence.
- **Given** the classification, **then** the journal names the single C primitive
  responsible and its corresponding port line (AD-2 fix origin).
- **Given** `1213-2`, **then** the journal confirms it shares the cause (or documents
  the difference).
- **Given** the artifact is complete (Mechanism / Origin `file:line` / Causal chain /
  Ruled-out, per diagnosis.md), **then** all temporary instrumentation is reverted
  (`git -C ~/git/graphviz diff` and repo `git diff` show none) and the C binary is
  rebuilt clean.

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
- **Never:** apply the fix in T1; never leave C instrumented/rebuilt-dirty; never chase
  the init_rank error as the geometry cause without evidence (AD-4).

## Commit format
`docs(T1): pin 1213 constraint=false spline divergence to <stage>` (decision-journal
only; instrumentation is not committed).
