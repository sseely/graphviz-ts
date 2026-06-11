# dot-minlen golden: residual position offset (M9/T1)

## Observation: dot-minlen fails at 4.32pt despite correct minlen ranking
- **Context**: M9/T1 made dot read `minlen`/`constraint` edge attrs
  (lateInt/mapbool per dotinit.c:85, rank.c:587-597). dot-constraint-false
  then passed exactly; dot-minlen did not.
- **Finding**: rank structure is correct (`A->B[minlen=2]` yields
  b.rank − a.rank = 2, 3-rank layout). Residual diff vs the C ref:
  node A at cx=63/cy=−198 vs ref cx=62/cy=−199 (1pt offset), and the
  A→C edge spline takes a structurally different path (path-command
  diff), maxDelta 4.32pt at deterministic tolerance 0.01. So the
  divergence is in position/spline computation for layouts where
  minlen>1 widens the rank span — not in attr init.
- **Impact**: dot-minlen stays quarantined
  (test/golden/quarantine/dot-minlen.{dot,svg}). Needs its own debug
  task: bisect node coordinates (positions pass) vs C oracle at %.17g
  (.agent-notes/fdp-fma-oracle-2026-06.md technique works for dot too),
  then the A→C spline routing. Do not re-touch dot init for this.
- **Confidence**: Medium (single run; "pre-existing emitter rounding"
  is the T1 agent's hypothesis, not verified — the 1pt offset could
  equally be in position.ts rank-Y math or bb rounding).

## Observation: lateInt overwrites — `??=` is the wrong pattern for attr reads
- **Context**: same task; old code had `e.info.minlen ??= 1`.
- **Finding**: C's `late_int` always reads the attr handle and
  overwrites the info field (default when absent/invalid). Any port
  site that uses `??=` for an attr-driven field silently diverges when
  a caller pre-set the field. One dot.test.ts test encoded that wrong
  behavior and was corrected.
- **Impact**: future attr plumbing in dotInitEdge (and other engines'
  init) must use lateInt/mapbool directly, never `??=`.
- **Confidence**: High (C source verified).
