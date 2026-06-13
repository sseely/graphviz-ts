# T6 — goldens + C-oracle verification (orchestrator inline)

Per AD-C1 append-only rules. M12 T10 / render-styling T6 are the
procedure precedent.

## Task

1. **End-to-end verify** every gradient and multicolor case against
   `dot -Tsvg` (graphviz 15.0.0) at deterministic tolerance via
   `test/golden/compare.ts` (`.probes` pattern from M11/M12).
   Per-case PASS/FAIL table in decision journal.

2. **Write inputs** (`test/golden/inputs/`, header: engine dot,
   tolerance deterministic) for every PASSING case. Target set (~12):
   - `dot-node-linear-gradient` (fillcolor="red:blue")
   - `dot-node-radial-gradient` (style=radial fillcolor="red:blue")
   - `dot-node-angled-gradient` (fillcolor="red:blue" gradientangle=45)
   - `dot-node-fractional-stop` (fillcolor="red;0.3:blue")
   - `dot-cluster-linear-gradient`
   - `dot-graph-bgcolor-gradient`
   - `dot-htmltable-bgcolor-gradient`
   - `dot-htmltable-gradientangle`
   - `dot-node-striped` (style=striped fillcolor="red:blue:green")
   - `dot-node-wedged` (style=wedged fillcolor="red:blue:green")
   - `dot-node-radial-angle` (radial with non-zero gradientangle)
   - `dot-combined-gradient` (node + cluster + bgcolor all gradient)

3. **Refs** from installed binary ONLY: `dot -Tsvg <input> > <ref>`.
   Avoid shape=plaintext and non-14pt sizes unless that IS the test
   variable.

4. **APPEND manifest entries** (description: "...; ref: graphviz
   15.0.0 dot -Tsvg; mission gradient-fills"). Existing goldens
   byte-unchanged — verify programmatically (snapshot hashes
   before/after, M12 T10 technique).

5. **Bump suite.test.ts count** to 82+RS_count+N (where RS_count is
   the goldens added by parity-render-styling). A FAIL case is NOT
   minted and NOT silently retried — journal the exclusion reason.

6. **Full gates**: tsc, vitest, byte-stability of all prior goldens
   vs baseline.

## Acceptance criteria

- Manifest = prior count + minted; all new goldens pass at
  deterministic tolerance; all prior entries byte-unchanged;
  suite green; tsc clean.

## Rollback

Reversible (single commit).
Commit: `test(T6): gradient fills goldens (manifest +N)`.
