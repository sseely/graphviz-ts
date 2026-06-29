# Mission: reconcile FLATORDER enforcement (weight-0 + build_ranks install order)

## Objective

The `fix-ordering-mincross` mission corrected ordering-constraint **construction**
(virtual edges now inherit `AGSEQ(orig)`, so `do_ordering_node` builds the right
FLATORDER edges). A SEPARATE divergence remains in how those constraints are
**enforced** into the final in-rank order. C and the port use different
enforcement models:

- **C:** FLATORDER edges are **weight-0** (`new_virtual_edge(u,v,NULL)` leaves
  `ED_weight` at calloc-0). Both `constraining_flat_edge` (weight==0 → false) and
  `flat_search` (`if (ED_weight(e)==0) continue;`, mincross.c:1093) **skip** them.
  C orders the rank via `build_ranks` BFS install order (`enqueue_neighbors`
  walking `ND_out`), NOT via `flat_reorder`.
- **Port:** `newVirtualEdge(u,v,null)` sets `weight=1` (and count/xpenalty/minlen=1),
  so the port's `flat_reorder`/`flat_search` treat FLATORDER as a constraining
  flat edge and reorder by it.

Make the port enforce `ordering` the way C does — faithfully reproducing C's
build_ranks install-order enforcement with weight-0 FLATORDER edges — clearing the
ordering graphs still diverged after the construction fix, WITHOUT regressing the
492+ byte-match graphs (now 493) or the node-order already corrected on b58.

## Reproducer (pinned facts, from the prior mission)

`~/git/graphviz/tests/graphs/b58.gv` (graph-level `ordering=out`). After the
construction fix, b58 nodes **1,2,4,5,7 match C exactly** (node 7 places 5 left of
4). The residual is the **middle rank {6,8,7} and node 3**:

- **C:** `6:45, 8:117` (order `6,8,7`) — 6 left of 8, from node 3's `ordering=out`
  (`3->6` then `3->8` → FLATORDER `6->8`).
- **Port:** `8:27, 6:99` (order `8,6,7`) — 8 left of 6 (wrong).

The FLATORDER `6->8` edge **is built correctly** now (verified via PORTDBG in the
prior mission); it is the ENFORCEMENT that diverges. A prior experiment setting the
port's FLATORDER weight to 0 made b58 **worse** (8→12 diverged, broke the node-7
fix) — proving the port's `build_ranks` does not currently reproduce C's
install-order enforcement, so the port relies on the weight-1 `flat_reorder` path.
The fix is therefore NOT a one-line weight change; it requires aligning the port's
build_ranks/install-order enforcement with C's.

## Branch

`feature/fix-flatorder-enforcement` off `main` (merge-commit, per mission convention).

## Corpus reach

Ordering graphs still diverged after the construction fix (this mission's targets):
`graphs-b58`, `{linux.x86,macosx,nshare}-ordering_dot1`,
`{graphs,share,windows}-pgram`, `{graphs,share,windows}-trapeziumlr`, `1472`.
(`graphs-in` was already cleared by the construction fix and is a canary here.)

## Constraints

**Stop** when: any byte-match→worse regression (revert); 2 consecutive gate
failures on the same check; a fix needs files outside its write-set; 3 consecutive
edits to one site without resolving it; the fix cannot make b58's 3/6/8 order match
C without regressing others (deeper than scoped — document + stop). See
[decisions.md](decisions.md#stop-conditions).

**Push forward** when: reading/instrumenting C-trace install order; env-gated temp
instrumentation (reverted after capture); marking a graph's residual a documented
secondary cause; refreshing the baseline once the gate is green.

## Method rule (non-negotiable)

C is the spec. Instrument C before hypothesizing (`instrument-c-before-quarantine`):
rebuild `gvplugin_dot_layout` under `~/git/graphviz/build`, env-gate prints, capture,
then `git -C ~/git/graphviz checkout` the source and rebuild clean. The prior mission
proved the weight-0 hypothesis alone is insufficient — Batch 0 MUST capture C's
actual per-rank install order through `build_ranks`/`enqueue_neighbors` on b58, and
compare to the port's, before changing enforcement.

## Quality gates

- `command: npx tsc --noEmit` — pass: exit 0 — on_fail: fix_and_rerun
- `command: npx vitest run` — pass: exit 0 — on_fail: fix_and_rerun
- `command: GVBINDIR=/tmp/ghl PARITY_OUT=parity-probe.json npx tsx test/corpus/survey.ts && npx tsx test/corpus/rules-gate.ts test/corpus/parity-probe.json`
  — pass: `GATE PASS`, 0 regressions — on_fail: stop (revert the change)
  — note: ~17 min; run after each enforcement change and before any commit.
- `command: git diff --name-only` — pass: matches declared write-set — on_fail: stop

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [0](batch-0/overview.md) | Instrument C `build_ranks`/`enqueue_neighbors` install order + FLATORDER weight handling vs the port on b58; pin exactly how C orders 6-before-8 and where the port diverges | [x] — weight-0 premise overturned; divergence pinned in `left2right` matrix index basis (`order-vStart` vs C `ND_low`) |
| [1](batch-1/overview.md) | Implement the enforcement fix at the pinned site; b58 3/6/8 order == C; + unit tests | [ ] |
| [2](batch-2/overview.md) | Full survey (0 regressions), record which ordering graphs clear, document residuals, refresh baseline | [ ] |

## Recipes (carried from fix-ordering-mincross)

- C oracle / survey use headless `GVBINDIR=/tmp/ghl` (regen:
  `sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl`).
- Render one (port): `GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts <path> dot`.
- Render one (C): `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg <path>`.
- Node-order/geom diff (ellipse-safe): `node test/diagnostic/flat-geom-diff.mjs <c.svg> <port.svg>`.
- Rebuild C plugin after instrumenting: `make -C ~/git/graphviz/build gvplugin_dot_layout`,
  then regen `/tmp/ghl`.
- Refresh baseline ONLY at Batch 2:
  `cp test/corpus/parity-probe.json test/corpus/parity-rules.json && cp test/corpus/parity-probe.json test/corpus/parity.json && npx tsx test/corpus/dashboard.ts`.

## Docs

- [decisions.md](decisions.md) — architecture decisions + stop conditions + C refs
- [diagrams/data-flow.md](diagrams/data-flow.md) — FLATORDER enforcement through build_ranks vs flat_reorder
- [decision-journal.md](decision-journal.md) — appended during execution

## Provenance

Spun off from `plans/fix-ordering-mincross` (merged `c793815`). See that mission's
`decision-journal.md` (b58 3/6/8 residual row + mission summary) and
`batch-2/overview.md` for the full secondary-cause analysis and the failed weight=0
experiment that motivates this mission.
