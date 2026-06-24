# Architecture decisions

## ADR-1: Oracle instrumentation via /tmp object-linking
- **Context:** `dot -v` reports NS counts only, not the per-pivot trace or aux-edge
  set needed to localize the divergence.
- **Decision:** Instrument C `lib/common/ns.c` + `lib/dotgen/position.c` to dump
  (a) the x-coord aux-edge list and (b) per-pivot `leave_edge`/`enter_edge`/
  `cutvalue`; rebuild `gvplugin_dot_layout` only and copy to `/tmp/gvplugins`
  (zero-libgvc-rebuild recipe, proven in memory `recover-slack-and-c-harness` /
  `ortho-p1-already-ported-fpq-invariant`). Run via `GVBINDIR=/tmp/gvplugins`.
- **Consequences:** Exact ground truth; modest C build effort; no upstream C edits
  committed.

## ADR-2: Staged divergence comparison, stop at first
- **Context:** The divergence could originate in the aux graph, the initial
  feasible tree, the initial cutvalues, or the pivot path.
- **Decision:** Compare port vs native in pipeline order — **aux-edge set →
  initial cutvalues → pivot #1 (leave/enter)** — and stop at the first stage that
  differs; that stage names the root cause.
- **Consequences:** Avoids fixing downstream symptoms (e.g. dfsRange visit count).

## ADR-3: Minimal repro fixture for fast iteration
- **Context:** `2475_2` takes ~126s; the pure-forest synthetic does NOT reproduce
  the divergence (matches native).
- **Decision:** Derive a minimal (<~50-node) graph that reproduces a ≥2× pivot
  gap (forest of small DAGs with rank-spanning edges → virtual nodes) and commit
  it as the regression fixture; keep `2475_2` as the slow end-to-end acceptance.
- **Consequences:** Tests run in ms; pins the structural trigger; the fixture is
  the TDD anchor for T4.

## ADR-4: Faithfulness over micro-optimization
- **Context:** Success bar is matching native's pivot count.
- **Decision:** Any fix must be a faithful correction toward C semantics (a real
  divergence in aux-graph construction, cutvalues, feasible tree, or pivot
  selection), never a JS perf hack that changes layout results.
- **Consequences:** Aligns with "C is sacred"; verified by parity survey (0 verdict
  regressions) + pivot-count match, not by wall-clock alone.

## Rollback
Reversible — revert the mission commits. No data/schema/migration; pure internal
layout computation.
