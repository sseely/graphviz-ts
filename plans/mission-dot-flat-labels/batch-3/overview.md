# Batch 3 — adjacent flat label + oracle pins

Runs after T2. The adjacent case routes through a different mechanism
(`make_flat_adj_edges`, the rotated aux graph) than the non-adjacent case.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Emit the label for adjacent flat labeled edges (`make_flat_adj_edges` path); pin both cases as dot-oracles; quarantine residue | opus | `src/layout/dot/splines-flat.ts`, `src/layout/dot/splines-flat-labeled.test.ts` (extend) | T2 | [x] |

Done: adjacent no-port labeled flat byte-exact to dot 15.0.0 (label `x` @
72,-24.2, straight segment). Ported the single-edge first block of
`makeSimpleFlatLabels` (the no-port `make_flat_adj_edges` branch — not the
rotated aux graph) into `splines-flat-labeled.ts`; dispatched from
`edge-route.ts`. No quarantine for T3. Both corpus cases now match dot text
counts (adjacent 3, non-adjacent 4).

Gate per [../README.md](../README.md). One commit.
Commit: `feat(T3): emit adjacent flat-edge label + multi-case oracle pins`.
