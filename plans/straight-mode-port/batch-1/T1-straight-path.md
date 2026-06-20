<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Port `straightPath`; pin `straightLen`

## Context
graphviz-ts is a faithful TS port of C graphviz; the C source at
`~/git/graphviz` is the spec. This task ports one small helper used by the
straight-mode chain router (T2b).

## Task
In `src/layout/dot/splines-route.ts`:
1. Port `straightPath` from `~/git/graphviz/lib/dotgen/dotsplines.c:2042`:
   ```c
   static edge_t *straight_path(edge_t *e, int cnt, points_t *plist) {
     edge_t *f = e;
     while (cnt--) f = ND_out(aghead(f)).list[0];
     // append two copies of the last point
     LIST_APPEND(plist, LIST_GET(plist, LIST_SIZE(plist)-1));
     LIST_APPEND(plist, LIST_GET(plist, LIST_SIZE(plist)-1));
     return f;
   }
   ```
   TS signature: `straightPath(e: Edge, cnt: number, pts: Point[]): Edge`.
   Mutates `pts` (push 2 copies of `pts[pts.length-1]`), returns the edge
   reached after walking `cnt` head-out hops. JSDoc `@see` the C origin.
2. `straightLen` is already in this file (line ~99) — do NOT rewrite it; add a
   regression test pinning it.

## Write-set
- `src/layout/dot/splines-route.ts` (add `straightPath`; export it)
- `src/layout/dot/splines-route.test.ts` (or the existing test file for this
  module — check first; add to it rather than creating a duplicate)

## Read-set
- `~/git/graphviz/lib/dotgen/dotsplines.c:2024-2055` (straight_len + straight_path)
- `src/layout/dot/splines-route.ts:81-110` (existing straightLen)
- `src/layout/dot/edge-route-chain.ts:64-74` (chainSegments — how the port walks
  `ND_out(...).list[0]` via `info.out.list[0]`)

## Interface contract (consumed by T2b)
`straightPath(e: Edge, cnt: number, pts: Point[]): Edge`
- `pts` length increases by exactly 2 (both equal the prior last point).
- returns the edge `cnt` head-out hops downstream of `e`.

## Acceptance criteria
- Given `pts = [...]` with last point `P` and `cnt >= 0`, when `straightPath`
  runs, then the last two entries of `pts` equal `P` and length grew by 2.
- Given a chain `a→v1→v2→v3→...` and `cnt=2`, when `straightPath(a→v1, 2, pts)`,
  then it returns the edge whose tail is `v2` (2 hops along `info.out.list[0]`).
- Given a collinear vnode run, when `straightLen(n)` runs, then it returns the
  run length (single in/out, identical `coord.x`) — pin the existing behavior.

## Observability
N/A — no new observable operations.

## Rollback
Reversible.

## Quality bar
`npx vitest run` green; `npx tsc --noEmit` clean. One commit:
`feat(splines): port straight_path helper for chain straight-mode`.
