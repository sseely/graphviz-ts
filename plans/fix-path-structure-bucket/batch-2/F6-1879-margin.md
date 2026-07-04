# F6 — graph-level `margin` attribute unported (init_job_margin) — 1879 residual

## Context (from F2's follow-up finding in .agent-notes/path-structure-1879.md)
After F2 (pad, commit dd56749), 1879's raw background polygon and zoom
factor byte-match C, but a uniform 115pt delta remains, traced to the graph
attribute `margin=0.8` (0.8in → 57.6pt/side → 115.2 total per axis): C's
`init_job_margin` (~/git/graphviz/lib/common/emit.c, near init_job_pad)
reads it; the port doesn't. Same shape as the pad fix, same file territory
(F2 is committed, so the territory is free).

## Task
Port `init_job_margin` faithfully alongside the F2 pattern: read `margin`
at graph level, parse per C (check emit.c for the exact function — note
C distinguishes job->margin semantics from cluster/node margin attrs; only
the graph-level/job margin is in scope), thread through the viewport/emit
path the same way job.pad was. JSDoc @see. Preserve C's
defaults/units/edge-cases exactly (check how margin interacts with pad and
size zoom-fit ORDER in init_job_viewport).

## Write-set
- `src/gvc/viewport.ts`, `src/gvc/device.ts`, `src/render/svg-graph.ts`
  (whichever of these the mechanism actually needs), colocated tests
- `.agent-notes/path-structure-1879.md` (append F6 record)

## Read-set
- `.agent-notes/path-structure-1879.md` (F2 fix record + follow-up finding)
- C: `~/git/graphviz/lib/common/emit.c` (init_job_margin + init_job_viewport)
- Port: commit dd56749 (the F2 pattern to mirror)

## Acceptance criteria
- Given 1879.dot, then width/height/translate byte-match C (the bbox-level
  divergence fully closes; per-edge ltail spline diffs remain → D5/F5)
- Given a minimal `margin=0.8` golden, then emitted viewport matches C
- Given graphs WITHOUT margin, then byte-stable (npm run test exit 0)
- `npx tsc --noEmit` exit 0; corpus sweep of real `margin=` graph-attr users
  before/after — none worse

## Tests (TDD)
Failing test first (parse unit + margin golden vs oracle).

## Observability: N/A. Rollback: Reversible — single commit
`fix(render): read graph margin attribute for viewport (F6)`.

## Boundaries
Never touch src/layout/**, src/ortho/**, edge-route-*; stage commits by
explicit path only.
