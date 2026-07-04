<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: pathplan ear-clip triangulation overflowed V8's stack on large polygons

- **Context**: the edge-weight fix (honoring `weight=0`) made corpus 2095_1
  float several nodes to the top rank, spawning graph-spanning long edges. Those
  edges produce very large routing polygons. Rendering then threw
  `Maximum call stack size exceeded`.
- **Finding**: two independent copies of C's tail-recursive ear-clip were ported
  as actual recursion:
  - `src/pathplan/shortest.ts:triInner` — used by `shortestPath` (this is the
    one 2095_1 hit; trace = `ShortestHelper.triInner` self-calls at shortest.ts:29).
  - `src/pathplan/triang.ts:triangulateInner` — used by the public exported
    `triangulate` (C `Ptriangulate`). Same latent bug, not yet triggered by the
    corpus but reachable via the public API.
  C's `triangulate`/`Ptriangulate` are `return triangulate(points, n-1)`
  tail-recursive; recursion depth == polygon vertex count. C survives on its
  ~8 MB main-thread stack; V8 has no TCO and overflows much sooner.
- **Empirical threshold**: a faithful reconstruction of the old recursive form
  (heavy frame: closure `k=>pts[k]` + `isdiagonal` + `filter`) survives N=5000
  but **overflows at N=8000** on this machine. The iterative form triangulates
  N=8000 in ~800ms → exactly N-2 triangles.
- **Fix**: convert both to the faithful loop form (AD-3 recursion->iteration
  pattern, same as acyclic.ts / ns rerank). Same ear clipped per pass, same
  store/emit order, same return value — a literal TCO of the tail recursion.
  Regression test added: `triangulate / large polygon is stack-safe` (N=8000)
  in pathplan.test.ts. It also guards against a future recursive rewrite (which
  would re-overflow at 8000).
- **Residual**: 2095_1 now RENDERS instead of crashing, but the faithful
  weight-honoring layout is genuinely heavier — ~172s layout (vs native ~22s,
  ~7.8x; was 68s/3.07x pre-weight-fix). Within the 180s perf cap but borderline.
  The slowness is the port's O(n^2) `connectAll`/`triInner` on the large routing
  polygon, NOT the recursion fix. Perf-only follow-up, not a correctness issue.
- **markPath NOT converted**: `shortest.ts:markPath` (C `marktripath`) is also
  recursive (backtracking DFS) and *could* overflow on a long triangle path, but
  2095_1 did NOT trip it after triInner was fixed — left untouched (minimal
  change). If a future graph overflows markPath, convert it to an explicit-stack
  DFS preserving the mark/unmark-on-backtrack semantics.
- **Confidence**: High — overflow reproduced + fixed + oracle-rendered;
  threshold measured directly.
