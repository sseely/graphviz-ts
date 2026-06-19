# Architecture Decisions — spline-segmentation (locked)

Treat each as locked. If a conflicting constraint surfaces, STOP and log it to
`decision-journal.md` — do not silently override.

## AD-1 — Match C exactly (faithful port)

The fix must reproduce C's spline-fitting / bezier-segmentation behavior
verbatim (`~/git/graphviz` is the spec). Do NOT simplify, smooth, or "improve"
the bezier output, and do NOT reorder side-effecting steps. Reference the C
`file:line` in JSDoc/comments for every ported branch.

## AD-2 — Diagnosis before fix (instrument C first)

Batch 1 T1 instruments the native oracle and dumps the ACTUAL spline
control-point list (count + coordinates) for a target input BEFORE any
hypothesis. The exact port function that diverges — and therefore T2's
write-set — is determined by T1's findings, not guessed up front. Default
assumption on divergence: "my port differs from C here — find where exactly"
(memory: `instrument-c-before-quarantine`).

- Recipe: rebuild `gvplugin_dot_layout` and copy to `/tmp/gvplugins` to
  instrument the dot layout plugin (NOT libgvc); see memory
  `recover-slack-and-c-harness` and `v8-prof-for-hangs`.

## AD-3 — Oracle-pinned verification; curated gate untouched

Each fix is verified per-input against the cached native-oracle SVG via the
existing survey harness (`render-one.ts` + `compare.ts`). The 3 segmentation
inputs must reach `byte-match` or `structural-match`; the per-id verdict diff vs
the pre-task `parity.json` must show **0 regressions**. The 128 curated goldens
(`test/golden/suite.test.ts` / `manifest.json`) are a SEPARATE must-stay-green,
byte-identical gate — never added to or modified.

## AD-4 — Batch 2: recover intent from the issue + MR

For each issue-numbered `path-structure` input (`NNNN.dot`), recover the
graphviz GitLab issue and its closing merge request before porting, to
understand the intended routing behavior (memory:
`issue-numbered-tests-consult-pr`):
- `git -C ~/git/graphviz log --all --grep '<num>'`
- `git -C ~/git/graphviz log --all -- tests/<file>`
- issue: `gitlab.com/graphviz/graphviz/-/issues/<num>` (WebFetch if available).

## Rollback classification
**Reversible** — additive/behavioral layout-render fix; revert the merge commit.
No data model, schema, API, or library-surface change.
