# T7 — Goldens per arrow-type group

## Context
Add one byte-matching golden per arrow-type group (ADR-5) to guard the new
geometry. Normal/inv are already covered by existing goldens.

## Task
For each group, create `test/golden/inputs/<id>.dot`, generate the ref with native
`dot` (`GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg <in> > ref`),
add a `manifest.json` entry, and bump the count in `suite.test.ts`. Verify the
port byte-matches each (compareSvg deterministic) before committing.
Groups: `dot-arrow-dot` (dot/odot ellipse), `dot-arrow-crow` (crow/vee 9-pt),
`dot-arrow-box`, `dot-arrow-diamond`, `dot-arrow-tee`, `dot-arrow-curve`,
`dot-arrow-compound` (e.g. `crowdot`), `dot-arrow-side` (e.g. `lnormal`).
Use a small graph; add `fixedsize=true` nodes where only the arrow shape matters
so node-size font metrics don't perturb geometry. Prefer a representative corpus
case (e.g. graphs-arrows / 2490) when it byte-matches; else synthetic.

## Write-set
- `test/golden/inputs/dot-arrow-*.dot` (create)
- `test/golden/refs/dot-arrow-*.svg` (create, native-oracle output)
- `test/golden/manifest.json` (append entries)
- `test/golden/suite.test.ts` (bump count assertion + comment)

## Read-set
- `test/golden/manifest.json` (entry format), `test/golden/suite.test.ts` (count)
- `test/golden/compare.ts` (compareSvg)
- decisions.md#adr-5

## Acceptance criteria
- Given each new golden input, when rendered by the port, then `compareSvg(...,
  'deterministic')` passes against the native-oracle ref.
- Given `npm test`, then the golden suite count assertion matches the new total
  and all golden tests pass.
- Given `dot-arrow-dot`, then its ref contains `<ellipse`; `dot-arrow-crow`
  contains a 9-pt `points=`.

## Observability / Rollback
N/A. Reversible.

## Quality bar
`npm run typecheck && npm test` green. One commit: `test(golden): arrow-type
geometry goldens (T7)`.

## Boundaries
- Refs must be native-`dot` output (never hand-edited). One representative golden
  per group (ADR-4 of the corpus harness) — not every corpus case.
