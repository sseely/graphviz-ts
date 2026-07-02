<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Gated diagnosis (no src/ edits)

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Port-write provenance trace → H1/H2/H3 verdict per edge | main loop | .agent-notes/b15-port-provenance.md, journal | — | [x] |
| T2 | FlightToHover:Target post-beginpath divergence | main loop | journal (+note) | T1 | [x] |

GATE: per-edge mechanisms (cause, origin file:line, chain, ruledOut)
before Batch 2. C instrumentation reverted + oracle byte-verified.
