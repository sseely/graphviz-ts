# Mission: dot-edgetype (DOT-7)

## Objective

Regular (cross-rank) edge routers must honor `edgeType(g)` so that
`splines=line` and `splines=polyline` produce straight / polyline regular
edges instead of always emitting splines. The `splines` attribute is already
parsed (`splines.ts:edgeTypeFromString`, `index.ts:setEdgeTypeFromAttr`) and
`EDGETYPE_NONE` already skips routing; flat labeled edges already honor `et`
(DOT-2). Only **regular** edges ignore it.

C source `~/git/graphviz/lib/` tag **15.0.0** is the spec. Port faithfully.

## Branch

`feature/dot-edgetype` off `main`. Merge back with a **merge commit** when
gates pass (preserves per-task commit IDs).

## Execution model

Run with **opus** (`claude-opus-4-8`). Fable 5 is disabled.

## C reference (the dispatch)

`make_regular_edge` (`dotsplines.c:1757-1861`):
- `et == EDGETYPE_LINE && makeLineEdge(...)` → direct tail→head segment
  (`makeLineEdge`, line 1636: 4-pt, or 7-pt with an edge label; returns 0 for
  `delr==1`, or `delr==2` with edge labels → falls to box path).
- else build the box corridor, then:
  - `routesplines(P)` if `EDGETYPE_SPLINE`
  - `routepolylines(P)` otherwise; and if `EDGETYPE_LINE && pn>4`, straighten:
    `ps[1]=ps[0]; ps[3]=ps[2]=ps[pn-1]; pn=4`.

`SPLINE` (default) is unchanged. `routePolylines` is already ported
(`src/common/splines-routespl.ts:425`).

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND 115 goldens byte-identical (122 golden tests)
  on_fail: fix_and_rerun   # a non-byte-identical golden is a HARD STOP (see below)
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: exit 0 (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
```

Baseline (main @ branch point): tsc 0; vitest **1842 passed / 0 failed**;
122 golden tests (115 goldens byte-identical).

## Constraints

**STOP when:**
- A golden becomes non-byte-identical — means the `et` dispatch leaked into the
  default `EDGETYPE_SPLINE` path. This is the core safety invariant; hard stop.
- Files outside the declared write-set need changes (and aren't in another
  task's write-set).
- Two consecutive gate failures on the same check, or 3 consecutive edits to
  the same location without resolving the same failure.
- A case can only pass by editing a ref/oracle value (never alter the oracle).

**PUSH FORWARD with judgment when:**
- Purely stylistic, no behavioral impact.
- A sub-case reaches dot within tolerance (AD-3) — pin it and move on.
- A sub-case cannot reach parity — quarantine with a comparison page (AD-4)
  and continue.
- Minor index/off-by-one corrections within the declared write-set.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1, T2, T3, T4 (sequential — routers share files) | [ ] |

## Links

- [decisions.md](decisions.md) — architecture decisions (AD-1..AD-4)
- [batch-1/overview.md](batch-1/overview.md) — task table + dependencies
- [diagrams/dispatch-map.md](diagrams/dispatch-map.md) — edge-type dispatch map
- [decision-journal.md](decision-journal.md) — appended during execution
- Gap spec: [../layout-engine-backlog/gaps/dot.md](../layout-engine-backlog/gaps/dot.md) (DOT-7)
