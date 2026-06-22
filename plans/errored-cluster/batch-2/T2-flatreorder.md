<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — RC1: flatReorderRank temprank undercount

## Context
`flatReorderRank` (src/layout/dot/mincross-flat.ts:179) crashes at
`rk.v[i] = temprank[i]; rk.v[i].info.order = i + baseOrder` when
`temprank.length < rk.n` — `temprank[i]` is `undefined`, then `.info` throws.
`temprank` is built by `flatReorderBuildTemprank`; in C `flat_reorder`
(mincross.c) the temprank is constructed to hold exactly the rank's nodes.
Crash path: `dotMincross → runClusters → mincrossClust → flatReorder →
flatReorderRank`. Cases: `121.dot`, `2239.dot`, `258.dot` (all cluster graphs).

## Task
1. Read `flatReorderRank` + `flatReorderBuildTemprank` + `flatReorderFixEdges`
   (mincross-flat.ts) and C `flat_reorder` (mincross.c).
2. Instrument C `flat_reorder` on `121.dot`: dump the rank size and the temprank
   contents/length it produces. Compare to the port's `temprank` for the same
   rank — find why the port undercounts (likely a virtual/zero-init node the
   build loop skips; see calloc-zero + Map-vs-nlist hazards).
3. Fix the temprank construction (or the loop bound) so the port matches C. Do
   NOT guard the `temprank[i]` write — that masks the divergence (ADR-1).
4. Add `src/layout/dot/mincross-flat.test.ts` asserting the 3 cases render and a
   focused unit on the temprank length where practical.

## Write-set
- `src/layout/dot/mincross-flat.ts`
- `src/layout/dot/mincross-flat.test.ts` (create)

## Read-set
- `src/layout/dot/mincross-flat.ts` (flatReorderRank, flatReorderBuildTemprank)
- `~/git/graphviz/lib/dotgen/mincross.c:flat_reorder` (+ `reorder`)
- decisions.md#adr-1, #adr-3
- memory: `map-vs-nlist-iteration-hazard`, `calloc-zero-vs-undefined-port-hazard`

## Interface outputs
None (internal layout fix).

## Acceptance criteria
- Given `121.dot`, `2239.dot`, `258.dot`, when `renderSvg(_, 'dot')`, then no
  throw (was `Cannot read properties of undefined (reading 'info')`).
- Given native `flat_reorder` instrumented on `121.dot`, when temprank is built,
  then the port's temprank fills `rk.n` with the same node sequence (faithful,
  not guarded).
- Given the full vitest suite, then it stays green (0 regressions).

## Observability / Rollback
N/A — pure layout fix. Reversible.

## Quality bar
`npm run typecheck && npm test` green (full suite). One commit:
`fix(mincross): build flat-reorder temprank to full rank width (T2)`.

## Boundaries
- Only `mincross-flat.ts`. If the root cause sits in a sibling (e.g.
  `flatReorderBuildTemprank` calls into another module), STOP and log it —
  do not expand the write-set without re-scoping.
