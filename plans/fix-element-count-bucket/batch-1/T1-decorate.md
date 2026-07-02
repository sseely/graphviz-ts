<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — decorate spec extraction

## Context
graphs/decorate.gv: oracle emits 26 <polyline>s (edge-label attachment
lines, `decorate=true`); port emits none. D5: feature port.

## Task
Extract C's behavior: where the polyline is generated (emit.c
emit_edge_graphics decorate branch or label placement), endpoints
(label pos → spline attachment point), styling (color/width), and the
gating attr semantics (mapbool decorate, per-edge). Map the port's
edge-label emit insertion point. Spec with file:line refs.

## Acceptance criteria
- Given the C read, then polyline endpoint math + attrs are quoted with
  refs and validated against decorate.gv's oracle SVG values.

## Rollback/Observability: N/A — diagnosis. Reversible.
## Commit: journal (folded).
