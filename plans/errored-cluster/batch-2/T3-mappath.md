<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — RC2: mapPathLongSingle null-head walk

## Context
`mapPathLongSingle` (src/layout/dot/cluster-path.ts:154) crashes in
`while ((e.head.info.rank ?? 0) !== (to.info.rank ?? 0)) e = e.head.info.out!.list[0]`
— `e.head` or `e.head.info.out` is undefined, so the walk derefs null. In C
`map_path` (cluster.c) the virtual chain from `from` to `to` is fully linked, so
the walk always reaches `to`. Crash path: `mincrossClust → expandCluster →
interclexp → interclexpOneEdge → makeInterclustChain → mapPath →
mapPathLongSingle`. Cases: `1332.dot`, `graphs/b53.gv`.

## Task
1. Read `mapPathLongSingle` + `mapPath` + `makeInterclustChain` (cluster-path.ts)
   and C `map_path` (cluster.c).
2. Instrument C `map_path` on `1332.dot`: dump the virtual edge chain
   (tail→head per hop, ranks, `out` list sizes) for the failing edge. Compare to
   the port — find where the chain is shorter/unlinked vs C (likely a virtual
   node whose `out` list wasn't installed, or a `to_virt` reassignment the port
   missed).
3. Fix the chain construction so the walk reaches `to` as in C. Do NOT guard the
   `.out!.list[0]` deref (ADR-1).
4. Add `src/layout/dot/cluster-path.test.ts` asserting both cases render.

## Write-set
- `src/layout/dot/cluster-path.ts`
- `src/layout/dot/cluster-path.test.ts` (create)

## Read-set
- `src/layout/dot/cluster-path.ts:145-185` (mapPathLongSingle, mapPath)
- `~/git/graphviz/lib/dotgen/cluster.c:map_path`
- decisions.md#adr-1, #adr-3
- memory: `calloc-zero-vs-undefined-port-hazard`, `edgenormalize-ndout-vs-ndother`

## Interface outputs
None (internal layout fix).

## Acceptance criteria
- Given `1332.dot` and `graphs/b53.gv`, when `renderSvg(_, 'dot')`, then no throw
  (was `Cannot read properties of undefined (reading 'head')`).
- Given native `map_path` instrumented on `1332.dot`, when the chain is walked,
  then the port follows the same node sequence from `from` to `to` (faithful).
- Given the full vitest suite, then it stays green (0 regressions).

## Observability / Rollback
N/A — pure layout fix. Reversible.

## Quality bar
`npm run typecheck && npm test` green (full suite). One commit:
`fix(cluster): link intercluster virtual chain so map_path reaches target (T3)`.

## Boundaries
- Only `cluster-path.ts`. If the missing link is installed upstream
  (e.g. in `cluster.ts`), STOP and re-scope rather than editing another file.
