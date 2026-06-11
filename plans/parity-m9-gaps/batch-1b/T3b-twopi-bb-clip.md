# T3b — twopi self-loop bb: C-faithful update_bb_bz in clipAndInstall

## Context

graphviz-ts port; C source at ~/git/graphviz/lib is the spec; suite
baseline 1090/0 (post batch-1).

Batch-1 T3 root-caused the remaining twopi-self-loop failure (maxDelta
18, SVG width 62pt vs expected 80pt): the self-loop spline's extent
never reaches `g.info.bb`. In C, `clip_and_install`
(lib/common/splines.c, ~line 312) calls `update_bb_bz(&GD_bb(g), cp)`
for every installed bezier segment, so GD_bb includes spline extent
before translate_drawing reads it. The port's `clipAndInstall`
(src/common/splines-clip.ts) has `updateBbBz` available but passes
`bb=null` to `copyToBezier`, so no expansion occurs.

Complication found by T3: in the twopi pipeline, `normalizeGraphBB`
(src/layout/pack/index.ts) runs AFTER spline routing and recomputes
`g.info.bb` via node-only `computeSubgraphBB`, which would overwrite a
bb expanded during clipAndInstall. Check what C does at the equivalent
point — C's `compute_bb` (lib/common/utils.c) and the pack/normalize
path — before assuming the clip-time expansion survives.

Human ruling (Scott, 2026-06-11): do the C-faithful fix; it lands in
src/common/splines-clip.ts.

## Task

Make `clipAndInstall` faithful to C: thread the graph (or its bb)
through so each installed bezier expands `g.info.bb` exactly as
`update_bb_bz` does in C. Update its callers only as needed to pass
the new argument. Then verify the expanded bb actually survives to SVG
emission for twopi: if a downstream port function (e.g. the
normalizeGraphBB/computeSubgraphBB path) discards it where C would
not, fix THAT divergence faithfully against the C source as well —
with a decision-journal-worthy note in your report. Any other fix
location: stop and report.

TDD: failing unit test first, co-located with splines-clip.ts. Verify
the quarantined twopi-self-loop golden passes via the compare.ts probe
approach (no test/golden/ edits); T5b promotes.

## Write-set

src/common/splines-clip.ts; argument threading in its direct callers
(expected: src/layout/neato/splines.ts — verify with references
search); the normalizeGraphBB path ONLY under the condition above;
src/common/splines-clip.test.ts (new or extend); .probes/* (untracked)

## Read-set

~/git/graphviz/lib/common/splines.c:230-330 (clip_and_install +
update_bb_bz call); ~/git/graphviz/lib/common/utils.c (compute_bb);
~/git/graphviz/lib/pack/pack.c (how C normalizes per-component bb if
relevant); src/common/splines-clip.ts; src/layout/pack/index.ts
(normalizeGraphBB, read first, write only conditionally);
src/layout/twopi/pipeline.ts (read-only); .agent-notes/
T3-twopi-circo-self-loop-2026-06.md

## Architecture decisions (locked)

C-is-sacred. AD5: promotion is T5b's job — never touch test/golden/.

## Interface contract (consumed by T5b)

Report: twopi-self-loop PASS/FAIL with maxDelta; whether the
normalizeGraphBB conditional fix was needed (journal material).

## Acceptance criteria

- Given the quarantined twopi-self-loop input, the comparison passes
  at twopi's tolerance class
- Given every existing golden (60), port output is unchanged —
  clipAndInstall is shared by the whole neato family, so the suite
  (1090/0) is the regression gate
- Given the fix, a unit test pins bb expansion from an installed
  spline

## Quality bar

npx tsc --noEmit clean; npx vitest run green (>=1090/0). Commit
message (orchestrator commits):
`fix(T3b): expand graph bb from installed splines in clipAndInstall`
