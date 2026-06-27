# T1 — Pin the exact merged-trunk routing divergence

## Context

graphviz-ts is a faithful TypeScript port of C Graphviz; the C source at
`~/git/graphviz` is the canonical spec. Corpus test **2559**
(`digraph { concentrate=true; a->b [label="1"]; c->b; d->b }`) renders
`diverged`. The `concentrate=true` merge of the `c->b` and `d->b` virtual nodes
at rank 1 is **already correct** — instrumentation confirmed `bothupcandidates`
fires and `mergeVirtual` executes. But the final SVG draws `c->b` and `d->b` as
independent single-`<path>` edges, while native draws `c->b` (edge2) as a
**2-segment shared trunk** that `d->b` joins. Native: a merged virtual node at
rank 1 has `in.size==2, out.size==1`, so C `spline_merge(n)` is true and
`make_regular_edge` routes the trunk.

Read `.agent-notes/2559-concentrate-merge-trunk-routing.md` first — it has the
full probe evidence and CONC_DEBUG recipe.

## Task

**Enumerate** the exact point where the port drops the merged-trunk segment.
Determine, with instrumented evidence, the single file + symbol + line where the
chain router fails to emit the trunk that C's `spline_merge` branch produces.
Confirm `conc.ts`/`classify.ts` (merge detection + `mergeVirtual`) are out of
scope. This is a **read-only** task: any source instrumentation must be reverted
(`git checkout`) before finishing; the only file you write is the findings doc.

## Read-set

- `.agent-notes/2559-concentrate-merge-trunk-routing.md` (probe evidence + recipe)
- `src/layout/dot/edge-route-chain.ts` — esp. the `splineMerge(vn)` break (≈290),
  begin/endSeg (≈146-171), to_virt walk (≈74-81)
- `src/layout/dot/splines-route.ts` — `splineMerge`, path begin/end
- `src/layout/dot/edge-route-faithful.ts` — `splineMerge(tn/hn)` sites (≈385-391)
- C: `~/git/graphviz/lib/dotgen/dotsplines.c` — `spline_merge` (≈108),
  `make_regular_edge` hackflag branch (≈1718-1873)

## Method (suggested)

1. Reproduce: `npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/2559.dot dot`
   vs `dot -Tsvg` (note ADR-2: local dot is 15.0.0; for *structure* that's fine,
   for the byte reference use the headless 15.1.0 oracle — that is T2's job).
2. Instrument the chain router (CONC_DEBUG-style `process.env` guard) to trace
   how the merged virtual node (in.size==2) is handled when its chain is routed:
   is `splineMerge` consulted? Does the router emit the trunk segment or fall
   through to a direct route? **Revert all source edits when done.**
3. Cross-read the C `make_regular_edge` branch to identify which sub-step
   (beginpath/endpath at a `spline_merge` boundary, the second path piece, the
   `hackflag` fwdedge) has no port equivalent on this path.

## Write-set

- `plans/fix-concentrate-2559/comparisons/T1-investigation.md` (create)

## Interface contract (output → T2)

The findings doc MUST end with a fenced block of exactly this shape:

```
fixFile: src/layout/dot/<file>.ts
fixSymbol: <function/symbol name>
divergenceLine: <line number where trunk segment is dropped>
trunkAssertion: <how to detect the merged trunk in 2559 SVG, e.g.
  "g#edge2 (c->b) contains exactly 2 <path> elements">
oracleCmd: <exact headless-15.1.0 command to emit concentrate-2559.svg>
conc_classify_in_scope: false   # confirmed merge is correct
```

## Architecture decisions

- ADR-1 (faithful port) and ADR-2 (15.1.0 oracle) apply — see
  [decisions.md](../decisions.md). Do not propose a special-case fix.

## Acceptance criteria

- Given the instrumented probe, when run on 2559, then the exact file:line where
  the merged-trunk segment is dropped is identified and written to the findings
  doc with supporting trace output.
- Given the analysis, when the fix locus is **outside**
  `edge-route-chain.ts`/`splines-route.ts`/`edge-route-faithful.ts`, then STOP
  and flag in the decision journal (T2 write-set assumption is broken).
- Given the findings, when complete, then `conc.ts`/`classify.ts` are explicitly
  confirmed out of scope (`conc_classify_in_scope: false`).
- Given any source instrumentation, when the task finishes, then `git status`
  shows no modified source files (all probes reverted) — only the findings doc.

## Observability

N/A — no new observable runtime operations.

## Rollback

Reversible. Read-only investigation; produces one markdown doc.

## Boundaries

- **Never:** commit instrumented source; edit `conc.ts`/`classify.ts`; modify any
  `src/` file in the final diff.
- **Always:** revert probes with `git checkout -- <file>` before finishing.

## Commit

`docs(T1): pin concentrate-2559 merged-trunk routing divergence`
