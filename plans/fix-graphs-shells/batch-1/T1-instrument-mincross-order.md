<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Instrument mincross order; pin the divergence origin

## Context
graphviz-ts is a faithful TypeScript port of C Graphviz; the C source is the
spec. `graphs-shells` diverges only in within-rank left-right order on three
`rank=same` flat groups (see README diagnosis table and
`.agent-notes/graphs-shells-flat-order-divergence.md`). Ranks all match. The
subsystem is dot mincross.

## Task (Tier-1: instrument, enumerate, identify the exact origin)
Determine **where** the port's within-rank order first departs from C's, and
**why**, for the shells graph. Specifically answer all of:

1. **Init vs iteration.** Dump the per-rank L-R order at each stage in BOTH C and
   port: after initial order (build/install ranks), and after each mincross
   iteration (medians + transpose). Identify the first stage at which the three
   flat ranks' order differs. (Does the seed already differ, or do they agree at
   init and diverge during optimization?)
2. **Crossing-count parity.** At the final order, record total crossing count for
   port vs C. Equal count ⇒ tie-break/stability bug; port count higher ⇒ genuine
   heuristic miss. Also record the count for C's order *as evaluated by the port's
   crossing function* (rules out a counting-function divergence).
3. **Flat-edge handling.** The three diverging ranks are flat groups. Check
   whether `mincross-flat.ts` flat-order enforcement (or its C analog
   `flat_order`/`flat_rank`) participates — i.e. is the order set by flat
   constraints or by generic median/transpose?
4. **Tie-break primitive.** If it is a tie-break: pin the exact C comparison
   (`<` vs `<=` in transpose's improvement test, the `reverse`/`Reverse` flag,
   `local_cross`/`medianvalue` equal-value handling, or the best-order capture
   `if (ncross < bestcross)` boundary) and the corresponding port line.

## Instrumentation guidance
- C oracle: native dot at `~/git/graphviz/build/cmd/dot/dot`; source
  `~/git/graphviz/lib/dotgen/mincross.c`. Add temporary `fprintf(stderr,...)`
  order dumps keyed by rank, rebuild (`ninja -C ~/git/graphviz/build` or the
  project's usual build), render shells, capture. Memory note
  `recover-slack-and-c-harness.md` / `instrument-c-before-quarantine.md` describe
  the C-instrument workflow. **Revert C edits + rebuild after.**
- Port: add temporary dumps in `src/layout/dot/mincross.ts` /
  `mincross-order.ts` / `mincross-flat.ts`. Render via
  `GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts
  ~/git/graphviz/graphs/directed/shells.gv dot`. **Revert all port edits after.**
- Reproduce the symptom first: the scratchpad already has port/oracle SVGs and a
  `compareSvg` script from pre-mission diagnosis; re-derive if needed.

## Write-set
- `plans/fix-graphs-shells/decision-journal.md` — append the mechanism artifact.
- Temporary instrumentation in C and port files — **must be reverted** before the
  batch is done (`git diff` clean except the journal).

## Read-set
- `~/git/graphviz/lib/dotgen/mincross.c` (mincross_step, transpose, medians,
  build_ranks, flat_order, install_in_rank, the iteration/best-capture loop)
- `src/layout/dot/mincross.ts`, `mincross-order.ts`, `mincross-flat.ts`,
  `mincross-cross.ts`, `mincross-build.ts`, `mincross-utils.ts`
- `.agent-notes/graphs-shells-flat-order-divergence.md` and mincross-related
  memory notes (ncross/mincross entries in MEMORY.md)

## Architecture decisions in scope
- AD-1 (gated): end with a STOP. AD-2: name the single fix-origin file+line.
- AD-3: the fix bar is matching C's order exactly, so identify what makes C pick
  its order, not just "an equal-cost order".

## Acceptance criteria (mechanism artifact)
- **Given** instrumented C and port runs on shells, **when** per-rank orders are
  compared stage-by-stage, **then** the journal states the first stage and
  `file:line` where the three flat ranks' order diverges.
- **Given** the final orders, **when** crossing counts are compared, **then** the
  journal records port-count, C-count, and C-order-under-port-counter, and
  classifies the bug as tie-break vs heuristic-miss.
- **Given** the classification, **then** the journal names the single C primitive
  responsible and its corresponding port line (AD-2 fix origin).
- **Given** the artifact is complete (Mechanism / Origin / Causal chain / Ruled
  out, per diagnosis.md), **then** all temporary instrumentation is reverted
  (`git -C ~/git/graphviz diff` and repo `git diff` show no instrumentation) and
  the C binary is rebuilt to its clean state.

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
- **Never:** apply the fix in T1; never leave C instrumented/rebuilt-dirty.

## Commit format
`docs(T1): pin graphs-shells flat-order divergence to <stage>` (decision-journal
only; instrumentation is not committed).
