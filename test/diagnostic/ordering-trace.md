# Ordering Mincross Trace — T0 Diagnostic

## Reproducer

Graph: `~/git/graphviz/tests/graphs/b58.gv` (`ordering=out` at graph level).
Node 7 has out-edges `7->5` (declared first) then `7->4` (declared second).
C places 5 left of 4; port places 4 left of 5.

## Commands

```sh
# C oracle (render)
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/graphs/b58.gv

# Port (render)
GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/b58.gv dot

# C oracle with debug (instrumented):
ORDDBG=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/graphs/b58.gv

# Port with debug (instrumented):
ORDDBG=1 GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/b58.gv dot
```

Instrumentation was env-gated (`ORDDBG`) and reverted after capture.
Both trees are clean after capture.

## C Trace for b58 (ground truth)

### Node-7 sortlist (before + after sort, FLATORDER created)

```
ORDDBG do_ordering_node node=7 outflag=1 ne=2
ORDDBG   sortlist[0] seq=4 7->4        ← ND_out(7).list has 4 first, then 5
ORDDBG   sortlist[1] seq=3 7->5
ORDDBG   after sort:
ORDDBG   sorted[0] seq=3 7->5          ← AGSEQ("7->5")=3 < AGSEQ("7->4")=4
ORDDBG   sorted[1] seq=4 7->4
ORDDBG   FLATORDER 5->4                ← head(sorted[0])=5, head(sorted[1])=4
```

Key: `new_virtual_edge` in C does `AGSEQ(e) = AGSEQ(orig)`, so the virtual
edge for `7->4` inherits AGSEQ=4 and the virtual edge for `7->5` inherits
AGSEQ=3 from the original DOT edges. `qsort` by AGSEQ reverses the ND_out
list order and produces the correct FLATORDER.

### Node-6 and node-3 (also graph-level ordering=out, for completeness)

```
ORDDBG   FLATORDER 1->4
ORDDBG   FLATORDER 6->8
```

### Per-pass rank order for rank 2 (nodes 1, 2, 4, 5)

```
[after_build_ranks_pass0] rank2: 5(ord=0) 4(ord=1) 1(ord=2) 2(ord=3)
[after_flat_reorder_pass0] rank2: 5(ord=0) 1(ord=1) 4(ord=2) 2(ord=3)
[after_build_ranks_pass1] rank2: 1(ord=0) 4(ord=1) 5(ord=2) 2(ord=3)
[after_flat_reorder_pass1] rank2: 1(ord=0) 2(ord=1) 5(ord=2) 4(ord=3)
```

Final C order: 1 < 2 < 5 < 4.  Node 5 (cx=171) is left of node 4 (cx=243). ✓

## Port Trace for b58 (showing divergence)

### Node-7 sortlist (FIRST DIVERGENCE)

```
PORTDBG doOrderingNode node=7 outflag=true ne=2
PORTDBG   sortlist[0] seq=13 7->4      ← n.info.out has 4 first (seq=13)
PORTDBG   sortlist[1] seq=14 7->5      ← then 5 (seq=14)
PORTDBG   after sort:
PORTDBG   sorted[0] seq=13 7->4        ← seq=13 < seq=14 so 4 stays first
PORTDBG   sorted[1] seq=14 7->5
(no FLATORDER line)                    ← findFlatEdge(4,5) hit existing "4->5" flat edge
                                          → returned early, NO FLATORDER created
```

Virtual edges get `Edge._nextSeq++` (fresh counter), not the original edge's
seq.  The virtual edge for `7->4` was created before the virtual edge for
`7->5` (class2 iteration order), so it has a lower seq (13 < 14).  Sorting by
virtual edge seq produces `[7->4, 7->5]` — the same ND_out list order,
unreversed. Then `doOrderingAddFlatEdges` tries to create FLATORDER
`4→5`, but `findFlatEdge(4,5)` finds the existing flat edge from the DOT
statement `"4"->"5"` (same-rank), and returns early without creating any
FLATORDER for node 7.

### Per-pass rank order for rank 2 (port)

```
[after_build_ranks_pass0] rank2: 5(ord=0) 4(ord=1) 1(ord=2) 2(ord=3)
[after_flat_reorder_pass0] rank2: 1(ord=0) 4(ord=1) 5(ord=2) 2(ord=3)
```

Port flat_reorder pass 0 produces `4 before 5` (wrong).  The FLATORDER
constraint that would have prevented this swap is absent.

## Pinned First Divergence

| Dimension | C | Port |
|-----------|---|------|
| File:line | `lib/dotgen/mincross.c:453` (`qsort` by AGSEQ) | `src/layout/dot/mincross-build.ts:331` (`.sort((a,b)=>a.seq-b.seq)`) |
| Sort key used | `AGSEQ(virtual_edge)` = `AGSEQ(orig)` = original DOT edge seq | `virtual_edge.seq` = fresh `Edge._nextSeq++` (creation order of virtual edge) |
| C concrete value | sorted[0]=seq3(7->5), sorted[1]=seq4(7->4) | sorted[0]=seq13(7->4), sorted[1]=seq14(7->5) |
| Port concrete value | (same as C intent) | REVERSED relative order |
| FLATORDER result | `5→4` created (correct) | `findFlatEdge(4,5)` early-exit, NO FLATORDER (wrong) |
| Classification | — | **Suspect A: construction error in `mincross-build.ts`** |

## Root Cause

`new_virtual_edge` in C assigns `AGSEQ(virtual) = AGSEQ(orig)` (fastgr.c:143).
The port's `newVirtualEdge` assigns `this.seq = Edge._nextSeq++` and does NOT
copy `orig.seq`. When class2 iterates edges to build the fast graph, the
virtual edges for a given node's out-edges are not necessarily created in the
same order as the original DOT edges were declared.  For node 7 in b58.gv,
`7->4` is created before `7->5` (class2 iteration order), giving it seq=13
while `7->5` gets seq=14.  Sorting by these fresh virtual-edge seqs produces
the same order as the ND_out list (unreversed), whereas C's sort on inherited
AGSEQ produces the DOT-declaration order (reversed for node 7 since `7->5` was
declared first with AGSEQ=3).

## Batch 1 Fix Target

**File:** `src/layout/dot/mincross-build.ts`, line 331.

**Current:**
```ts
sortlist.sort((a, b) => a.seq - b.seq);
```

**Required:**
```ts
// Sort by original DOT edge seq (matching C: AGSEQ(virtual) = AGSEQ(orig)).
// Virtual edges in n.info.out all have to_orig pointing to the real DOT edge
// (set by copyVirtualEdgeInfo in virtualEdge/makeChain).
sortlist.sort((a, b) =>
  (a.info.to_orig?.seq ?? a.seq) - (b.info.to_orig?.seq ?? b.seq));
```

All virtual edges in `n.info.out` have `info.to_orig` set by
`copyVirtualEdgeInfo` (called from `virtualEdge` → `makeChain` in classify.ts).
The `?? a.seq` fallback handles any edge without a to_orig (defensive only;
this path is not taken in practice for ordering).

## ordering_dot1 Confirmation

`linux.x86/ordering_dot1.gv`, `macosx/ordering_dot1.gv`, and
`nshare/ordering_dot1.gv` all carry `ordering=out` at the graph level and are
marked `diverged` (maxDelta=144) in parity.json.  They share the same
signature: graph-level `ordering=out` forces FLATORDER constraint construction
through `doOrdering` → `doOrderingNode`, and the same wrong-seq sort will
produce wrong FLATORDER constraints (or suppress them via early-exit on an
existing flat edge, as observed in b58).  Full re-instrumentation on
ordering_dot1 was not performed since b58 is conclusive.

## Tree-Cleanliness Confirmation

```sh
git -C ~/git/graphviz status --short lib/dotgen/mincross.c  # no output (clean)
git -C /Users/scottseely/git/graphviz-ts status src/ --short
# shows only: ?? src/.agent-notes/  ?? src/.gitignore  ?? src/.mcp.json  ?? src/.serena/
# No modified source files.
npx tsc --noEmit  # exits 0
```
