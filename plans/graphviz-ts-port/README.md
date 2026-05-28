# Graphviz TypeScript Port — Mission Brief

## Objective

Faithful TypeScript port of the Graphviz `lib/` layer targeting SVG output
(`dot -Tsvg`). Faithfulness is the primary constraint. Every algorithm,
numerical constant, convergence tolerance, special case, and ordering
dependency must be reproduced exactly. The C source is THE SPEC.

## Branch

`main` — new repo, no existing code.

## Source Material

| Resource | Path |
|----------|------|
| C source (canonical spec) | `~/git/graphviz/lib/` |
| Architecture synthesis | `~/git/graphviz/docs/architecture/lib-analysis.md` |
| Per-folder stubs (T1–T31) | `~/git/graphviz/docs/architecture/lib-analysis-wip/` |
| Full per-folder analyses | `~/git/graphviz/docs/architecture/lib/` |
| TS type + file mapping | `~/git/graphviz/docs/architecture/typescript-port.md` |
| Dependency graph | `~/git/graphviz/docs/architecture/lib-analysis-wip/interconnections.md` |

## Quality Gates (run after every batch)

```bash
tsc --noEmit                                      # must exit 0
vitest run                                        # must exit 0
git diff --name-only HEAD | grep -vE "^(src|test|plans)/"  # must be empty
```

After Batch 11 only:
```bash
./test/golden/run.sh                              # zero diff lines, all 50 graphs
wc -l src/**/*.ts | sort -n | tail -5             # no file over 600 lines
```

## Stop Conditions

1. SVG output does not match C binary within tolerance
   (±0.01 pt deterministic engines; ±0.5 pt iterative engines)
2. CDT `DT_OSET` iteration order diverges from C `dtfirst`/`dtnext`
3. Algorithm requires C-specific behavior (signed overflow, `long double`)
   with no safe TypeScript equivalent and no documented workaround
4. A batch introduces a regression in a previously passing golden-file test
5. MT19937 PRNG output diverges from C reference on any seed value
6. Task write-set must expand to files outside its declared set
7. Two consecutive quality-gate failures on the same check after fix attempts
8. **A failing test can only be made to pass by changing a test assertion
   rather than fixing the implementation** (see AD-13). STOP immediately,
   log to `decision-journal.md`, wait for human input. Never alter a test.

## Push-Forward Conditions

- Purely stylistic choice with no behavioral impact
- Task is simpler than estimated; fewer steps needed
- Error message is self-explanatory with an obvious, local fix
- Minor/patch dependency version bump with no API change

## Batch Progress

| Batch | Name | Tasks | Status |
|-------|------|-------|--------|
| 1 | Type System and Graph Model | T1–T6 | [x] |
| 2 | Foundation Algorithms | T7–T11 | [x] |
| 3 | DOT Parser | T12–T13 | [x] |
| 4 | Geometry Primitives | T14–T17 | [x] |
| 5a | Common Layer — Types & Color | T18–T19 | [x] |
| 5b | Common Layer — Labels, Text, Arrows | T20–T22 | [x] |
| 5c | Common Layer — Splines & Emit | T23–T24 | [ ] |
| 6 | GVC Orchestration | T25–T27 | [ ] |
| 7 | Renderers | T28–T31 | [ ] |
| 8 | dot Layout Engine | T32–T39 | [ ] |
| 9 | neato Family | T40–T47 | [ ] |
| 10 | Remaining Layout Engines | T48–T52 | [ ] |
| 11 | Integration & Golden-File Tests | T53–T56 | [ ] |

**Execution order:** 1 → (2 ‖ 3) → 4 → 5a → 5b → 5c → 6 → 7 → 8 → 9 → 10 → 11

Batches 2 and 3 may run in parallel. Within each batch, tasks marked ‖ in
their overview may run in parallel; tasks marked → are sequential.

## Document Index

- [decisions.md](decisions.md) — 13 architecture decisions (locked); AD-13 governs test discipline
- [decision-journal.md](decision-journal.md) — append during execution
- [diagrams/data-flow.md](diagrams/data-flow.md) — dot -Tsvg sequence
- [diagrams/component-map.md](diagrams/component-map.md) — module deps
- Batch specs: [1](batch-1/overview.md) [2](batch-2/overview.md)
  [3](batch-3/overview.md) [4](batch-4/overview.md)
  [5a](batch-5a/overview.md) [5b](batch-5b/overview.md)
  [5c](batch-5c/overview.md) [6](batch-6/overview.md)
  [7](batch-7/overview.md) [8](batch-8/overview.md)
  [9](batch-9/overview.md) [10](batch-10/overview.md)
  [11](batch-11/overview.md)

## Startup Sequence (after compaction)

1. Re-read this file
2. Re-read `decision-journal.md`
3. Find first batch with `[ ]` status
4. Read that batch's `overview.md`
5. Resume from first incomplete task
