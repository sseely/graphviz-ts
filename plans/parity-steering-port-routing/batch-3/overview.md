# Batch 3 — Broaden coverage + goldens + the full-switch decision

**Depends on:** Batch 2 (regular adjacent-rank ported edges working).

Extends the faithful-path routing to the remaining edge classes, mints the
steering-port goldens, and evaluates whether to route *all* dot edges through
the faithful path. Each task is independently gated; any edge class the
faithful path doesn't yet cover within tolerance is journaled +
comparison-paged, not forced (AD4, carried excluded-case rule).

| ID | Description | Agent | Writes (confirm after batch 2) | Depends | Done |
|----|-------------|-------|-------------------------------|---------|------|
| SR5 | Flat-edge (FLATEDGE, same-rank) ports — box-channel branch (non-adjacent) via BeginFlatSide/EndFlatSide. A:n->B:n exact, A:e->B:w 0.25pt. Bottom-tail offset + adjacent (make_flat_adj_edges deferred) excluded w/ comparison page | orchestrator inline | `splines-flat.ts`, `edge-route.ts` dispatch, `edge-route-faithful.ts` (additive exports), `splines-flat-oracle.test.ts` | SR3 | [x] |
| SR6 | Self-edge ports — VERIFIED already faithful via `makeSelfEdge`; seam is `self-loop.ts` not `splines-selfedge.ts` (frozen). Validation+pin only, no production change | orchestrator inline | `self-loop-oracle.test.ts` (self-loop.ts unchanged) | SR3 | [x] |
| SR7 | Multi-rank virtual-chain ports (`edge-route-chain.ts`) — faithful chain via routeSplines; A:n->C/A:e->C/A:n->D ≤0.32pt. Left-bulge + straight-mode excluded w/ comparison page. Fixed Splinesep=nodesep/4. A:n->B:s re-tested (still adjacent-excluded) | orchestrator inline | `edge-route-chain.ts`, `edge-route-faithful.ts` (additive exports), `edge-route.ts` dispatch, `edge-route-chain-oracle.test.ts` | SR3 | [x] |
| SR8 | Mint port goldens vs dot 15.0.0 + edge-`<title>` fix | orchestrator inline | `src/render/svg-helpers.ts`, `test/golden/*` (4 appended), `plans/.../comparisons/*` | SR4–SR7 | [x] — title fix matches C on all 10 cases (ports + `&#45;` + compass-replaces-field); 4 goldens minted (aligned/e/w/record, ≤0.5pt + 0.01pt portRef pins); count 115→119; bbox-divergent steering cases comparison-paged. 1779/0 |
| SR9 | Evaluate full-switch | inline measurement | [SR9-findings.md](../SR9-findings.md) + journal | SR8 | [x] — **recommend KEEP HYBRID**: simplified fitter is conformant (0.00pt) to dot 15.0.0 for all no-port goldens; forcing faithful for all perturbs 4/68 (max 1.41pt) with zero fidelity gain. No re-mint; AD3 default holds. No production change |

## Acceptance criteria (batch)

- SR5–SR7: each targeted edge class with a side port either matches dot
  15.0.0 within 0.5pt (golden in SR8) or is journaled with a side-by-side
  comparison page (excluded-case rule).
- SR8: new goldens APPENDED only; prior 115 refs byte-unchanged; suite count
  test bumped (explicit hardcoded count).
- SR9: a written recommendation with oracle-backed deltas. Default if the
  full switch isn't proven strictly better: keep the hybrid (AD3). No ref
  re-mint without Scott's explicit go-ahead.

## Stop / escalation

- If SR9 shows the full switch would improve fidelity but perturb many of the
  115 refs, STOP and present the re-mint scope to Scott (it's a policy call,
  not an autonomous one).
- A divergence tracing into `Proutespline`/`Pshortestpath` numerics → FMA/libm
  stop precedent.
