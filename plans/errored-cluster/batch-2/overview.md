<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Cluster/mincross crashes (sequential)

RC1–RC3. Each is a faithful-port invariant gap in cluster/mincross layout, fixed
against native-dot ground truth (ADR-1). Write-sets are disjoint but tasks run
**sequentially** (ADR-3): one task → full vitest suite → next, so any regression
is attributed to a single change. This is the 2471-saga minefield — instrument C,
do not guess.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T2 | RC1: `flatReorderRank` temprank undercount (`temprank[i]` undefined when `temprank.length < rk.n`) | `src/layout/dot/mincross-flat.ts`, `…mincross-flat.test.ts` (new) | — | [ ] |
| T3 | RC2: `mapPathLongSingle` null-head walk (`e.head.info.out!.list[0]` undefined) | `src/layout/dot/cluster-path.ts`, `…cluster-path.test.ts` (new) | T2 (sequence only) | [ ] |
| T4 | RC3: `buildSkeletonEdgeCounts` null `rankleader[r]`/`.out` | `src/layout/dot/cluster.ts`, `…cluster.test.ts` (existing) | T3 (sequence only) | [ ] |

`Depends On` here encodes execution order (ADR-3), not a data dependency — the
write-sets do not overlap.

## Methodology
- **The C is the spec.** For each RC, read the matching C function, instrument it
  on one failing case (rebuild `gvplugin_dot_layout`, copy to `/tmp/gvplugins`,
  dump the intermediate values), and find where the port's state diverges. Fix
  the divergence, not the symptom. @see memory `recover-slack-and-c-harness`,
  `instrument-c-before-quarantine`.
- C references: RC1 → `lib/dotgen/mincross.c:flat_reorder`/`reorder`; RC2 →
  `lib/dotgen/cluster.c:map_path`; RC3 → `lib/dotgen/cluster.c:build_skeleton`.
- After each task: full `npm test` (~2241). A broken existing test means the fix
  diverges from C — rework the fix, never edit the test (stop condition).
- Watch the Map-vs-nlist and calloc-zero hazards (memory
  `map-vs-nlist-iteration-hazard`, `calloc-zero-vs-undefined-port-hazard`):
  C arrays/nlist include virtual nodes and zero-init fields; port optionals
  default to `undefined`, so `temprank` undercount and null `.out` likely stem
  from a missed virtual/zero-init node.

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; the 6 RC1-3 cases no
longer throw; `git diff --name-only` matches the Batch-2 write-set.
