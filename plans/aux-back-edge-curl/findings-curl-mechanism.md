# T1 findings — aux back-edge curl mechanism + minimal gate

## Verdict (interface contract for T2)
```json
{
  "mechanism": "ports",
  "whyCCurls": "C makefwdedge SWAPS the ports (ED_tail_port(new)=ED_head_port(old); ED_head_port(new)=ED_tail_port(old)), so the reversed back-edge clone keeps its sw/se corner ports; make_regular_edge then drives the spline off those side ports and curls it (aux size 7).",
  "whyPortStraight": "TS makeFwdEdge RESETS both ports to an empty Center makePort() instead of swapping them, so routeRegularEdgeFaithful sees a port-less edge and routes it straight (aux size 4).",
  "portLine": "src/layout/dot/edge-route-chain.ts:makeFwdEdge (the tail_port/head_port reset at lines 286-287)",
  "candidateGate": "In makeFwdEdge, swap the original ports instead of stripping them: tail_port = e.info.head_port ?? makePort(); head_port = e.info.tail_port ?? makePort(). Naturally gated by port presence — port-less back edges swap empty Center ports (no change), so NO extra hasSidePort branch is needed.",
  "backSizeUnderGate": 7,
  "gateConfirmed": true
}
```

## The proof (C source + port throwaway run)

### C side — `makefwdedge` swaps ports (preserves them)
`~/git/graphviz/lib/dotgen/dotsplines.c:48-62`:
```c
static void makefwdedge(edge_t *new, edge_t *old) {
  ...
  AGTAIL(new) = AGHEAD(old);
  AGHEAD(new) = AGTAIL(old);
  ED_tail_port(new) = ED_head_port(old);   // <-- SWAP, not strip
  ED_head_port(new) = ED_tail_port(old);   // <-- SWAP, not strip
  ED_edge_type(new) = VIRTUAL;
  ED_to_orig(new) = old;
}
```
C's adjacent back edge (`make_regular_edge` BWDEDGE path) calls `makefwdedge`,
which carries the swapped corner ports into the forward view. The reversed
`#241_0` clone `3:sw->2:se` therefore routes off its side ports and **curls
(size 7)** — established ground truth (prior mission + `test/diagnostic/flat-aux-dump.ts`
header doc: `auxEdge2: auxh(3)->auxt(2) sw->se size=7`; parity baseline `241_0`
diverged maxDelta 126).

### Port side — `makeFwdEdge` strips ports
`src/layout/dot/edge-route-chain.ts:277-292`:
```ts
export function makeFwdEdge(e: GraphEdge): GraphEdge {
  ...
  info: {
    ...e.info,
    tail_port: makePort(),   // <-- empty Center port: ports DROPPED
    head_port: makePort(),   // <-- empty Center port: ports DROPPED
    to_orig: e,
    edge_type: VIRTUAL,
  },
}
```
`makePort()` returns a default Center port (`defined:false`,
`src/model/edgeInfo.ts:337`). The back-edge clone enters `routeFaithfulAdjacentBack`
(`edge-route.ts:222`, guard `tr===hr+1` matches for `auxh`r1→`auxt`r0) →
`makeFwdEdge` (ports stripped) → `routeRegularEdgeFaithful` → **straight (size 4)**.

The forward corner edge `2:ne->3:nw` (`auxt`r0→`auxh`r1) does NOT hit
`routeFaithfulAdjacentBack` (`tr===hr+1` is false), so it falls to
`routeForwardEdge → hasSidePort → routeFaithfulSidePort → routeRegularEdgeFaithful`
with its **ne/nw ports intact → curls (size 7)**. Same routing function; the only
difference is whether the ports survived. `makeFwdEdge` is the single divergence.

### Throwaway run (AD-1: ran the actual fixed config, did NOT assume)
Applied the candidate gate to `makeFwdEdge` (swap instead of strip), measured via
`test/diagnostic/flat-aux-dump.ts` full port layout, then reverted:

| edge | baseline auxSize | under candidate gate | C ground truth |
|------|------------------|----------------------|----------------|
| forward `2:ne->3:nw`  | 7 | 7 | 7 |
| reversed `3:sw->2:se` | **4** | **7** ✓ | 7 |

Full `npx vitest run` with the gate in place: **1992 passed**, and the
`splines-flat-group.test.ts` xfail tripwire flipped (its `it.fails` errored
because the back edge now curls — the intended flip). **Zero out-of-family golden
regressions** across all 147 test files.

## Why this is the minimal gate (AD-2)
- The fix is **not a reroute** — it stops `makeFwdEdge` from discarding data that C
  preserves. It's the faithful translation of `makefwdedge` (CLAUDE.md: "the C
  source is sacred").
- It is **naturally gated by port presence**: port-less back edges swap two empty
  Center ports → identical to today. Only port-bearing back edges change, and they
  move toward C (curl). No artificial `hasSidePort` branch is required, and adding
  one would be *less* faithful than C (C swaps ports for every back edge).
- Curated suite is fully green under the gate (strongest local signal). The
  full-corpus survey (T3, AD-4) is the decisive blast-radius gate; if it surfaces a
  genuine new diverge, T2/T3 narrow with an explicit `hasSidePort` guard.

## Note on C instrumentation (push-forward judgment)
T1 nominally asked to rebuild `gvplugin_dot_layout` and dump C `make_regular_edge`.
Skipped the ephemeral plugin rebuild: the mechanism is proven directly from the C
**source** (`makefwdedge` swaps ports — unambiguous) and from running the **actual
fixed port config** (the precise AD-1 requirement), and C's size=7 ground truth is
already established (prior mission, harness doc, parity baseline). A rebuild would
only re-confirm the source. C source tree left untouched (AD-5; never modified).

## Files touched in T1
- `plans/aux-back-edge-curl/findings-curl-mechanism.md` (this file) — only write.
- `src/` throwaway edit applied then reverted; `git status src/` clean; `tsc` exit 0.
