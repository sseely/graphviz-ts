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
  matches C conformant (see `../layout-engine-backlog/route-reverification.md`).
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

## ⚠️ Re-scope (2026-06-18)

Pre-flight found `src/ortho/` **already contains a faithful, committed, green
port** of all three P1 targets (`rawgraph.ts`, `trapezoid.ts`+`trap-*.ts`,
`sgraph.ts`, `fpq.ts`), committed `f1e615c` (T17, 2026-05-27) — 3 weeks before
this brief. Typecheck 0, ortho tests green, C tree clean. The original
"create the modules" framing is therefore **obsolete**. The user-approved
re-scope (see decision journal): **keep the existing port; add the missing
C-oracle-pinned unit tests** the brief required, validate the port against
instrumented native C, fix any parity bugs the tests reveal, and remove the
temporary `ortho-diag.test.ts`. Tasks below are re-read as "oracle-test +
parity-fix", not "port from scratch".

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [1](batch-1/overview.md) | Oracle-pin existing rawgraph, trapezoid, sgraph+fPQ ports (C-oracle TDD against committed T17 code); drop temp diagnostic test | [x] |

## Outcome (2026-06-18)

**Complete (re-scoped).** The T17 port was confirmed byte-faithful to native
C and is now oracle-pinned. Added `rawgraph.test.ts` (`1689adb`),
`fpq.test.ts`+`sgraph.test.ts` (`b8b0ebf`), `trapezoid.test.ts` (`5f4c6cb`);
removed the temporary `ortho-diag.test.ts`. Two faithfulness fixes to
`sgraph.ts` (`shortPath` `<=0`→`<0` per sgraph.c:164; `relaxNeighbors`
extraction for the CCN cap). No trapezoid/rawgraph parity fix needed.
Gates: typecheck 0 · `npm test` 1895/1895 · build OK · C tree clean ·
diff scope = `src/ortho/**`+`plans/**`. Notable: the brief's raw-PQ
acceptance example is invalid — fPQ's guard sentinel (`n_val=0`) acts as
`+inf`, so the valid value domain is `≤ 0` (negated distances). See
decision journal for full detail.

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
