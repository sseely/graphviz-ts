# Mission: ortho routing — Phase 1 foundation (graph-search + trapezoidation)

## Objective

Port the **bottom layer** of Graphviz's orthogonal edge router (`lib/ortho`)
to TypeScript: the priority queue, raw adjacency graph, search graph + shortest
path, and Seidel trapezoidal decomposition. This is **Phase 1 of a multi-mission
subsystem** (`splines=ortho`). P1 is pure, deterministic library code with **no
wiring into the layout pipeline** — it cannot change any rendered output. Later
missions add `partition`/`maze` (P2) and `orthoEdges` + spline emission + dispatch
(P3), after which `splines=ortho` renders correctly.

## Carried-in facts (do NOT re-derive)

- **pathplan is already ported** and the default/cluster/self/parallel routing
  matches C byte-for-byte (see `../layout-engine-backlog/route-reverification.md`).
  The ONLY unported edge-routing feature is `splines=ortho|curved|compound`
  (DOT-8). This mission is the `ortho` foundation.
- `EDGETYPE_ORTHO=4` is already parsed (`splines.ts:55,67`); it's just never
  dispatched. P3 (not this mission) wires it.
- Modern C `construct_trapezoids(nseg, seg, permute)` takes the permutation as a
  **parameter** and threads `traps_t`/`qnodes_t` context explicitly — **no module
  globals, no internal `rand()`**. P1 is therefore **deterministic given inputs**
  (ADR-3). Randomization lives in `partition.c` (P2).
- Validate against **native instrumented C** `lib/ortho`, never approximation
  (ADR-5). Reuse the `/tmp/gvmine` build recipe; revert C after.

## Branch

`feature/ortho-p1-foundation` (new). Merge to `main` when P1 green; P2/P3 are
separate branches/missions.

## Constraints (faithful port; cardinal = parity + zero churn)

- **Faithful-only port.** Mirror `lib/ortho` exactly: index-based arrays, C
  function boundaries, side-effect order (ADR-1). Do not optimize or simplify.
- **Additive + unwired.** P1 only creates files under `src/ortho/`. It edits NO
  layout file. Any change to an existing test/golden is a STOP (ADR-4).
- **C source is sacred.** Revert all C instrumentation;
  `git -C ~/git/graphviz status --porcelain lib/` clean before any commit.
- **Determinism.** Trapezoid output must be identical run-to-run under a fixed
  `permute`; if not, STOP (hidden nondeterminism).

## Quality gates

```
- command: npm run typecheck                          # pass: exit 0
- command: npm test                                   # pass: exit 0, >=1876 (baseline) + new ortho tests
- command: npm run build                              # pass: esbuild bundles
- command: git -C ~/git/graphviz status --porcelain lib/   # pass: empty (C reverted)
- command: git diff --name-only HEAD~1                # pass: only src/ortho/** + plans/** touched
```

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [1](batch-1/overview.md) | Port rawgraph, trapezoid, sgraph+fPQ (parallel; C-oracle TDD) | [ ] |

## Index

- [decisions.md](decisions.md) — ADR-1..ADR-5
- [batch-1/overview.md](batch-1/overview.md) — task table + dependency summary
- [batch-1/T1-rawgraph.md](batch-1/T1-rawgraph.md)
- [batch-1/T2-trapezoid.md](batch-1/T2-trapezoid.md)
- [batch-1/T3-sgraph-fpq.md](batch-1/T3-sgraph-fpq.md)
- [diagrams/component-map.md](diagrams/component-map.md) — ortho subsystem + P1 slice
- [diagrams/data-flow.md](diagrams/data-flow.md) — the eventual ortho pipeline + P1's place
- [decision-journal.md](decision-journal.md) — appended during execution
- **C spec:** `~/git/graphviz/lib/ortho/{fPQ,rawgraph,sgraph,trapezoid}.c` + headers
- **Oracle recipe:** `../layout-engine-backlog/route-reverification.md`,
  memory `[[oracle-native-not-wasm]]`, `/tmp/gvmine` (`GVBINDIR=/tmp/gvmine dot`)
