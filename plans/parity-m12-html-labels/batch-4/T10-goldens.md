# T10 — mint ~10 html goldens (orchestrator inline)

Per AD-C1 append-only rules. M11 T6 is the procedure precedent.

## Task

1. Write inputs (test/golden/inputs/, standard header: engine dot,
   tolerance deterministic) for every case T9 PASSED, target set:
   dot-html-node-label (first golden for the previously-live path!),
   dot-html-node-xlabel, dot-html-edge-label, dot-html-edge-xlabel,
   dot-html-head-tail-label, dot-html-graph-label,
   dot-html-cluster-label, dot-html-fonts (b/i/u/s/font
   color/point-size nesting), dot-html-table-styling (bgcolor, sides,
   rules, hr/vr, cellborder), dot-html-combined.
2. Refs from the installed binary ONLY: `dot -Tsvg <input> > <ref>`.
3. APPEND manifest entries (description: "...; ref: graphviz 15.0.0
   dot -Tsvg; mission 12 html-label parity"). Existing 72
   byte-unchanged — verify programmatically (M11 T6 technique).
4. suite.test.ts count 72 → 82 (or actual minted count if T9 failed
   any case — journal the exclusions; a T9 FAIL case is NOT minted
   and NOT silently retried).
5. Full gates: tsc, vitest, byte-stability of the prior 72 vs
   pre-task baseline.

## Acceptance criteria

- Manifest = 72 + minted count; all new goldens pass at deterministic
  tolerance; prior 72 entries byte-unchanged; suite green; tsc clean

## Rollback

Reversible (single commit). Commit:
`test(T10): add html-label parity goldens (manifest 82)`
