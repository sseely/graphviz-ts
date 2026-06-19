# T1 — Faithful diagnosis of G2 (write the C-vs-TS trace)

## Context

graphviz-ts is a faithful TypeScript port of C Graphviz (`~/git/graphviz`, tag
15.0.0 — the spec). The dot engine is the priority engine. The routing
re-verification corpus (`.probes/route-corpus.ts`) is **24/25**; the lone
divergence is `ports both dense` (`digraph{a:e->b; a:w->c; a->d}`), backlog G2.

The orchestrator's pre-mission investigation (recorded in
[../README.md](../README.md#root-cause)) traced this to the mincross
crossing-count tiebreak. **This task confirms that trace against the running
port and the native oracle before any code is changed** (decisions.md AD-1).

## Task

`audit` the control flow that orders node `a`'s successor rank, and write
`docs/dot-g2-trace.md` that:

1. Cites the exact C tiebreak: `lib/dotgen/mincross.c:593` (`in_cross`) and
   `:611` (`out_cross`) — `ED_tail_port(*e1).p.x > ED_tail_port(*e2).p.x` on the
   `t == 0` (equal `ND_order`) branch.
2. Cites the TS port: `src/layout/dot/mincross-cross.ts:accumCross` lines 110/114
   — tiebreak via `val(node, port.order)` instead of `port.p.x`.
3. **Confirms the runtime values** for the three out-edges of `a` at mincross
   time: `tail_port.p.x` (expect ≈ `-lw, +lw, 0` for `a:w->c`, `a:e->b`, `a->d`)
   and `tail_port.order` (expect `0,0,0`). Instrument by driving the dot
   pipeline up to mincross and dumping the values, OR by adding temporary
   `console.error` in `accumCross` behind a probe (revert before finishing).
4. States the verdict explicitly:
   - **CONFIRMED** — `p.x` is populated (`±lw`), `order` is 0, and the tiebreak
     metric is the only divergence → T2 proceeds as scoped.
   - **REDIRECT (AD-4)** — `p.x` is 0 at mincross time (root cause is
     port-resolution timing) → STOP, do not start T2, flag for human input.
5. Records the oracle vs port rank-1 order and node coords (already in the
   README table — reproduce from a live run to prove the corpus still diverges
   on the mission branch's base).

## Write-set

- `docs/dot-g2-trace.md` (Create) — the trace. **Read-only otherwise.** Any
  temporary instrumentation in `src/` MUST be reverted before the task ends
  (`git diff --name-only` shows only `docs/dot-g2-trace.md`).

## Read-set

- `~/git/graphviz/lib/dotgen/mincross.c:580-615` (`in_cross`/`out_cross`) and
  `:1480-1510` (`local_cross`), `:1619` (`VAL` macro).
- `src/layout/dot/mincross-cross.ts:99-132` (`accumCross`, `transposeCounts`).
- `src/layout/dot/mincross-order.ts:80-90` (the correct `VAL`/`port.order` use).
- `src/common/compass-port.ts:182-190` (`dirE`/`dirW` → `p.x = b.ur.x`/`b.ll.x`).
- `src/common/edge-label-init.ts:249-285` (`chkPort` at edge-init).
- `../README.md#root-cause`, `../decisions.md` (AD-1, AD-4).

## Oracle recipe

```
DOT=~/git/graphviz/build/cmd/dot/dot
GVBINDIR=/tmp/gvplugins
echo 'digraph{a:e->b; a:w->c; a->d}' | "$DOT" -Tsvg   # c@27, d@99, b@171, a@99
npx tsx .probes/route-corpus.ts                        # "ports both dense" DIVERGE
```

## Acceptance criteria (Given/When/Then)

- **Given** the repro graph, **when** rendered through the oracle and the port on
  the branch base, **then** the trace records oracle rank-1 `[c,d,b]` (a.cx=99)
  vs port `[d,c,b]` (a.cx=126), proving the divergence is live.
- **Given** the dot pipeline run to mincross, **when** the three out-edges of `a`
  are inspected, **then** the trace reports their `tail_port.p.x` and
  `tail_port.order`, and states CONFIRMED or REDIRECT per AD-4.
- **Given** the task is complete, **when** `git diff --name-only` is run, **then**
  only `docs/dot-g2-trace.md` appears (no stray `src/` instrumentation).

## Observability

N/A — no new observable operations (browser library).

## Rollback notes

Reversible — the artifact is a doc.

## Boundaries

- **Always:** cite exact C and TS line numbers; revert any instrumentation.
- **Never:** change `src/` logic in this task; the fix is T2's.

## Commit

One commit: `docs(T1): trace G2 compass-port mincross tiebreak`.

## Quality bar

`npx tsc --noEmit` exits 0. Return only the trace doc and a one-line
CONFIRMED/REDIRECT verdict — no preamble.
