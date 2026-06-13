# twopi / circo / fdp Layout Engine — Porting Gaps

## TWO-1: `adjustNodes` VPSC overlap removal (twopi)

**Status:** No-op stub.

**C reference:** `lib/twopigen/twopiinit.c:twopi_layout` (line 116),
calls `adjustNodes(g)`. `adjustNodes` is in
`lib/neatogen/adjust.c:999`.

**TS location:** `src/layout/twopi/init.ts:146-148`.

**Reachability:** ATTR — the twopi layout positions nodes on concentric
circles. The radius formula (`twopi_circle.c`) already spaces nodes to
avoid overlap for normally-sized graphs. Overlap only occurs when node
labels or sizes are very large relative to the graph radius. The `overlap`
attribute controls whether adjustment fires.

**Downstream visual impact:** MEDIUM — dense twopi graphs with large nodes
may have overlapping labels. For typical graphs the radial formula is
sufficient and this stub is never exercised.

**Dependencies:** Blocked on NEA-6 (VPSC / `adjustNodes` full implementation).
Once NEA-6 is done, this is a ~50 LOC wiring task.

**Estimated size:** ~50 LOC wiring (NEA-6 does the heavy lifting).

---

## CIR-1: `adjustNodes` stub (circo)

**Status:** No-op stub.

**C reference:** `lib/circogen/circularinit.c:circoLayout` (calls
`adjustNodes` after `circularLayout`). `adjustNodes` from
`lib/neatogen/adjust.c:999`.

**TS location:** `src/layout/circo/circular.ts:147`.

**Reachability:** ATTR — similar to TWO-1. Circo's circular layout
spaces nodes on block-tree arcs. Overlap only occurs with very large
nodes or extremely dense circular graphs. The `overlap` attribute
controls activation.

**Downstream visual impact:** LOW — the circular layout formula inherently
separates nodes. Dense graphs with large nodes may overlap but this is
uncommon in practice.

**Dependencies:** Blocked on NEA-6. ~50 LOC wiring once NEA-6 is done.

**Estimated size:** ~50 LOC.

---

## FDP-1: `processClusterEdges` (compound edges)

**Status:** Not ported — `src/layout/fdp/init.ts:6-8` and
`src/layout/fdp/layout.ts:283` document the gap.

**C reference:** `lib/common/utils.c:processClusterEdges` (line 930),
called from `lib/fdpgen/fdpinit.c:90`. This function converts edges
whose endpoint is a cluster (subgraph) into virtual node edges so the
force model can position them.

**TS location:**
- `src/layout/fdp/init.ts:6-8` (gap noted in file header)
- `src/layout/fdp/layout.ts:283` (guard: no node can carry
  `HAS_CLUST_EDGE` flag because `processClusterEdges` never runs)
- `src/layout/fdp/index.ts:48` (HAS_CLUST_EDGE warning path not ported)

**Reachability:** ATTR — requires an edge in the DOT file to have a
cluster (subgraph) as its head or tail. This is a Graphviz "compound"
graph feature (`compound=true` + `lhead=`/`ltail=` edge attributes).
Not triggered by ordinary fdp graphs.

**Downstream visual impact:** MEDIUM — edges to/from clusters are silently
absent from the layout in the current port. The nodes exist but any edge
declared with a cluster endpoint is not positioned by the force model.

**Algorithm:** `processClusterEdges` walks all edges; for each edge with
a cluster endpoint it creates a virtual node at the cluster's center
and reroutes the edge to that virtual node. The function is in
`lib/common/utils.c`, not `lib/fdpgen/`, making it shared infrastructure.

**Dependencies:** No external algorithmic dependencies. Requires iterating
the graph's subgraph structure (already available via `Graph.subgraphs`).
The cluster-center-node concept needs a small helper in `fdp-model.ts`.

**Estimated size:** ~200 LOC across `fdp/init.ts`, `fdp/layout.ts`, and
a new `fdp/cluster-edges.ts`.

---

## FDP-2: `PSinputscale` / inputscale attribute

**Status:** Not ported — `src/layout/fdp/init.ts:23-26` notes the gap.

**C reference:** `lib/fdpgen/fdpinit.c:52-54` (`PSinputscale > 0.0` check
scales user-supplied `pos` attr values).

**TS location:** `src/layout/fdp/init.ts:28-52` (`initialPositions`
function, scale division missing).

**Reachability:** ATTR — requires `inputscale=N` on the graph AND at
least one node with a `pos` attribute. Used when the user supplies node
positions in a unit system other than points.

**Downstream visual impact:** LOW — if `inputscale` is set, user-supplied
positions will be in the wrong scale (not divided by `PSinputscale`).
This only affects users who explicitly set both attrs.

**Dependencies:** None.

**Estimated size:** ~30 LOC. Inline fix.

---

## FDP-3: `removeOverlapAs` / prism (fdp xlayout)

**Status:** THROWS — `src/layout/fdp/xlayout.ts:309-312` throws when
`x_layout` does not converge in the allowed tries and falls through to
`removeOverlapAs`.

**C reference:** `lib/fdpgen/xlayout.c:341` calls `removeOverlapAs(g, rest)`.
`removeOverlapAs` is in `lib/neatogen/adjust.c:986`. This is the same
prism overlap removal as NEA-6 / SFDP-3.

**TS location:** `src/layout/fdp/xlayout.ts:305-312`.

**Reachability:** DEFAULT risk — fdp's default overlap handling is `9:prism`
(`DFLT_OVERLAP`). For the supported test suite, `x_layout` always converges
within 9 tries so the throw is never reached. But for a user graph where
nodes are very close together, `x_layout` may not converge and the throw
fires.

**Downstream visual impact:** MEDIUM — for any fdp graph where force
iteration doesn't separate overlapping nodes in 9 tries, the port throws
instead of applying the prism fallback. This is a hard failure (exception)
rather than a visual degradation.

**Dependencies:** Blocked on NEA-6 (same VPSC + prism infrastructure).

**Estimated size:** ~50 LOC wiring (NEA-6 does the heavy lifting).

---

## FDP-4: `doRep`/`applyAttr` coincident-node fallback

**Status:** THROWS — `src/layout/fdp/tlayout.ts:51-55` throws when two
nodes land at exactly the same coordinate (the C fallback uses `rand()%10`
which is platform-specific).

**C reference:** `lib/fdpgen/tlayout.c:doRep` (line 190) — when
`xdelta == 0 && ydelta == 0` the C code uses `rand()` to jitter.

**TS location:** `src/layout/fdp/tlayout.ts:51-55` (`coincidentNodes`).

**Reachability:** EDGE CASE — requires two fdp nodes to have exactly the
same floating-point coordinate after random initialization. With
continuous `drand48` placement this probability is essentially zero for
any real graph. The throw is a correct sentinel for an unreachable state.

**Downstream visual impact:** LOW — virtually unreachable in practice.

**Dependencies:** None. If the throw is ever hit, the fix is to substitute
a deterministic jitter (e.g. a small epsilon based on node index).

**Estimated size:** ~30 LOC. Inline fix if it ever fires.
