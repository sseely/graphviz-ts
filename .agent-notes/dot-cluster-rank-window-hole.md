# dot cluster rank-window hole (abomination +1 renumber)

## Observation: abomination's 0-based renumber must carry cluster rank state
- **Context**: Diagnosing a crash from plantuml-ts fixture `xusuxe-62-guba767` —
  `TypeError: Cannot read properties of undefined (reading 'info')` thrown from
  `nodeRw` via `containNodesRank` (`position-cluster.ts:94`). Native `dot` lays
  the same input out fine (`bb="0,0,745.32,253.8"`), so it was a port defect.
  Trigger is a conjunction: labeled edge + `minlen=0` (endpoints share a rank →
  the edge is FLAT and its label non-adjacent) + the edge crosses a cluster
  boundary + the cluster holds a second, edge-less member.
- **Finding**: `lib/dotgen/flat.c:abomination` makes room for the flat-label
  vnode by adding a rank at index **-1** (`GD_rank(g) = rptr + 1;
  GD_minrank(g)--`) and never touches any `ND_rank`. Every cluster's
  ABSOLUTE-rank-indexed state (`GD_minrank`/`GD_maxrank`, `GD_rank(clust)[]`,
  `GD_rankleader(clust)[]`) therefore stays valid in C for free.
  JS has no negative index, so the port renumbers **+1** instead (AD-2,
  `flat.ts:abomination`) — but it only shifted the ROOT's rank array, node
  `ND_rank`s and `maxrank`, leaving every cluster's rank state one rank too low.
  The very next step of `flat_edges` is `rec_reset_vlists`
  (`mincross.c:reset_vlist`), which re-aliases
  `GD_rank(clust)[r].v = GD_rank(root)[r].v` at the cluster's now-stale `r` — so
  the cluster's window got re-pointed at the newly inserted flat-label rank
  (a 1-element array) while still claiming `n = 2`. `contain_nodes` then read
  `v[n-1]` and found a hole.
  C guards `v[0]` but NOT `v[n-1]`, and the port mirrors that faithfully — so a
  null-guard at the crash site would have been wrong; the C is telling us the
  window is never supposed to have a hole.
  Instrumented both sides at `contain_nodes`:
  - C:    `ROOT minrank=-1 maxrank=0`; `r=-1 n=1 [%0]`;
          `r=0 n=3 [smeagol, nexus, developer]`;
          `CLUST cluster0 minrank=0 maxrank=0`; `CL r=0 n=2 [smeagol, nexus]` OK
  - port: `ROOT minrank=0 maxrank=1`; `r=0 n=1 [virt]`;
          `r=1 n=3 [smeagol, nexus, developer]`;
          `CLUST cluster0 minrank=0 maxrank=0`; `CL r=0 n=2 [virt, <<UNDEF>>]` BAD
- **Impact**: Any TS deviation that RENUMBERS ranks must shift *every*
  absolute-rank-indexed structure, not just the root's: cluster `minrank`,
  `maxrank`, `rank[]` and `rankleader[]`, recursively through sub-clusters. This
  is a general hazard class wherever the port replaces a C negative-index /
  pointer-offset trick with 0-based renumbering — the C's freedom from
  bookkeeping is an artifact of the pointer arithmetic, not of the algorithm.
  Note the whole upstream corpus (260 graphs in `~/git/graphviz/tests/graphs`)
  contains **zero** graphs that reach abomination with clusters present — which
  is why this survived every sweep. Corpus silence is not coverage.
- **Confidence**: High — mechanism confirmed by instrumenting BOTH sides at
  `contain_nodes`; fix verified against the native oracle (graph + cluster bb
  match exactly); full dot corpus (260 ids) shows 0 verdict changes.

## Observation: instrumenting C without disturbing the shared oracle
- **Context**: Needed C-side rank dumps, but `~/git/graphviz/build/cmd/dot/dot`
  is the shared oracle other agents spawn, and the C tree carries pre-existing
  uncommitted harness mods (`lib/fdpgen/layout.c`, `lib/neatogen/neatosplines.c`).
- **Finding**: Configure a SECOND build dir against the same source
  (`cmake -S ~/git/graphviz -B /tmp/gvinst -DCMAKE_BUILD_TYPE=Release
  -DBISON_EXECUTABLE=/opt/homebrew/opt/bison/bin/bison
  -DFLEX_EXECUTABLE=/opt/homebrew/opt/flex/bin/flex`), then revert the source
  edit as soon as the build finishes. `build/cmd/dot/dot` is never rewritten
  (sha1 stayed `5caf7a368dae`). The default `/usr/bin/bison` (2.3) is too old —
  configure fails without the homebrew bison/flex paths, which are recorded in
  the existing `build/CMakeCache.txt`.
  The dot LAYOUT is a runtime plugin: instrumenting `lib/dotgen` and rebuilding
  only the `dot` target changes nothing observable, because `GVBINDIR=/tmp/ghl`
  loads the ORIGINAL `libgvplugin_dot_layout`. Build the plugin targets too and
  point `GVBINDIR` at a dir holding the instrumented plugins + a fresh `dot -c`
  config.
- **Impact**: Repeatable recipe for C-side instrumentation that is safe to run
  while other agents use the oracle concurrently.
- **Confidence**: High — used it to produce the C dumps above.
