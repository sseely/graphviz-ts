# Batch 2 — Instrument port, diff, localize divergence

Single sequential task. Depends on T1's `oracle/c-dump.txt`.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Instrument port spline router; dump same 4 stages for the 2 edges; diff vs C; localize | orchestrator (debugger) | port temp instrument, `oracle/port-dump.txt`, decision-journal, new `.agent-notes/` note | T1 | [ ] |

Port dump sites (mirror C, gated on `globalThis.__XDUMP`): the regular-edge
router (`edge-route-chain.ts` / `edge-route-faithful.ts` / `splines-route.ts`),
label-node placement (`splines-label.ts`), and box construction
(`edge-route-boxes.ts`). Drive honda via `renderSvg` with the sink enabled
(reuse the prior mission's `run-port-dump.mjs` pattern).

Exit criterion: the **first differing stage** (1–4) and the exact file+function
are identified, recorded in `decision-journal.md`, and the fix site for T3 is
named. If the divergence is unreproducible (ADR-3) → STOP per
[decisions.md#stop-conditions](../decisions.md).
