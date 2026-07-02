<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Root-cause the 2 lost edges (a->b, o->r)

## Context
`2183.dot`: strict digraph, concentrate=true, splines=ortho, 3 clusters.
Port renders 19 edge groups vs oracle 21; missing `<title>a->b` and
`<title>o->r`. Both sides exit 0. Prime suspect: ortho concentrate dedup
(`src/layout/dot/ortho-adapter.ts:buildEdges`, unordered-pair Set — the
2361 fix class); alternates: maze routing loss (src/ortho/maze.ts,
ortho-route.ts), emit skip.

## Task
Instrument (port first; C only if needed — conc.c + lib/ortho) to pin
where the two edges leave the pipeline. State the mechanism per
diagnosis.md; empty ruledOut = not done. C tree ends reverted, rebuilt,
oracle stdout byte-verified.

## Read-set
src/layout/dot/ortho-adapter.ts (all, 116 lines);
src/ortho/{maze,ortho-route}.ts as reached; ~/git/graphviz/lib/dotgen/conc.c;
memory: 2361-ortho-concentrate-dedup-done, ortho-maze-corridor-tiebreak.

## Interface output (consumed by T4)
`{cause, origin: file:line, causalChain, ruledOut[]}` in
.agent-notes/2183-lost-edges.md.

## Acceptance criteria
- Given the instrumentation, when 2183 renders, then the exact drop site
  of BOTH edges is identified with evidence.
- Given C, when its handling of the same edges is captured, then the
  faithful behavior is documented (what C keeps/merges and why).
- Given the artifact, then ruledOut lists ≥1 eliminated hypothesis.

## Observability / Rollback
N/A — diagnosis only. Reversible (docs commit).

## Commit
`docs(T1): root-cause 2183 lost edges — <mechanism one-liner>`
