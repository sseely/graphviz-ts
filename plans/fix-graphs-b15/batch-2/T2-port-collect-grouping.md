<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — port the collect + group dispatch (graphs-b15)

## Context
T1 pinned the exact collect change and proved the 6 secondary edges coalesce into
their `getMainEdge` group (route-once). Read
`.agent-notes/graphs-b15-collect-design.md` first (fields `collectChange`,
`coalesces`, `getMainEdgeFix`, `cReference`, `routeOnceProof`). C's `dot_splines_`
collects from the rank array incl. virtual `splineMerge` nodes
(`dotsplines.c:281-299`); the port skips them (`splines.ts:521`). The fix routes
the new edges through the EXISTING `edgecmp`+`getMainEdge`+`routeEdgeGroup`
dispatch — **no side router, no boolean guard** (AD-3; both failed before).

## Task
1. Implement `collectChange` from T1: change the collect in `dotSplines_` to
   iterate the node set C iterates (rank array / `g.info.nlist`), skipping
   `ND_node_type(n) !== NORMAL && !splineMerge(n)` — i.e. include virtual nodes
   with `in.size>1 || out.size>1`. Preserve C's `ND_out`/`ND_flat_out`/`ND_other`
   append order + flags (mirror `dotsplines.c:281-320`).
2. If T1's `coalesces == false`, apply the named `getMainEdge`/`to_virt` fix so
   each secondary shares its main's group.
3. Add/extend `src/layout/dot/splines.test.ts`: assert that under a concentrate
   DOWN-sweep fixture, the virtual `splineMerge` node's secondary out-edges are
   collected AND that each original edge routes exactly once (e.g. group
   membership via `getMainEdge`, or `ED_spl` set once per orig). Assert specific
   values, not "no throw".
4. Verify b15 (recipe below): **153 edge blocks, all 6 named edges, AND**
   `compareSvg` maxDelta ~0 (no doubled beziers).

## Write-set
- `src/layout/dot/splines.ts` (+ `src/layout/dot/splines.test.ts`)
- `src/layout/dot/conc.ts` and/or `src/layout/dot/classify.ts` — ONLY if T1's
  `getMainEdgeFix` implicates them. Anything else → STOP.

## Read-set
- `.agent-notes/graphs-b15-collect-design.md` (T1 — read first)
- `src/layout/dot/splines.ts:100-115,210-230,320-360,515-535`
- `src/layout/dot/conc.ts` (`mergeVirtual`/`infuse`, `to_virt` wiring)
- `~/git/graphviz/lib/dotgen/dotsplines.c:281-383`, `:99-112`
- `decisions.md#ad-2`, `#ad-3`, `#ad-4`

## Verify recipe
```
TSX=$(ls ~/.npm/_npx/*/node_modules/.bin/tsx | head -1)
IN=~/git/graphviz/tests/graphs/b15.gv
GVBINDIR=/tmp/ghl "$TSX" test/corpus/render-one.ts "$IN" dot > /tmp/p_b15.svg
grep -c 'class="edge"' /tmp/p_b15.svg          # expect 153
for e in FallFaceBack:Normal HoverFaceBack:Normal HoverForwardToStop:Normal \
         HoverStrafeToStop:Target MidJumpFaceBack:Normal LandVertical:Target; do
  grep -q "$e" /tmp/p_b15.svg && echo "OK $e" || echo "MISSING $e"; done
# maxDelta guard: compareSvg vs oracle must be ~0 (NOT just count)
```

## Interface contract
No public type/signature change expected — routing is internal to the dot pass.

## Acceptance criteria
- Given the fix, when b15 is rendered, then 153 edge blocks + all 6 named edges,
  AND `compareSvg(port, oracle)` maxDelta does not rise vs HEAD (~0).
- Given a non-concentrate graph, then its edge set is unchanged (collect change
  gated by `splineMerge`).
- Given the unit test, then it asserts the virtual `splineMerge` node's secondary
  edges are collected and each orig routes once; it fails against pre-fix source.
- Given `npx tsc --noEmit`, then exit 0.
- Given `npx vitest run src/layout/dot/splines src/layout/dot/conc src/layout/dot/classify`,
  then all pass.

## Observability
N/A.

## Rollback
Reversible — revert the commit.

## Quality bar
Minimal faithful collect change routed through the existing dispatch. Return only
the diff summary + the b15 count/6-edge/maxDelta result. No preamble.

## Boundaries
- **Always:** mirror `dotsplines.c` collect + group loop; keep the change gated by
  `splineMerge`; verify maxDelta, not just count.
- **STOP:** if doubling reappears and can't be fixed at the grouping level in 3
  tries on the same site; if a file outside the write-set is needed.
- **Never:** add a bespoke secondary-chain router, a boolean dispatch guard, or a
  non-C dedup key.

## Commit
`fix(T2): collect virtual splineMerge nodes into the edgecmp group dispatch (graphs-b15)`
— body notes the C `dotsplines.c:281-383` reference, route-once via getMainEdge,
and the maxDelta guard.
