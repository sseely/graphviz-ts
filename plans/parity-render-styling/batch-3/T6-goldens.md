# T6 — styled goldens + C-oracle verification (orchestrator inline)

Per AD-C1 append-only rules. M11 T6 / M12 T10 are the procedure
precedent.

## Task

1. End-to-end verify every styled case against `dot -Tsvg` (graphviz
   15.0.0) at deterministic tolerance via test/golden/compare.ts
   (.probes pattern from M11/M12). Per-case PASS/FAIL table.
2. Write inputs (test/golden/inputs/, header: engine dot, tolerance
   deterministic) for every PASSING case. Target set (~15):
   - dot-node-fillcolor, dot-node-pencolor, dot-node-penwidth,
     dot-node-style-dashed, dot-node-style-dotted, dot-node-style-bold,
     dot-node-filled-default (filled, no fillcolor),
     dot-edge-color, dot-edge-penwidth, dot-edge-style-dashed,
     dot-edge-colored-arrow,
     dot-graph-bgcolor, dot-cluster-filled, dot-cluster-bgcolor,
     dot-styled-combined (a graph exercising node fill + edge color +
     cluster fill + bgcolor together).
3. Refs from the installed binary ONLY: `dot -Tsvg <input> > <ref>`.
   Avoid shape=plaintext (no node box) and non-14pt sizes in inputs
   unless intentionally testing them (keep style the variable).
4. APPEND manifest entries (description: "...; ref: graphviz 15.0.0 dot
   -Tsvg; mission render-styling"). Existing 82 byte-unchanged — verify
   programmatically (M12 T10 technique: snapshot hashes before/after).
5. Bump suite.test.ts count 82 → 82+minted. A FAIL case is NOT minted
   and NOT silently retried — journal the exclusion.
6. Full gates: tsc, vitest, byte-stability of the prior 82 vs baseline.

## Acceptance criteria

- Manifest = 82 + minted count; all new goldens pass at deterministic;
  prior 82 entries byte-unchanged; suite green; tsc clean

## Rollback

Reversible (single commit). Commit: `test(T6): add render-styling parity
goldens (manifest 82+N)`.
