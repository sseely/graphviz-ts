# T1 — Investigate the dot pack-branch wiring + cluster oracle

## Context

graphviz-ts is a faithful TS port of C Graphviz (`~/git/graphviz` = spec). Corpus
**2458** (`digraph { pack=1; q16; q1 -> q2[label=connected] }`) is `diverged`: the
port's `dotLayoutEntry` (`src/layout/dot/index.ts`) calls `dotLayoutPipeline(g)`
directly and is missing C's `doDot` wrapper (`dotinit.c:doDot` ≈437-500) that, when
`pack` is set, decomposes via `cccomps`, lays out each component, and
`packSubgraphs`-packs them. Native = 132×116 (q16 bottom-right cy=-32); port =
164×133 top-aligned.

Already established this session (trust, but verify with probes):
- `src/layout/pack/index.ts` exports `ccomps`/`cccomps`, `getPack`,
  `getPackModeInfo`, `getPackInfo`, `packSubgraphs`, `PackMode`.
- The port's pack ops run in **points on `n.info.coord`** (`shiftGraphs` shifts
  `n.info.coord`, ll.204-206) — so C's inches/`ND_pos` `attachPos`/`resetCoord` are
  **NOT** needed.
- `ccomps` `buildSubgraph` aliases root node objects (laying out a component moves
  the root's nodes) but makes a **fresh `info`** (no drawing-info seed) and copies
  only nodes+edges (**no cluster subgraphs**).
- twopi template: `src/layout/twopi/pipeline.ts:layoutMulti` (layout each comp →
  `packSubgraphs`).

## Task

**Enumerate**, with instrumented evidence, exactly what the dot pack branch needs.
Read-only: revert all source probes (`git checkout --`) before finishing; the only
file you write is the findings doc.

Answer each, with evidence:
1. **initSubg need (ADR-2):** Does `dotPhaseInit(sg)` on an `ccomps` component
   subgraph correctly derive `nodesep/ranksep/rankdir/flags/has_labels/rank` from
   the inherited attr chain (`sg.root`), or are they `undefined`/wrong → requiring
   an `initSubg` seed? Probe by building `ccomps(g)` for 2458 and running
   `dotLayoutPipeline` on a component; inspect `sg.info`.
2. **packCall params:** Confirm `getPackInfo`/`getPackModeInfo` for `pack=1`
   (no `packmode`) yield `mode=l_graph`, `margin=1`, and that `doSplines` must be
   set true. Confirm `packSubgraphs(ncc, comps, g, pinfo)` over per-component-laid
   `comps` reproduces native's 132×116 / q16-bottom-right (or pin the gap).
3. **Root finalization:** Confirm the root must NOT re-run `dotLayoutPipeline` in
   the pack branch (each component does); identify where the root bbox/`GD_bb` gets
   set (packSubgraphs `computeSubgraphBB`) and whether any root-level post-step
   (label, `dotPhasePost` pieces) is still required.
4. **ratio guard:** Confirm the C `ratio_kind==R_NONE` guard location + how the port
   reads `ratio` (`g.info.drawing`?), so the fallback to whole-graph layout is faithful.
5. **Cluster carry + oracle (T3):** State what `copyClusterInfo`/`copyCluster`/
   `mapClust` need (each component must carry its cluster subgraphs so
   `dotLayoutPipeline` builds `GD_clust`). **Find a clustered multi-component dot
   corpus case** (scan `~/git/graphviz/tests` for `pack` + `cluster`/`subgraph
   cluster` + ≥2 components; cross-check the diverged list in
   `test/corpus/parity.json`). If none exists, specify a minimal **synthetic** dot
   graph for T3's golden.
6. **No-pack path:** Confirm `dotLayoutEntry` must call `dotLayoutPipeline(g)`
   unchanged when `mode==l_undef && Pack<0`.

## Read-set

- `src/layout/dot/index.ts:108-172` (dotPhase*, dotLayoutPipeline, dotLayoutEntry)
- `src/layout/pack/index.ts:253-320` (ccomps/buildSubgraph), `:152` (packSubgraphs),
  `:394-419` (getPack*/getPackInfo), `:162-210` (shiftGraphs)
- `src/layout/twopi/pipeline.ts` (layoutMulti template)
- C: `~/git/graphviz/lib/dotgen/dotinit.c:344-500` (initSubg/attachPos/resetCoord/
  copyCluster/copyClusterInfo/doDot)

## Write-set

- `plans/fix-pack-dot-2458/comparisons/T1-investigation.md` (create)

## Interface contract (output → T2/T3)

End the findings doc with a fenced block of exactly this shape:

```
initSubgNeeded: <true|false>   # ADR-2 — with evidence
packCall: { mode: <l_graph|l_node>, margin: <int>, doSplines: <true|false> }
rootRerank: false              # confirm the root does not re-run dotLayoutPipeline
ratioGuardField: <how the port reads ratio_kind / R_NONE>
clusterCarryNeeded: <true|false>
clusterOracleCase: <corpus id | "synthetic: <one-line dot>">
fixFiles: src/layout/dot/index.ts, src/layout/dot/pack-components.ts
writeSetAssumptionBroken: <true|false>
```

## Acceptance criteria

- Given probes on 2458, when run, then initSubg need, packCall params, and the
  root-finalization requirement are each stated with supporting trace output.
- Given the cluster question, when complete, then a real or synthetic cluster oracle
  for T3 is named.
- Given the analysis, when the fix locus is outside `index.ts` +
  `pack-components.ts` (+ tests/goldens), then STOP and flag in the decision journal.
- Given any source instrumentation, when finished, then `git status` shows no
  modified `src/` files (probes reverted) — only the findings doc.

## Boundaries

- **Never:** commit instrumented source; modify `src/layout/pack/**` or
  `src/layout/twopi/**`; leave probes in the diff.
- **Always:** revert probes with `git checkout --` before finishing.

## Observability / Rollback

N/A — read-only investigation; produces one markdown doc. Reversible.

## Commit

`docs(T1): pin dot pack-branch wiring + cluster oracle for 2458`
