# Mission: dot-multiport — G2 compass-port mincross tiebreak

## Objective

Close the **last remaining divergence** in the dot routing re-verification
corpus: `ports both dense` (`digraph{a:e->b; a:w->c; a->d}`), backlog **G2**.
A node with multiple compass-ported out-edges orders its successor rank wrong,
mispositioning the node. Make the dot crossing-minimization tiebreak faithful to
C so the corpus reaches **25/25 byte-exact**.

This is a **faithful port fix**, not a redesign. The C source
(`~/git/graphviz`, tag 15.0.0) is the spec.

## Root cause (verified 2026-06-19, oracle + source read)

Not a splines bug. C `in_cross`/`out_cross` (`lib/dotgen/mincross.c:593,611`)
break same-node-order ties by the geometric **`ED_tail_port(e).p.x`** /
**`ED_head_port(e).p.x`**. The TS port (`src/layout/dot/mincross-cross.ts`,
`accumCross`, lines 110/114) breaks them by **`port.order`** via `val()`.
Compass ports `e`/`w` set `p.x = ±lw` (≈±27) but leave `port.order = 0`, so the
ordering signal is lost.

| node | oracle cx | port cx | rank-1 order |
|------|-----------|---------|-------------|
| a (rank 0) | 99 | **126** | — |
| b | 171 | 171 | oracle `[c,d,b]` |
| c | **27** | **99** | port `[d,c,b]` (c/d swapped) |
| d | **99** | **27** | |

The splines are already faithful (they correctly start at `a`'s e/w face); they
only look wrong downstream of the misposition.

## Branch / merge

- Branch: `feature/dot-multiport` off `main`.
- Merge back with a **merge commit** (not squash) — preserves per-task commit
  IDs referenced in the decision journal.

## Execution model

Run with **opus** (`claude-opus-4-8`, native 1M context). Fable 5 is disabled by
Anthropic — do not route autonomous execution to it.

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND every golden byte-identical
  on_fail: fix_and_rerun
- command: npx tsx .probes/route-corpus.ts
  pass: 24 MATCH + ... → after T2: "ports both dense" is MATCH (25/25, 0 DIVERGE)
  on_fail: fix_and_rerun
- command: npx lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only <base>
  pass: within the task's declared write-set
  on_fail: stop
```

The oracle is the locally built `dot` at
`~/git/graphviz/build/cmd/dot/dot` (15.0.0) with `GVBINDIR=/tmp/gvplugins`.

## Constraints

Stop / push-forward conditions: see [batch-1/overview.md](batch-1/overview.md).
Architecture decisions (locked): see [decisions.md](decisions.md).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 diagnose, T2 faithful fix + pins | [x] |

- [decisions.md](decisions.md) — locked architecture decisions
- [batch-1/overview.md](batch-1/overview.md) — task table + stop conditions
- [batch-1/T1-diagnose.md](batch-1/T1-diagnose.md)
- [batch-1/T2-fix.md](batch-1/T2-fix.md)
- [diagrams/mincross-flow.md](diagrams/mincross-flow.md)
- [decision-journal.md](decision-journal.md)

## Operational readiness

N/A — graphviz-ts is a browser layout library, not a service. No SLIs,
dashboards, traces, or on-call story. **Rollback: Reversible** (revert the
merge commit; no data or API migration). No backwards-compat concern: the only
output change is for graphs using multiple compass ports off one node — that
change IS the fix (toward the C oracle); no golden moves.
