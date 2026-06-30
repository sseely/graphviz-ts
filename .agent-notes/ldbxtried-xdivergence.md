<!-- SPDX-License-Identifier: EPL-2.0 -->
# T0 finding — ldbxtried X-coordinate / ordering divergence

## Structured output (interface for T1)
```
{
  divergentStage: "cluster-mincross-order",
  rootCause: "ED_xpenalty under-counted on intercluster parallel multi-edge",
  cValue:  "rcross(r=3)=19; edge n488->n2 ED_xpenalty=2",
  portValue:"rcross(r=3)=17; edge n488->n2 xpenalty=1",
  cRule: "interclexp (cluster.c:158) iterates agfstedge(g,n) = out-edges sorted by head.id,seq THEN in-edges sorted by tail.id,seq; parallel intercluster multi-edges land adjacent so prev matches and merge_chain(...,false) (cluster.c:183) accumulates ED_xpenalty into the DIRECT fast edge rcross reads",
  fixTarget: "src/layout/dot/cluster.ts::interclexp"
}
```

## How it was found (paired C/port LDBG instrumentation, all reverted)
1. Per-rank node-order dump (end of mincross): port X positions faithfully honor
   the port's mincross ORDER, so this is a true within-rank reorder, not an
   x-coord under-constraint. C order r6 `n526,n513,n518` / r3 `n449,n474`;
   port r6 `n518,n526,n513` / r3 `n474,n449`.
2. Phase dump (after-comp / after-merge2 / after-remincross): port == C EXACTLY
   through after-merge2. They diverge ONLY in the ReMincross pass
   (`mincross(g,2)`, ReMincross=true).
3. ReMincross per-iteration trajectory + crossing counts: both reach the SAME
   good order `n526,n513,n518` at iter4-7, but the crossing counts differ, so
   `restore_best` restores different winners:
   - C: `n526,n513,n518`=90  < `n518,n526,n513`=92  -> keeps n526,n513,n518
   - port:`n518,n526,n513`=84 < `n526,n513,n518`=88 -> keeps n518,n526,n513
4. Per-rank rcross at ReMincross entry (identical real order): ONLY r=3 differs
   (C nc=19, port nc=17; same n=17, nextn=14).
5. Full r=3/r=4 node+out-edge dump: node sequences IDENTICAL. The ONLY diff is
   edge `n488->n2` ED_xpenalty: C=2, port=1.
6. merge_chain traces: C fires THREE merges for n488->n2 — two into the cluster
   skeleton chain `%0->n2` (->3) AND one into the DIRECT `n488->n2` fast edge
   (->2, from interclexp cluster.c:183). The port fires only the first two
   (`_v->n2`); the interclexp merge into the direct edge NEVER fires.
7. interclexp edge-order probe: port processes n488's two `->n2` edges
   NON-adjacently (`n488->n2`, then `n488->n469`, then `n488->n2`), so
   `prev != first n488->n2` -> interclexpMergeable=false -> no merge.

## Exact bug
`cluster.ts:interclexp` iterates `for (const e of g.edges) { if incident to n }`
(global g.edges INSERTION order). C iterates `agfstedge(g,n)` =
`agfstout`(sorted head.id,seq) then `agfstin`(sorted tail.id,seq, self-loops
once). Insertion order does NOT keep parallel multi-edges adjacent, so the
`prev`-chaining multi-edge merge in `interclexpMergeCase`/`interclexpFlat`
misses parallels -> their ED_xpenalty is not merged into the direct rep edge
that `rcross` reads -> wrong crossing counts under ReMincross -> wrong best
within-rank order -> X-coord cascade (13 nodes).

## Fix (for Batch 1, faithful)
In `interclexp`, replace the `g.edges`-filtered inner loop with iteration over
node n's incident edges in `agfstedge` order:
`[...n.outEdges(g), ...n.inEdges(g)]` (outEdges already sorts head.id,seq;
inEdges sorts tail.id,seq and excludes self-loops — exactly agfstedge). Keep the
`agContainsEdge(subg,e)` skip and per-node `prev=undefined` reset. No other
file. Stays inside the cluster surface (stop-condition 1 NOT triggered).

## Verify after fix
- C oracle: `n488->n2 ED_xpenalty=2`, `rcross(r=3)=19`.
- Port must match; mincross final order r6 `n526,n513,n518`, r3 `n449,n474`.
- node n454 -> C x=772.89 (mission repro).
