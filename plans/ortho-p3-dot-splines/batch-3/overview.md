# Batch 3 — golden fixtures + native-C validation (+ reactive parity fixes)

End-to-end proof: TS `dot -Tsvg` matches **native C** `dot -Tsvg` for
`splines=ortho` graphs. **Precondition: ortho-P2 has pinned the render pipeline**
(`maze`/`partition`/`ortho-route`), so this is golden minting + validation. A
divergence should be dispatch/adapter-level (fix in `src/layout/dot/*`); a
pipeline-level divergence is a **P2 gap — STOP**, do not patch `src/ortho/*` here.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Ortho golden fixtures + native-C refs + manifest + validate (pipeline pre-pinned by P2) | sonnet | `test/golden/inputs/dot-ortho-*.dot`, `test/golden/refs/dot-ortho-*.svg`, `test/golden/manifest.json`, `src/layout/dot/*.ts` (dispatch/adapter fixes only) | T2 + **P2 complete** | [x] |

**Write-set expanded (flagged, user faithfulness mandate):** the parity fix
landed in `src/common/splines-clip.ts` (`arrowOrthoClip` port, `isOrtho`-gated),
a shared-clip faithful gap — not dot-dispatch, not the P2 pipeline. All 119
pre-existing goldens stayed conformant. See decision journal T3 rows.

## Dependency / file ownership
- T3 needs T1+T2 (full dispatch incl. labels) **and ortho-P2 green** (pipeline
  pinned). Fixes here are dispatch/adapter-level in `src/layout/dot/*`.
- `test/golden/manifest.json` is appended (new ortho entries only). **Do not
  modify existing entries.**

## Gate after batch (full mission gate)
- `npm run typecheck` 0 · `npm test` (all new ortho goldens pass against native-C
  refs; **every existing non-ortho golden conformant**) · `npm run build` OK.
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
