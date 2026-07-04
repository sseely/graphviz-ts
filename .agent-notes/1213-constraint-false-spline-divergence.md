## Observation: 1213-1/1213-2 diverged = constraint=false edge-spline routing, NOT init_rank

- **Context**: Root-causing parity-diverged `1213-1` (maxDelta 20.01,
  firstDiffPath `svg/g[1]/g[10]/path[1]/@d`) and `1213-2` (maxDelta 21.84).
  Both clustered digraphs with many `constraint=false` edges.
- **Finding**: The C oracle EXITS 1 with `Error: trouble in init_rank` (the
  unfixed upstream xfail #1213 — `tests/test_regression.py::test_1213` is
  `@pytest.mark.xfail(strict=True)`) but still emits a near-correct SVG. Node
  positions, ranks, clusters, viewBox (507×238), and 14 of 17 edges are
  byte-identical between oracle and port. The ENTIRE divergence is the spline
  control points of three `constraint=false` edges:
    - `V0->V2`  (constraint=false)
    - `V0->V3`  (constraint=false)
    - `V1->V9`  (label=b, constraint=false)
- **init_rank is a red herring**: C's `init_rank` (`ns.c:155`, topological BFS)
  hits `ctr != N_nodes` (a cycle from constraint=false + cluster ranking) →
  prints the error and limps along, but lands on the SAME node ranking the port
  computes. The port's `initRank` (`src/layout/dot/ns.ts:56`) omits the
  `ctr != N_nodes` counter/error entirely, so it never reports the cycle — but
  the resulting geometry is unaffected. Do NOT chase init_rank for the geometry
  delta (mission AD-4). The missing port counter is a separate, out-of-scope
  observation.
- **Subsystem**: dot edge routing for non-constraint edges. Port files:
  `src/layout/dot/edge-route*.ts`, `splines*.ts`, `classify.ts`. C spec:
  `~/git/graphviz/lib/dotgen/{splines.c,dotsplines.c,class2.c}`.
- **Open** (Batch 1): which routing stage produces the control-point delta —
  edge classification, routing-box/corridor construction, or the spline fitter —
  and whether `1213-2` shares the exact cause (expected: yes, same topology).
- **Impact**: Standard faithful-port edge-spline parity fix; same class as prior
  opposing-edge / parallel-corridor / bezier-clip spline fixes. Likely tractable.
- **Confidence**: High (divergence = constraint=false splines, nodes identical);
  Medium (exact routing stage).
- **Repro**: oracle `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg
  ~/git/graphviz/tests/1213-1.dot` (exit 1, SVG on stdout); port
  `GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts
  ~/git/graphviz/tests/1213-1.dot dot`.
