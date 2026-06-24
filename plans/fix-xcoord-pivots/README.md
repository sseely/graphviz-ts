# Mission: fix x-coord network-simplex pivot divergence (2475_2 hang)

## Objective

The dot corpus input `2475_2.dot` renders in ~126s (was an apparent hang); native
`dot` renders it in 3.77s. Root phase is `dotPosition`'s **x-coordinate network
simplex**: the port performs **34434 pivots vs native's 8748 (~4×)** on the same
NS call. A pure-forest synthetic matches native *exactly* (9076=9076), so the
divergence is structure-specific (forest of small DAGs with rank-spanning edges).
This mission **pins the exact divergence and fixes it faithfully** so the port's
x-coord NS converges in native's pivot count.

## Success bar (confirmed)

**Match native's pivot count (~8748)** on `2475_2` — full faithfulness. A
sub-20s render is a consequence, not the bar. Fixes must be faithful corrections
toward C semantics, not perf hacks (see [decisions.md](decisions.md) ADR-4).

## Branch

`fix/xcoord-pivots` off `main`. Merge commit (preserves per-task commit IDs).
The working tree already contains two prior faithful NS fixes in `ns.ts`
(slack-cache, leaveEdge cursor) — build on them; do not revert.

## Evidence already gathered (do not re-derive)

- Port aux graph: 26849 nodes / **384804 edges**; native: 26849 / **391709** (~7k gap).
- Port: **34434** x-coord pivots; native: **8748** for the same NS call.
- Pure-forest synthetic (i//2 trees) matches native exactly → not a tree-level bug.
- `dfsRange` visits/pivot: 423 (synthetic) vs 5000–8500 (real) — a *symptom* of
  the extra pivots + larger subtrees, not the cause.
- See memory `hang-2475-2-xcoord-ns` and PARITY.md `timeout` bucket.

## Constraints

**Stop and wait for human input if:**
- A task needs to modify files outside its declared write-set (and not in any
  other task's write-set).
- 2 consecutive quality-gate failures on the same check.
- Batch 1 cannot produce a minimal (<~50-node) graph reproducing a ≥2× pivot gap
  after reasonable structural experiments — the structural trigger is elusive;
  escalate with the dumps gathered.
- The candidate fix changes results *away* from native (parity verdict
  regressions) — that means the root cause was mis-pinned.
- The fix would require changing >3 source files beyond the one named by T3.
- An architecture decision in [decisions.md](decisions.md) is contradicted.

**Push forward with judgment on:**
- Instrumentation/probe details, dump format, C build specifics.
- Minimal-graph structural experiments and fixture naming.
- Test assertion style, as long as it pins port-vs-native pivot count.

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | fix_and_rerun |
| `npx vitest run` | exit 0, ≥2263 tests | fix_and_rerun |
| `npx tsx test/corpus/survey.ts` then per-id diff | 0 verdict regressions | stop |
| 2475_2 x-coord pivot probe | pivots ≈ native (~8748), render < 20s | fix_and_rerun |

## Batches

| Batch | Goal | Status |
|---|---|---|
| [Batch 1](batch-1/overview.md) | Pin the exact divergence (instrument + compare + minimal repro) | [x] |
| [Batch 2](batch-2/overview.md) | Implement the faithful fix + full verification | [x] |

## Index

- [decisions.md](decisions.md) — architecture decisions (ADR-1..4)
- [batch-1/overview.md](batch-1/overview.md) — T1 native dump, T2 port dump, T3 pin
- [batch-2/overview.md](batch-2/overview.md) — T4 fix, T5 verify
- [diagrams/data-flow.md](diagrams/data-flow.md) — x-coord NS pipeline
- [diagrams/component-map.md](diagrams/component-map.md) — affected components
- [decision-journal.md](decision-journal.md) — appended during execution
