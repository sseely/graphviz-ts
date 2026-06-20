# T2 Findings: Aux-Construction Input Parity — C vs Port

## Most-likely cause (first 15 lines)

**`rank=source` subgraph pinning `auxt` is ABSENT from the port.**

C places `auxt` into a `subg` with `rank="source"` inside `auxg`
(dotsplines.c:1170-1178). `dot1_rank` -> `collapse_sets` detects this
subgraph, calls `collapse_rankset` -> sets `auxg.minset = auxt`. Then
`minmax_edges` reverses all incoming edges of `auxt`, and `minmax_edges2`
adds zero-weight virtual edges from `auxt` to every disconnected node,
ensuring the network-simplex assigns `auxt` rank 0 and forces every other
node to ranks >= 1.

The port's `buildFlatAux` (splines-flat.ts:149-166) adds `auxt` directly
into `auxg.nodes` with NO subgraph and no `rank=source`. The port's ranker
`dotRank -> dot1Rank -> collapseSets` does iterate `g.subgraphs.values()`
(rank.ts:311), but `auxg.subgraphs` is always empty -> `minset` stays
`undefined` -> network-simplex runs with no source pin.

**Confirmable by pure source reading — no C run needed for the gap's
existence. T3 runtime dump needed to confirm the exact rank values
(auxt/auxh ranks in C) and rule out any secondary mechanism.**

---

## Suspect-ranked list (most-likely first)

| # | Input | cReplicated | rankImpact | Note |
|---|-------|-------------|------------|------|
| 1 | `rank=source` subgraph pinning `auxt` | **no** | **high** | C: `agsubg(auxg,"xxx",1)` + `agset(subg,"rank","source")` + `cloneNode(subg,tn)` (dotsplines.c:1170-1178). Port: `cloneNode(auxg, ...)` directly into auxg, no subgraph ever created (splines-flat.ts:153). `collapseSets` at rank.ts:311 iterates `g.subgraphs.values()` but auxg.subgraphs is always empty. `minset` is never set -> no edge reversals -> no source pin -> auxt is not forced to rank 0. Root cause. |
| 2 | `hvye` heavy ordering edge (weight=10000) | **partial** | **low** | Weight 10000: both sides set it correctly (dotsplines.c:1197, splines-flat.ts:164). Selection rule (first portless edge): both match (dotsplines.c:1189, splines-flat.ts:161). Synthetic fallback: C uses `agedge(auxg,auxt,auxh,NULL,1)` (line 1194); port uses `new EdgeClass(auxt,auxh,'')` + push (splines-flat.ts:163). Functionally equivalent. Minor: port does NOT set the back-reference `ED_alg(hvye)=e` for the first portless case (C line 1191). Does not affect ranking. |
| 3 | `cloneEdge` direction for reversed back-edge | **yes** | **low** | C: `if(agtail(e)==tn) auxt->auxh else auxh->auxt` (dotsplines.c:1184-1187). Port: `orig.tail === otn ? auxt->auxh : auxh->auxt` (splines-flat.ts:140-141), `otn=edges[0].tail`. In TB flip=false otn==tn. Both produce the same direction for the same NORMAL edge. Confirmed equivalent. |
| 4 | `GD_flip`/rankdir setup + auxt/auxh swap | **yes** | **low** | C: `cloneGraph` sets RANKDIR_LR for non-flipped parent (dotsplines.c:787-790); `if(GD_flip(g)) SWAP(&tn,&hn)` (line 1175) is no-op for TB. Port: `cloneGraph` sets flip=true/rankdir=LR for non-flipped parent (splines-flat.ts:75-87); flip ternary at clone time (lines 153-154) reduces to otn=tn for flip=false. Equivalent for the TB case. |
| 5 | `dot_init_node_edge` timing + `setEdgeType` | **partial** | **low** | C: `setEdgeType(auxg, et)` (line 1200) THEN `dot_init_node_edge` (line 1201). Port: `_et` parameter is unused (underscore prefix, splines-flat.ts:266); `dotInitNodeEdge(aux.auxg)` called at line 268 with no prior `setEdgeType`. However port's `cloneGraph` copies `g.info.flags` (splines-flat.ts:71) which already carries the EDGETYPE in the low nibble from the outer graph's `setEdgeTypeFromAttr`. For EDGETYPE_SPLINE this preserves the type accidentally. Latent gap but not the active bug. |
| 6 | `GD_dotroot` / `GD_gvc` presence | **yes** | **low** | C: `GD_gvc(auxg)=GD_gvc(g)` (line 1198), `GD_dotroot(auxg)=auxg` (line 1199). Port: `auxg.info.dotroot=auxg` (splines-flat.ts:84), `auxg.info.gvc=g.info.gvc` (line 85) in `cloneGraph`. All present. |

---

## `rank=source` subgraph: present / absent / not-honorable

**ABSENT from the port.**

C line references:
- dotsplines.c:1170 `subg = agsubg(auxg, "xxx", 1)` — subgraph created in auxg
- dotsplines.c:1171 `agbindrec(subg, "Agraphinfo_t", ...)` — info attached
- dotsplines.c:1172 `agset(subg, "rank", "source")` — source constraint set
- dotsplines.c:1178 `auxt = cloneNode(subg, tn)` — auxt placed INTO subg (not auxg directly)

Port line reference:
- splines-flat.ts:153 `const auxt = cloneNode(auxg, flip ? edges[0].head : otn)`
  — auxt goes directly into auxg; no subgraph is created anywhere in
  `buildFlatAux` or `cloneGraph`.

**The port's ranker CAN honor `rank=source` if the subgraph exists.**
Evidence: `rankSetClass` at rank.ts:169-173 checks `g.attrs.get('rank')`
and returns `SOURCERANK` for `'source'`. `collapseSets` at rank.ts:310-319
iterates `g.subgraphs.values()` and calls `collapseRankset(rg, subg,
SOURCERANK)`, which sets `rg.info.minset`. `minmaxEdges` at rank.ts:372
reverses incoming edges of minset; `minmaxEdges2` at rank.ts:406 emits
zero-weight virtual edges from minset to every isolated node. The full
SOURCERANK machinery is ported. The bug is that `auxg.subgraphs` is never
populated — no code in `buildFlatAux` or `cloneGraph` calls
`auxg.subgraphs.set(...)`.

---

## Predicted C-vs-port rank gap for the reversed back-edge

**HYPOTHESIS (T3 must confirm rank values via runtime dump):**

### Structural analysis

Edge `3:sw->2:se` is a declared back-edge. After `acyclic` the NORMAL
original has its direction preserved (declared tail = node3). In auxg for
the TB case (flip=false), tn=node3, hn=node2. `agtail(e)==tn` is true
-> clone as `auxt->auxh`.

`3:sw->2:se` has ports on both ends, so `isPortless` returns false for
every edge -> `hvye == null` after the loop -> synthetic
`agedge(auxg, auxt, auxh, NULL, 1)` with weight=10000 (dotsplines.c:1194-1197).
Port mirrors this: `new EdgeClass(auxt, auxh, '')` + push (splines-flat.ts:163).

In auxg the fast-graph edges (from class1) are: the cloned edge (auxt->auxh,
minlen from original) + the synthetic hvye (auxt->auxh, minlen=1, weight=10000).

### C prediction

`collapse_sets` finds subg with rank=source -> `collapseRankset(auxg, subg,
SOURCERANK)` -> `auxg.minset = auxt`.

`minmax_edges`: auxt is minset, ranktype=SOURCERANK -> `slen.x=1`. The
function reverses all INCOMING edges of auxt. If auxt has no incoming
(both edges are auxt->auxh), no reversals happen. Returns slen.x=1.

`minmax_edges2(slen=[1,0])`: iterates all UF-root nodes. auxh has incoming
edges (two: clone + hvye) so the `ND_in(auxh).size==0` guard is false ->
no extra edge added to auxh. auxt is minset itself -> skipped.

Result: same two edges as port. `rank1` -> network simplex -> auxt=rank 0,
auxh=rank 1. One rank gap. No virtual node. Spline would be 4 points.
**But C produces 7 points. Contradiction.**

### Resolution: minlen of the cloned back-edge

The key is `ED_minlen` of the cloned edge. For the original back-edge
`3->2` reversed by `acyclic`, the C reversal sets `ED_minlen(e)=0` on
the reversed virtual edge, but the NORMAL original retains its `minlen`.
However `cloneEdge` at dotsplines.c:884-889 does `agcopyattr(orig,e)` —
it copies string attributes. If `minlen` was set to a value > 1 on the
original edge (e.g., the user set `minlen=2` or the edge was contracted),
the clone carries it.

**More likely mechanism**: `cloneEdge` copies `minlen` from the original.
The original edge `3->2` was declared with no explicit minlen, so minlen=1.
The clone gets minlen=1. With hvye also minlen=1, auxh gets rank 1. Still
no curl.

**Conclusion**: There must be additional rank pressure from SOURCERANK
that I am not yet identifying. Two plausible mechanisms for T3 to test:

(a) The `minmax_edges2` path: if class1 excludes the cloned edge from the
fast graph (weight=0 from original -> class1 suppresses it), then auxh
has no in-edges in the fast graph at `minmax_edges2` time -> a virtual
edge auxt->auxh with minlen=slen.x=1 is added ADDITIONALLY to hvye ->
two edges of minlen=1 in parallel does NOT force rank > 1 (simplex takes
the max, so auxh=rank 1 still).

(b) The SOURCERANK minset pin forces auxt to rank 0 ABSOLUTELY (not just
via network simplex), and the hvye minlen=1 forces auxh >= 1. If the
original edge has minlen=2 (back-edges sometimes get minlen bumped), auxh
gets rank 2, inserting one virtual node -> 7 control points.

**T3 instrumentation target**: dump `ND_rank(auxt)` and `ND_rank(auxh)`
after `dot_rank(auxg)` in C, and `ED_minlen` of every edge in auxg before
ranking. This will pinpoint whether the gap is 1 or 2 and which edge
drives it.

**Predicted gap**:
- C: auxg rank(auxh) - rank(auxt) >= 2 (inferred from 7-point spline,
  which requires >= 1 virtual node, requiring rank gap >= 2)
- Port: auxg rank(auxh) - rank(auxt) = 1 (no source pin, only hvye
  minlen=1 forcing gap=1)
- Effect: C inserts virtual nodes -> spline size = 4 + 3*k where k =
  number of virtual nodes; k=1 -> size 7. Port: k=0 -> size 4.

The SOURCERANK subgraph absent from the port is confirmed as the
structural root cause. The exact mechanism by which it produces k=1
(gap=2) rather than k=0 (gap=1) is the open question for T3.
