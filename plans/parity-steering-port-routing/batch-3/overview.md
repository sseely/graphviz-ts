# Batch 3 — Broaden coverage + goldens + the full-switch decision

**Depends on:** Batch 2 (regular adjacent-rank ported edges working).

Extends the faithful-path routing to the remaining edge classes, mints the
steering-port goldens, and evaluates whether to route *all* dot edges through
the faithful path. Each task is independently gated; any edge class the
faithful path doesn't yet cover within tolerance is journaled +
comparison-paged, not forced (AD4, carried excluded-case rule).

| ID | Description | Agent | Writes (confirm after batch 2) | Depends | Done |
|----|-------------|-------|-------------------------------|---------|------|
| SR5 | Flat-edge (FLATEDGE, same-rank) ports via `BeginFlatSide`/`EndFlatSide` path | typescript-pro | `splines-flat.ts` + test | SR3 | [ ] |
| SR6 | Self-edge ports (`splines-selfedge.ts` already on faithful path — verify + extend) | typescript-pro | `splines-selfedge.ts` (confirm) + test | SR3 | [ ] |
| SR7 | Multi-rank virtual-chain ports (`edge-route-chain.ts`) | typescript-pro | `edge-route-chain.ts` + test | SR3 | [ ] |
| SR8 | Mint port goldens vs dot 15.0.0 (compass aligned + steering + record/attr), APPEND manifest, bump count; FIRST land the edge-`<title>` port fix (svg-helpers.ts:`svgBeginEdge`) per SCOPE quirks (ports incl., `&#45;` hyphen, compass-replaces-field); comparison-page any exclusions | orchestrator inline | `src/render/svg-helpers.ts`, `test/golden/*`, `plans/.../comparison/*` | SR4–SR7 | [ ] |
| SR9 | Evaluate routing ALL dot regular edges through the faithful path: re-route the 115 no-port goldens via the faithful fitter, quantify deltas vs refs + vs oracle; recommend hybrid-keep or full-switch (NO ref changes without Scott) | architect-reviewer + inline | findings doc + journal | SR8 | [ ] |

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
