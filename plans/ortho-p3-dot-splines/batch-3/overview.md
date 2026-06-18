# Batch 3 — golden fixtures + native-C validation (+ reactive parity fixes)

End-to-end proof: TS `dot -Tsvg` matches **native C** `dot -Tsvg` for
`splines=ortho` graphs. This validates the whole ortho render pipeline
(`orthoEdges`/`maze`/`partition`/`ortho-route`), which is unpinned beyond P1's
bottom layer. Divergences are fixed faithfully via the P1 tiny-harness recipe.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Ortho golden fixtures + native-C refs + manifest + validate; drill+fix maze/partition on divergence | sonnet | `test/golden/inputs/dot-ortho-*.dot`, `test/golden/refs/dot-ortho-*.svg`, `test/golden/manifest.json`, `src/ortho/*.ts` (only if parity fixes needed) | T2 | [ ] |

## Dependency / file ownership
- T3 needs T1+T2 (full dispatch incl. labels). Its `src/ortho/*` write-set is
  disjoint from T1/T2's `src/layout/dot/*` — no conflict.
- `test/golden/manifest.json` is appended (new ortho entries only). **Do not
  modify existing entries.**

## Gate after batch (full mission gate)
- `npm run typecheck` 0 · `npm test` (all new ortho goldens pass against native-C
  refs; **every existing non-ortho golden byte-identical**) · `npm run build` OK.
- `git -C ~/git/graphviz status --porcelain lib/` shows no tracked `.c/.h` change.
- `git diff --name-only` shows only `src/layout/dot/**`, `src/ortho/**`,
  `test/golden/**`, `plans/**`.
- **STOP** if a non-ortho golden changes, or the same maze/partition site is
  fixed 3× without converging (consecutive-fix rule).

## Oracle recipe (shared)
- **Refs:** native `dot -Tsvg` via `/tmp/gvmine` (`GVBINDIR=/tmp/gvmine dot`);
  build the dot layout plugin with `make` in `~/git/graphviz/build` if needed,
  then **revert C**. Normalize SVG per the existing `test/golden/normalize.ts`
  before pinning.
- **maze/partition drill (only on divergence):** P1 tiny-harness recipe — link
  prebuilt `libortho.a`+`libutil.a`(+`libcgraph.dylib`), zero C-tree edits. See
  `[[ortho-p1-already-ported-fpq-invariant]]`. Harnesses in `/tmp/ortho-oracle`.
