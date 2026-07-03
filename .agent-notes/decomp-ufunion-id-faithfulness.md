# ufUnion .id tie-break was comparing the wrong C field (F4 scope pivot)

## Task framing that turned out to be wrong
F4 was dispatched as "virtualNode id=0 faithfulness fix": the premise was
that `lib/dotgen/fastgr.c:virtual_node()` calls `agnode(g, NULL, 1)` to mint
a fresh, unique AGID for every virtual node (mirroring real nodes), and that
`src/layout/dot/fastgr.ts:348` hardcoding `new NodeClass(0, '', g)` was an
unfaithful omission of that id-minting.

**That premise is false in the current C source.** `virtual_node()`
(`lib/dotgen/fastgr.c:200-213`) does NOT call `agnode()` at all — it
`gv_alloc`s (zero-initialized calloc) a bare `node_t` directly, bypassing
cgraph's node-creation/id-registration path entirely. `AGID(n)` for every
virtual node is therefore **0**, exactly as the port already does. Read the
full function body before concluding otherwise — a truncated read (just the
signature) would miss this.

## The actual mechanism
`lib/common/utils.c:132`'s `UF_union` tie-break reads `ND_id(u) > ND_id(v)`.
`ND_id` (`lib/common/types.h:432`, `int id;` inside `Agnodeinfo_t`, guarded
by `#ifndef DOT_ONLY`) is a **distinct field from AGID** — a dotgen-only
per-node scratch id. Exhaustive grep of `~/git/graphviz/lib` and `cmd/`
confirms `ND_id` is written ONLY in `neatogen/`, `fdpgen/`, `sfdpgen/`, and
`sparse/DotIO.c` — engines other than `dot`. For the `dot` layout engine,
`ND_id` is **never assigned, for any node, real or virtual** — it stays 0
(gv_alloc/calloc-zeroed) for the entire pipeline. Consequently
`ND_id(u) > ND_id(v)` is **always false** for `dot`, and `UF_union` always
takes the `else` branch: the first argument's resolved root unconditionally
wins; there is no real id-based tie-break happening in C at all for `dot`.

The port's `ufUnion` (`src/layout/dot/decomp.ts:34`, pre-fix) compared
`u.id > v.id` where `Node.id` mirrors **AGID** (cgraph's real, unique,
non-zero per-node id — correctly used elsewhere, e.g. `outEdges`/`inEdges`
sort order matching `agfstout`/`agnxtout`). Using AGID as a stand-in for the
permanently-zero `ND_id` introduced spurious branch decisions on every call
where the two resolved roots have different AGIDs (i.e., almost always) —
a genuine faithfulness defect, unrelated to virtual-node id semantics.

## Fix
`src/layout/dot/decomp.ts` `ufUnion`: removed the `.id` comparison; the
function now unconditionally takes the "first argument's root wins" branch,
matching C's always-false comparison. Cited both C sites
(`lib/common/utils.c:UF_union`, `lib/common/types.h:432`) in the JSDoc.

`src/layout/dot/fastgr.ts` `virtualNode()` was left **unchanged** — its
`id=0` is already faithful to C's AGID=0 for virtual nodes (bypassed
`agnode`). Do not "fix" it per any future task framed like F4's original
premise without re-reading `virtual_node()`'s actual body first.

## Evidence
- 2521 (previously "tracked-deep", misdiagnosed in
  `.agent-notes/path-structure-rank-extent.md` Block 1 as an ns.c
  pivot/tie-break issue downstream of a verified-faithful UF/cluster/class1
  topology): after this fix, `a3`/`c2` and every other node/edge now matches
  the C oracle exactly except one node (`b3`) at 7pt — from a
  multi-node rank-value divergence down to a single 7pt residual.
  `node /tmp/2521.c.svg /tmp/2521.port.post.svg` via
  `test/diagnostic/flat-geom-diff.mjs`: "1 element(s) diverge; max coord
  delta = 7.00" (was previously much larger / structural, per Block 1's
  a3=4 vs oracle a3=2 finding). **Block 1's root-cause attribution (network
  simplex pivot order) is superseded — the actual origin was
  `decomp.ts:34`, not `ns.ts`.**
- 1718: height unchanged (17476pt both before and after) — confirms Block
  2's evidence that 1718 has zero `rank=same`/cluster declarations, so
  `ufUnion` is not exercised for that input at all. 1718's divergence
  remains genuinely undiagnosed (unrelated mechanism).
- `npm run test`: one pre-existing test (`newrank.test.ts` — "newrank moves
  c onto b; the plain graph leaves c on a") started throwing after the fix.
  Root-caused (not just made to pass): the `REPRO_PLAIN` input (cross-
  cluster `rank=same` without `newrank=true`) **segfaults the native C
  oracle itself** — reproducible, `GVBINDIR=/tmp/ghl
  ~/git/graphviz/build/cmd/dot/dot -Tsvg` on this exact graph exits 139
  (SIGSEGV) on every run. There is no defined C behavior for this input to
  match. The port's old (unfaithful) id-based `ufUnion` happened to avoid
  the degenerate topology that triggers the crash; the faithful version now
  reaches the same degenerate cluster/rankset state C's binary crashes on,
  and throws a `RenderError` (via a null-deref in
  `position-cluster.ts:158` `keepoutLeft`) instead of segfaulting the
  process — the correct browser-safe outcome. Test updated to assert
  `toThrow()` for that specific input instead of asserting successful
  render + geometry contrast.

## Ruled out
- **Virtual-node AGID minting**: read `virtual_node()`'s full body in the
  current checked-out C source (not assumed from the task description) —
  confirmed no `agnode()` call, confirmed AGID=0 for all virtual nodes by
  construction (calloc), confirmed this is what the port already does.
- **`.id` misuse elsewhere in `src/layout/dot/`**: grepped every `.id`
  usage in the directory (`cluster.ts` comment only, `ortho-adapter.ts`,
  `sameport.ts`, `splines-clone.ts`) — all genuinely mirror AGID-based C
  semantics (`agfstedge` sort order, node cloning) and were left untouched.
  Only `decomp.ts:34`'s `ufUnion` misused AGID as a stand-in for the
  dormant `ND_id`.
- **`position-cluster.ts:158`'s null-deref as a port-side bug to fix
  defensively**: ruled out as the wrong fix target — the crash is a
  faithful reproduction of a state the C reference itself cannot handle
  (segfault = undefined behavior, not a spec to port). Fixing the test's
  expectation (throw, not silently succeed) is the correct response, not
  adding a defensive branch that would silently diverge from C's
  (crashing) behavior on this input.

## Confidence
High — mechanism confirmed by direct C source reads (not assumption),
cross-checked against exhaustive `ND_id`/`AGID` write-site greps across the
full `~/git/graphviz/lib` and `cmd/` trees, and validated by a large,
measured fidelity improvement on 2521 plus a reproducible native-binary
crash isolating the newrank.test.ts regression to a C-side defect, not a
port-side one.
