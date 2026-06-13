# T-gold — multicolor goldens + C-oracle verification (orchestrator inline)

Per AD-C1 append-only rules. parity-render-styling T6 is the precedent.

## Task

1. End-to-end verify every new multicolor case against `dot -Tsvg`
   (graphviz 15.0.0) at deterministic tolerance via test/golden/compare.ts
   (the .probes mint pattern). Per-case PASS/FAIL.
2. Write inputs (test/golden/inputs/, header: engine dot, tolerance
   deterministic) for every PASSING case. Target set (~12):
   - dot-node-gradient-linear (fillcolor="c1:c2"),
     dot-node-gradient-radial (style=radial),
     dot-node-gradient-frac (fillcolor="c1;0.3:c2"),
     dot-node-striped (shape=box style=striped 3-color),
     dot-node-wedged (style=wedged 3-color),
     dot-cluster-gradient,
     dot-graph-bgcolor-gradient,
     dot-edge-multicolor (color="c1:c2"),
     dot-edge-multicolor-frac (color="c1;0.3:c2"),
     dot-edge-multicolor-3 (color="c1:c2:c3"),
     dot-node-gradient-default-angle, dot-multicolor-combined
     (a graph mixing a gradient node + striped node + multicolor edge —
     keep geometry clean; ellipse endpoints, avoid the box-node spline
     divergence).
3. Refs from the installed binary ONLY: `dot -Tsvg <input> > <ref>`.
   Keep style/color the variable (default 14pt, ellipse endpoints unless
   the case is specifically striped-box).
4. APPEND manifest entries (description: "...; ref: graphviz 15.0.0 dot
   -Tsvg; mission multicolor-paint"). Existing 97 byte-unchanged — verify
   programmatically (snapshot shasums before/after).
5. Bump suite.test.ts count 97 → 97+minted. A FAIL case is NOT minted and
   NOT silently retried — journal the exclusion (e.g. a libm/FMA numeric
   divergence in gradient trig or spline split is a STOP-class item, pin
   or exclude per M8 precedent).
6. Full gates: tsc, vitest, byte-stability of the prior 97 vs baseline.

## Acceptance criteria

- Manifest = 97 + minted; all new goldens pass at deterministic; prior 97
  entries byte-unchanged; suite green; tsc clean.

## Rollback

Reversible (single commit). Commit: `test(T-gold): add multicolor parity
goldens (manifest 97+N)`.
