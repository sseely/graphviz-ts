# Mission: fix corpus 1949 divergence

## Objective
Bring corpus case `1949.dot` to byte-match parity with native graphviz.
Diagnosis is **complete** (see `.agent-notes/1949-diagnosis.md`): the
upstream MR that "fixes #1949" (`89e1d18a4 makeCompoundEdge`) is **already
ported** and only prevented a native assertion the port never had. 1949's
actual parity divergence has two independent, fully root-caused causes —
neither is compound-edge code:

- **D1 (geometry, primary — drives maxDelta 90.68):** HTML-like label text
  runs are not entity-decoded. The port measures the raw entity string
  `&#91;el...` (w≈33.8) instead of decoded `[el...` (w≈14.8), inflating the
  `structC->structParty` edge-label vnode and shifting the whole graph
  +18.7px. Minimal repro: `A->B[label=<&#91;el...>]` LR → port 186x48 vs
  native 167x44; plain `label="[el..."` matches.
- **D2 (color — the first-diff `@stroke`):** an HTML-table cell border
  (`SIDES="B"`) renders `black` instead of inheriting the node pen color
  (`red`).

## Branch
`fix/1949-html-label-parity` (cut from current `docs/reconcile-divergences`).

## Constraints (stop / push-forward)
See `decisions.md`. Key stops: any fix that changes >3 files outside the
declared write-set; a survey regression (any id flips diverged/errored that
was passing); D1 decode breaking `&amp;/&lt;/&gt;` emit round-trip.

## Quality gates
- `command: npx tsc --noEmit` — pass: exit 0 — on_fail: fix_and_rerun
- `command: npx vitest run src/common/` — pass: exit 0 — on_fail: fix_and_rerun
- `command: npx vitest run src/layout/dot/` — pass: exit 0 — on_fail: fix_and_rerun
- `command: npm run survey && npm run survey:gate` — pass: 0 net regressions,
  1949 leaves `diverged` — on_fail: stop

## Batches
| Batch | Focus | Status |
|-------|-------|--------|
| [Batch 1](batch-1/overview.md) | D1 entity-decode + D2 cell-border color | [x] (residual 2.97px y — follow-up) |

Batch 0 (instrument + root-cause) is already done — recorded in
`.agent-notes/1949-diagnosis.md` and `decisions.md`.

## Index
- [decisions.md](decisions.md) — architecture decisions + rejected hypotheses
- [batch-1/overview.md](batch-1/overview.md)
- [batch-1/T1-html-entity-decode.md](batch-1/T1-html-entity-decode.md) (D1)
- [batch-1/T2-cell-border-color.md](batch-1/T2-cell-border-color.md) (D2)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)
