# Mission: ortho P2 — oracle-pin the render pipeline (partition → maze → route)

## Objective

Validate the **ortho render pipeline** (`partition.ts` → `maze.ts` →
`ortho-route.ts`) conformant against **native instrumented C**, standalone
and unwired. This de-risks the P3 dot-dispatch mission: once the pipeline is
oracle-pinned, wiring `splines=ortho` into the dot engine becomes low-risk
wiring whose goldens should pass without deep pipeline debugging. The bottom
layer (`rawgraph`/`trapezoid`/`sgraph`/`fPQ`) is already pinned (ortho-P1, done);
this mission pins the three unvalidated layers above it. **No `splines=ortho`
golden exists for any engine today**, so this pipeline is currently unproven
end-to-end.

## Carried-in facts (do NOT re-derive)

- `mkMaze(g)` (maze.c:452) calls `partition(gcells, ngcells, BB)` (maze.c:488)
  then `mkMazeGraph` (maze.c:500). So the pipeline order is
  **partition → maze(cells+sg) → ortho-route(channels/segs/tracks/route-points)**.
  Validate bottom-up: a maze divergence may be a partition bug; fix the lowest
  stage first (ADR-3).
- `orthoEdges` needs a real `graph_t`, so the P1 tiny object-harness is
  insufficient here. Oracle = **instrumented native dot via gvmine**
  (`[[recover-slack-and-c-harness]]`): instrument `partition.c`/`maze.c`/
  `ortho.c` to dump stage state **and node positions** for `splines=ortho`
  fixtures, run `GVBINDIR=/tmp/gvmine dot -Tsvg fixture.dot`, capture, **revert C**.
- Drive TS from the **C-dumped node positions** (build an `OrthoGraph`/maze input
  with identical coords) so comparison isolates pipeline logic from layout (ADR-2).
- This mission is **additive + unwired** (library tests only); it cannot change
  rendered output. Any existing test/golden change ⇒ **STOP** (ADR-4).
- Existing entry points: `partition(cells, bb)`, `mkMaze(g)`,
  `assignSegs`/`assignTracks`/`convertSPtoRoute` (`ortho-route.ts`).

## Branch

`feature/ortho-p2-render-pipeline` (new, off `main`). Runs **before**
`feature/ortho-p3-dot-splines` (P3 depends on this mission's outcome).

## Constraints

- **Faithful port.** Fixes preserve C function boundaries + side-effect order
  (ADR-5). Do not optimize maze/partition/Seidel.
- **Additive + unwired.** Edits only `src/ortho/*` + tests + `plans/**`. No
  layout/splines/dispatch file. Any existing-test/golden change ⇒ STOP (ADR-4).
- **C source is sacred.** Revert all instrumentation;
  `git -C ~/git/graphviz status --porcelain lib/` shows no tracked `.c/.h` change
  before any commit.
- **Determinism.** Pipeline output must be identical run-to-run for a fixture;
  variance ⇒ STOP (hidden nondeterminism — note partition.c has a `SEED`/permute).

## Quality gates

```
- command: npm run typecheck                  # pass: exit 0
- command: npm test                           # pass: exit 0 (baseline + new pipeline tests)
- command: npm run build                      # pass: esbuild bundles
- command: git -C ~/git/graphviz status --porcelain lib/   # pass: no tracked .c/.h modification
- command: git diff --name-only HEAD~1        # pass: only src/ortho/** + plans/** touched
```

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [1](batch-1/overview.md) | T1 — oracle-pin `partition.ts` (trapezoid→rect cells) | [x] |
| [2](batch-2/overview.md) | T2 — oracle-pin `maze.ts` (mkMaze: gcells, cells, search graph) | [x] |
| [3](batch-3/overview.md) | T3 — oracle-pin `ortho-route.ts` (channels, segs, tracks, route points) | [x] |

## Index

- [decisions.md](decisions.md) — ADR-1..ADR-5
- [batch-1/T1-partition.md](batch-1/T1-partition.md)
- [batch-2/T2-maze.md](batch-2/T2-maze.md)
- [batch-3/T3-ortho-route.md](batch-3/T3-ortho-route.md)
- [diagrams/pipeline.md](diagrams/pipeline.md)
- [decision-journal.md](decision-journal.md) — appended during execution
- **C spec:** `~/git/graphviz/lib/ortho/{partition,maze,ortho}.c`
- **Oracle recipe:** `[[recover-slack-and-c-harness]]`,
  `[[ortho-p1-already-ported-fpq-invariant]]`, `[[oracle-native-not-wasm]]`,
  `/tmp/gvmine`
```
```

## Determinism note (read before T1)

`partition.c` uses a permutation (`generateRandomOrdering` / `SEED`) feeding
`construct_trapezoids`. P1 proved `construct_trapezoids` is deterministic given a
fixed `permute`. Confirm the TS `partition` consumes the **same** permute the C
uses for the fixture (dump C's permute), else trap/cell numbering diverges. If
the TS `SEED`/permute differs from C, pin to C's actual permute, not a guess.
