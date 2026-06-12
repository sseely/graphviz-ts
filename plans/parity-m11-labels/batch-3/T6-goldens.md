# T6 — mint 5 label goldens (orchestrator inline)

Per decisions.md D4 + AD5. Executed inline (M10 T6 precedent).

## Task

1. Write 5 inputs (test/golden/inputs/): dot-node-xlabel.dot,
   dot-edge-label.dot, dot-edge-xlabel.dot, dot-graph-label.dot,
   dot-labels-combined.dot — each with the standard header comment
   (engine: dot, tolerance: deterministic; see existing inputs).
   Use the T5 probe graphs so results are pre-verified.
2. Generate refs with the installed binary ONLY:
   `dot -Tsvg test/golden/inputs/<name>.dot > test/golden/refs/<name>.svg`
3. APPEND 5 manifest entries (provenance description: "...; ref:
   graphviz 15.0.0 dot -Tsvg; mission 11 label parity"). Existing
   entries byte-unchanged.
4. suite.test.ts count 67 → 72 (comment + test name + expect).
5. Full gates: tsc, vitest (expect 72/72 goldens within the suite),
   byte-stability of the prior 67 vs pre-task baseline.

## Acceptance criteria

- Manifest = 72; all 5 new goldens pass at deterministic tolerance;
  existing 67 entries byte-unchanged; suite green; tsc clean

## Rollback

Reversible (single commit). Commit:
`test(T6): add five label-parity goldens (manifest 72)`
