# record-node xlabel drop

## Observation: the record branch of common_init_node skipped ND_xlabel creation

- **Context**: Verifying the prior agent's diagnosis in
  `.agent-notes/xdot-missing-computed-attrs.md` — a record-shape node with an
  `xlabel` attr emitted no `xlp` from the port while the native oracle
  (`~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/ghl`) did.
- **Finding**: C's `common_init_node` (`lib/common/utils.c:427-454`) runs the
  same three steps for EVERY shape, in this order:
  `make_label` (:441) → `ND_xlabel` (:443-447) → `initfn` (:453).
  `shapeOf(n) == SH_RECORD` is only (a) the `is_record` flag handed to the MAIN
  label's `make_label` — which in `labels.c:139` merely stores the raw text for
  `record_init` to parse — and (b) the selector for `initfn = record_init`. It
  is NOT a reason to skip the xlabel. The port's `initNodeFromLabel`
  (`src/common/nodeinit.ts`) early-returned on the record branch and so never
  reached `initNodeXLabel`. Both `record` and `Mrecord` bind to `SH_RECORD`
  (`shapes.c` Shapes[58]/[59]), so both lost their xlabel.
  Instrumented proof (probe dumping `n.info.xlabel` after layout):
  `node=r shape=record xlabelAttr=NX ND_xlabel=UNDEFINED` versus
  `node=s shape=box xlabelAttr=BX ND_xlabel={"text":"BX","set":true,...}`.
- **Impact**: The xlabel is not merely missing from the output — it is missing
  from the LAYOUT. `addXLabels` never places it, so the node loses its `xlp`
  and its `_ldraw_` text op, and the graph `bb` is short by the xlabel's
  extent, which shifts every node position. On the minimal repro the port
  emitted `bb="0,0,73.448,109"` against the oracle's `bb="0,0,74.221,125.8"`,
  and `pos`/`rects` were off by ~0.77pt; all three snap to an exact oracle
  match once the xlabel is created. Ordering matters when fixing: the xlabel
  must be created BETWEEN the record label build and `record_init`, so
  `recordNodeInit` was split into `recordMakeLabel` + `recordInit` rather than
  appending the xlabel call after the wrapper.
- **Confidence**: High — mechanism read from the C, confirmed by instrumenting
  the port, and the fix reproduces the oracle's `xlp`/`_ldraw_`/`bb` exactly
  under dot, neato and fdp.

## Observation: the record ∩ xlabel intersection is empty in the corpus

- **Context**: Deciding how to regression-test the fix.
- **Finding**: No file in `~/git/graphviz/tests` (180 `.dot` inputs) combines a
  record shape with an `xlabel`, so a corpus sweep can never exercise this
  path — a 35-file spot-check (dot + neato) showed 0 verdict changes before vs
  after the fix. The regression must therefore be hand-written; it lives in
  `src/common/nodeinit.test.ts` and asserts the oracle's literal values
  (`xlp="10.11,117.4"`, the `T 10.11 113.2 0 20.22 2 -NX` op, and
  `bb="0,0,74.221,125.8"`) for record, Mrecord and a plain shape.
- **Impact**: Corpus conformance is not evidence of coverage for a shape ×
  attribute interaction the corpus never instantiates. When a defect is found
  in a shape branch, check whether the corpus can even reach it before trusting
  a green sweep.
- **Confidence**: High — measured across all 180 corpus inputs.

## Observation: ND_showboxes is unported for EVERY shape (not a record-branch bug)

- **Context**: Auditing whether the record early-return skipped anything else
  that C does unconditionally.
- **Finding**: `common_init_node` also sets `ND_showboxes` (`utils.c:449-452`,
  `imin(late_int(n, N_showboxes, 0, 0), UCHAR_MAX)`). The port declares
  `NodeInfo.showboxes` but never writes it — and never reads it — on ANY shape
  path, so this is a global unported debug feature, not a defect introduced by
  the record early-return. Left as-is; fixing it would mean porting the whole
  showboxes debug-box drawing.
- **Impact**: `showboxes` (and `GD_showboxes`/`ED_showboxes`) is a known gap; do
  not mistake the declared-but-unwritten field for a regression.
- **Confidence**: High — grep shows no assignment or read anywhere in `src/`.
