# T4 — Triage polygon-points (3)

Follow the shared methodology in [overview.md](overview.md). Read-only.

## Cases
`144_no_ortho 144_ortho 2490`

## Hints
First diff is a `@points` value (polygon vertex list). Cause is usually
arrowhead or node-shape geometry (vertex count or coordinates). `144_no_ortho`
and `144_ortho` are the same graph with/without `splines=ortho` — likely a shared
cause. Determine if the diff is a vertex COUNT difference (structural, may be
deep) or a coordinate rounding (possibly simple). Name the fix module (likely
`src/render/poly-gencode.ts` or an arrow module under `src/common/`).

## Write-set
`plans/parity-low-hanging-fruit/triage/polygon-points.md` (create)

## Acceptance criteria
- Given the 3 cases, when triaged, then each has a concrete `@points` diff + root
  cause + simple/deep verdict + fix module.
- Given `144_no_ortho`/`144_ortho`, then they are grouped if they share a cause.

## Observability / Rollback
N/A — read-only. Reversible.

## Quality bar
No src edits. Commit: `docs(triage): polygon-points parity bucket`.
