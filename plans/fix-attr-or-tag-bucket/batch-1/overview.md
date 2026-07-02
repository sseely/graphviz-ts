<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Gated diagnosis (no src/ edits; sequential, shared C tree)

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | b69 spline append-order mechanism | main loop | .agent-notes/b69-*.md, journal | — | [x] |
| T2 | b15 coordinate divergence — re-diagnose + D3 classify | main loop | .agent-notes/b15-*.md, journal | — | [x] |
| T3 | user_shapes: C shapefile fallback semantics | main loop | journal (+note if non-trivial) | — | [x] |
| T4 | hyphen/escape tables per context from C SVG renderer | main loop | journal | — | [x] |

GATE: all mechanisms in journal/notes (cause, origin, chain, ruled-out);
T2 emits bounded|deep verdict deciding T8. C instrumentation reverted +
oracle byte-verified before Batch 2.
