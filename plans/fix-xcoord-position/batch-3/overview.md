# Batch 3 — Production wiring + cutover

| Task | Writes | Gate |
|------|--------|------|
| [T3.1 production wiring + docs](T3.1-production.md) | factory, package.json, docs | Node→node-canvas(lazy/optional), browser→canvas, docs state the contract |
| [T3.2 cut over rules corpus](T3.2-cutover.md) | test/corpus/*, CI | rules survey is THE layout survey; old pango survey retired |

Gate: full-corpus rules survey conformant (modulo allowlist); CI deterministic
cross-platform; measurement fidelity covered by Batch-2 tests. Merge.
