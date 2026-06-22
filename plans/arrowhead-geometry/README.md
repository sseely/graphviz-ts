# Mission: Arrowhead geometry parity

## Objective

Port the full graphviz arrowhead geometry from C (`lib/common/arrows.c`) so the
port emits the correct shape per `arrowhead`/`arrowtail` type, fixing the 16
deep **arrowhead-geometry** dot-corpus cases deferred by the
`parity-low-hanging-fruit` mission. Two visible symptoms: `dot`/`odot` must emit
`<ellipse>` (13 cases), `crow`/`vee` must emit the 9-point polygon (3 cases).
Faithful per CLAUDE.md "the C is sacred": port the whole `Arrowtypes` dispatch
(8 types) + modifiers (open/side) + compound stacking + `arrowsize`, not just
the divergent types. Success = byte-match increases with **0 per-id
regressions** (`test/corpus/survey.ts`).

## Branch

`feature/arrowhead-geometry` — merge commit (one commit per task, referenced in
the decision journal). Do NOT squash.

## Target cases (16)

- **G1 dot/odot → `<ellipse>` (13):** 1408, 1447_1, graphs-arrows, graphs-b79,
  graphs-newarrows, graphs-root, linux.x86-arrows_dot, linux.x86-root_circo,
  linux.x86-root_twopi, macosx-arrows_dot, nshare-arrows_dot, nshare-root_circo,
  nshare-root_twopi.
- **G2 crow/vee → 9-pt polygon (3):** 144_no_ortho, 144_ortho, 2490.

Comparison pages: `../parity-low-hanging-fruit/comparisons/<id>.md`.

## Constraints

### Stop conditions
- STOP if a task needs changes outside its write-set not owned by another task.
- STOP on 2 consecutive quality-gate failures on the same check, or 3 consecutive
  fixes to the same location for the same case.
- STOP if a per-id **regression** (byte→structural/diverged, structural→diverged,
  anything→errored/timeout caused by the change) cannot be resolved in the task.
- STOP if the type-aware clip-length change (ADR-4) regresses a currently
  byte-matching non-normal-arrow case — investigate before proceeding.
- STOP if the oracle (native `dot`) is unavailable or unstable.

### Push forward
- Choosing helper/file decomposition within a task's write-set.
- Golden representative selection (corpus case vs synthetic + `fixedsize`).
- Wording of journal/golden descriptions.

## Quality gates (run between every batch)

```
- command: npm run typecheck      # pass: exit 0
- command: npm test               # pass: exit 0 (incl. golden suite)
- command: npm run build          # pass: exit 0
- command: git diff --name-only   # pass: matches the batch write-set only
```

Oracle: native `dot` 15.1.0 at `~/git/graphviz/build/cmd/dot/dot`,
`GVBINDIR=/tmp/gvplugins`, corpus `~/git/graphviz/tests`. Verify recipe (reused
from the prior mission): render port via `renderSvg` from `src/index.js` + native
`dot -Tsvg`, compare via `test/golden/compare.ts` `compareSvg(..., 'deterministic')`.
Never approximate — validate against the spawned native binary.

## Architecture decisions

See [decisions.md](decisions.md). Summary: typed draw-op list (ADR-1); geometry
computed at layout time, centralized in `arrows-shapes.ts` (ADR-2); full 8-type
table + modifiers + compound + arrowsize (ADR-3); type-aware clip length, guarded
by the 0-regression gate (ADR-4); one golden per arrow-type group (ADR-5);
parity regeneration is the success metric (ADR-6).

## Batches

| Batch | Theme | Tasks | Status |
|-------|-------|-------|--------|
| [1](batch-1/overview.md) | Geometry core (pure, unit-tested) | T1 types+resolution, T2 length+simple shapes, T3 complex shapes+modifiers+compound | [ ] |
| [2](batch-2/overview.md) | Wire-in (clip → store → emit) | T4 clip length, T5 layout storage, T6 SVG emit | [ ] |
| [3](batch-3/overview.md) | Verify + finalize | T7 goldens, T8 survey regen + 0-regression + memory | [ ] |

## Diagrams

- [data-flow.md](diagrams/data-flow.md) — attr → parse → length(clip) → shape → emit
- [component-map.md](diagrams/component-map.md) — modules touched

## Decision journal

Appended during execution: [decision-journal.md](decision-journal.md).

## Operational readiness

Pure layout/render library code. **Reversible** (git revert + regenerated
artifacts). No SLI/dashboard/on-call (the "SLI" is parity byte-match, measured by
the survey). Backwards-compat: SVG arrow shapes change (intended); `renderSvg`
signature unchanged; `getDrawOps`/xdot consumers gain ellipse/polyline arrow ops
(non-breaking addition).
