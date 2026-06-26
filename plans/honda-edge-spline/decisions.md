# Architecture decisions & constraints

## ADRs (approved)

**ADR-1 — Primary suspect = labeled-edge routing / fitter piece count.**
- Context: honda's 2 divergent edges are labeled regular edges. A headlabel/edge
  label inserts a virtual label node at an intermediate rank, so native routes
  the edge as a multi-segment chain through the label box (2 bezier pieces),
  while the port emits 1 (edge2) or 4 (edge27). The fitter's piece count is set
  by the routing-box corridor (`maximal_bbox`/`rank_box`) and the label-node
  placement (`setEdgeLabelPos`/`place_vnlabel`).
- Decision: Start at `make_regular_edge` + label-node placement + box
  construction, but **follow the oracle** — the true first-divergence may be in
  box construction, recover_slack, the clipper, or the piece-count emit.
- Consequences: Fix may land in `edge-route-*.ts` or `splines-*.ts`; write-set
  provisional.

**ADR-2 — Oracle granularity: dump per divergent edge, diff for first divergence.**
- Decision: Instrument C and port to emit, for honda's 2 divergent edges (and a
  matching control edge): (1) edge classification + label-node id/rank/coord;
  (2) routing boxes (the corridor box sequence); (3) pre-fit path points (the
  `path` handed to the fitter); (4) final bezier segments (piece count + control
  points). First differing stage localizes the fix.
- Consequences: Evidence-driven fix site, not guessed.

**ADR-3 — Faithful to C; no honda-specific hack.**
- Decision: Fix mirrors dotsplines.c/routespl.c/splines.c. Deterministic
  tie-breaks derivable from graph structure (edge order, ranks, node coords)
  allowed; replicating non-derivable C pointer/alloc identity is NOT.
- Consequences: If divergence stems from unreproducible C pointer-iteration
  order → STOP and report as candidate accepted-divergence.

**ADR-4 — Identify the two divergent edges precisely before instrumenting.**
- Context: "edge index 2/27" are SVG-emit positions. The C dump must key edges
  by tail->head name (+ multi-edge ordinal) so port and C edges are matchable.
- Decision: First map SVG edge index → tail/head/label, then instrument by edge
  identity, not emit order.

**ADR-5 — Done = honda edges match + zero regressions; related graphs stretch.**
- REQUIRED: honda edge paths byte/structural-match, `npm test` green, 0 survey
  regressions (both baselines). STRETCH (must not regress): other labeled-edge /
  parallel-edge graphs.

## Stop conditions

### Write-set expansion rule (overrides default "stop on out-of-write-set file")
When the oracle shows a file outside the provisional write-set must change, **do
NOT stop**. Pause and present: (a) the file, (b) why the oracle points there,
(c) the specific change. Ask the user to approve expanding the write-set. On
approval, record in `decision-journal.md` and continue.

### STOP and wait when
1. Unreproducible divergence (ADR-3): non-derivable C pointer/alloc/hash order.
2. 2 consecutive survey-gate failures on the same approach, OR same spline site
   changed 3× without converging.
3. Fix makes honda match but regresses ≥1 other graph with no C-faithful variant
   clearing both.
4. The oracle localizes the divergence OUTSIDE spline routing (e.g. back in
   x-coord NS or node sizing) → re-evaluate scope with the user.
5. Matching C would require contradicting a verified-faithful ported invariant.

### PUSH FORWARD on judgment
- Instrumentation dump format/verbosity.
- Obvious faithful port of a C branch the oracle clearly implicates (log it).
- Adding/adjusting the focused unit test.
- Reverting instrumentation + clean oracle rebuild.
- Baseline refresh + dashboard regen mechanics.
- Minor scope reductions (log and proceed).

## Rollback
Reversible — single `git revert` of the fix commit restores prior splines. No
data migration. C instrumentation is reverted within the mission (T4).
