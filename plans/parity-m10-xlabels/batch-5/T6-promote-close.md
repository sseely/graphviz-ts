# T6 — verify + promote dot-head-tail-label + mission close

Executed inline by the orchestrator (mission 9 T5/T8 precedent).

## Task

1. Probe the quarantined golden (renderSvg + compareSvg against
   test/golden/quarantine/dot-head-tail-label.{dot,svg}); require PASS
   at dot deterministic tolerance. On FAIL: localize with a C oracle
   probe (positions at %.17g) — per the README stop conditions, do not
   widen tolerances and stop if the divergence traces to pre-M10 code.
2. Promote per AD5: git mv input/ref to inputs/refs, APPEND manifest
   entry ("digraph with headlabel and taillabel on an edge; ref:
   graphviz 15.0.0 dot -Tsvg; promoted from quarantine (mission 10,
   post-parity T2 mining)"), suite.test.ts count 66 → 67 (comment +
   test name + expect), verify quarantine empty and remove the
   directory.
3. Full gates; re-run the 67-golden suite.
4. Mission close: checkboxes, README mission summary (per-cluster
   outcomes, decisions count, gate results, follow-ups), final journal
   entry. Merge `feature/parity-m10-xlabels` → `feature/post-parity`
   with a merge commit only on Scott's go-ahead.

## Acceptance criteria

- Manifest = 67; quarantine directory gone; suite green; tsc clean
- Existing manifest entries byte-unchanged

Commit: `test(T6): promote dot-head-tail-label — quarantine empty,
mission close`
