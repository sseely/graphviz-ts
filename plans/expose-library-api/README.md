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
| [3](batch-3/overview.md) | Entry points + wiring | T7 api barrel, T8 render barrel, T9 root + package.json | [x] |
| [4](batch-4/overview.md) | Docs + follow-on | T10 capability guides, T11 pack/pathplan brief | [x] |

\* Batch 2: T6 wrapper shipped; the underlying xdot renderer is
integration-incomplete (edges/colors) — fix deferred to a follow-on mission
per the decision journal (user decision 2026-06-21: "defer xdot fix; finish
mission"). T11 will scaffold the xdot-renderer follow-on alongside pack/pathplan.

## Diagrams

- [data-flow.md](diagrams/data-flow.md) — build/parse → layout → geometry/render
- [component-map.md](diagrams/component-map.md) — entry points over internals

## Decision journal

Appended during execution: [decision-journal.md](decision-journal.md).

---

## Mission summary (2026-06-21)

**Status: COMPLETE.** All 4 batches, 11 tasks done. Branch
`feature/expose-library-api`, 17 commits (merge to main with a merge commit per
the brief — do NOT squash; per-task commit IDs are referenced above).

### Tasks completed vs planned: 11 / 11
- **Batch 1** — T1 `createDefaultContext` (74b6b14), T2 `addEdge` (40617c4),
  T3 `getLayout` (2683f48).
- **Batch 2** — T4 builder (518e3d6), T5 `render()` (2ec3627), T6 `getDrawOps`
  (d457615) — wrapper shipped; xdot-renderer fix deferred (see below).
- **Batch 3** — T7 api barrel (08f5347), T8 render barrel (c4d1149), T9 root
  wiring + package exports (bfedb07); fix renderWithContext (514053c).
- **Batch 4** — T10 docs (0003125), T11 follow-on briefs (4b06640).

### Public surface delivered
- `graphviz-ts` (root) — existing `renderSvg`/`tryRenderSvg`/`parse`/errors
  (unchanged) **plus** re-exports of everything below + `renderWithContext`.
- `graphviz-ts/api` — `createGraph` builder (typed `GvNode`/`GvEdge` handles),
  `getLayout` geometry snapshot (`yAxis` flip, points), `addEdge`, opaque
  `Graph` type.
- `graphviz-ts/render` — `render(g, format, opts?)` over 8 formats,
  `getDrawOps` typed xdot draw-ops.
- `package.json` `exports` map (`.` / `./api` / `./render`); 3-bundle build.

### Decisions flagged for review
1. **Deferred xdot-renderer fix (user-approved).** T6 exposed that
   `createXdotRenderer` is integration-incomplete (edges emit no draw-ops,
   custom node colors ignored, node draw coords swapped). The geometry IS
   computed (SVG renders correctly); only the xdot emission path is incomplete.
   User chose "defer xdot fix; finish mission". `getDrawOps` ships as a correct
   thin wrapper with a documented limitation; the fix is scaffolded at
   `plans/fix-xdot-renderer/README.md`.
2. **`render` collision resolution.** Root `render` is now the public
   `render(g, format, opts?)`; the low-level device render is re-exported as
   `renderWithContext` (preserves the GvcContext workflow that guide/api.md
   documents).
3. **getLayout needs render() first** — no standalone public `layout()`; the
   verified invariant "freeLayout preserves coord/width/height" makes
   `render() → getLayout()` the supported geometry workflow.

### Quality gate results (final)
`npm run typecheck` exit 0 · `npm test` 2176 pass (163 files) · `npm run build`
3 bundles · `npm run docs:build` exit 0. Baseline was 2090 tests (156 files);
net +86 tests across the new surface.

### Known issues / follow-ups
- `plans/fix-xdot-renderer/README.md` — complete the xdot renderer emission.
- `plans/expose-pack-pathplan/README.md` — ADR-7 pack + pathplan exposure.
- ~~`.d.ts` type declarations are still not emitted by the build~~ — DONE
  (branch `chore/emit-declarations`): `build:types` runs
  `tsc -p tsconfig.build.json`; `exports` map carries `types` conditions for
  all three entries; verified by consumer self-reference type-check.
