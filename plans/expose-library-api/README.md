# Mission: Expose the Graphviz library API (beyond rendering)

## Objective

Surface the full Graphviz "library" capability set — already implemented
internally — through an **idiomatic TypeScript public API**: programmatic graph
construction, attribute access, layout as a phase, **computed-geometry readout**
(node positions/sizes, edge splines, bounding boxes, label positions), and the
**already-built output formats** (dot, xdot, json, plain, imap, cmapx) plus
structured xdot draw-ops for custom renderers. Today only `renderSvg`/`parse`
are exposed; the engine already computes and stores everything else.

This is overwhelmingly **additive**. The internal C-faithful model stays
untouched ("the C source is sacred"); we wrap it in a thin, idiomatic layer.

Capability spec sources: the Gansner *Using Graphviz as a Library* guide and the
Graphviz Doxygen public-API index. The C library defines the **capabilities**,
not the API shape — the TS surface is idiomatic, not a `agnode`/`ND_coord` clone.

## Branch

`feature/expose-library-api` — squash? **No.** Merge commit (one commit per task,
referenced in the decision journal).

## Constraints (stop conditions)

- STOP if a task must change files outside its write-set not owned by another task.
- STOP if the `package.json` `"exports"` map breaks `import 'graphviz-ts'` (root
  must keep resolving to `dist/index.js`).
- STOP on 2 consecutive gate failures on the same check, or 3 consecutive fixes
  to the same location.
- STOP if computed geometry turns out not to be populated by an engine, or a
  capability is not externalizable as assumed (the stated project risk).
- PUSH FORWARD on naming polish, additive renderer options, fixtures, doc wording.

## Quality gates (run between every batch)

```
- command: npm run typecheck      # pass: exit 0
- command: npm test               # pass: exit 0
- command: npm run build          # pass: exit 0, all 3 entry outputs produced
- command: git diff --name-only   # pass: matches the batch write-set only
```

## Architecture decisions

See [decisions.md](decisions.md). Summary: thin facade (ADR-1); two subpath
entries `/api` + `/render` + discoverable root (ADR-2); geometry as materialized
snapshot (ADR-3); coordinate system optional, default screen y-down (ADR-4);
single `render(graph, format, opts)` (ADR-5); construction in scope with typed
`GvNode`/`GvEdge` handles + safe `addEdge` (ADR-6); `pack`/`pathplan` deferred to
a follow-on brief (ADR-7); string attribute get/set (ADR-8).

## Batches

| Batch | Theme | Tasks | Status |
|-------|-------|-------|--------|
| [1](batch-1/overview.md) | Foundations | T1 default-context, T2 addEdge, T3 geometry snapshot | [x] |
| [2](batch-2/overview.md) | Public surfaces | T4 builder, T5 render(), T6 xdot draw-ops | [x]\* |
| [3](batch-3/overview.md) | Entry points + wiring | T7 api barrel, T8 render barrel, T9 root + package.json | [ ] |
| [4](batch-4/overview.md) | Docs + follow-on | T10 capability guides, T11 pack/pathplan brief | [ ] |

\* Batch 2: T6 wrapper shipped; the underlying xdot renderer is
integration-incomplete (edges/colors) — fix deferred to a follow-on mission
per the decision journal (user decision 2026-06-21: "defer xdot fix; finish
mission"). T11 will scaffold the xdot-renderer follow-on alongside pack/pathplan.

## Diagrams

- [data-flow.md](diagrams/data-flow.md) — build/parse → layout → geometry/render
- [component-map.md](diagrams/component-map.md) — entry points over internals

## Decision journal

Appended during execution: [decision-journal.md](decision-journal.md).
