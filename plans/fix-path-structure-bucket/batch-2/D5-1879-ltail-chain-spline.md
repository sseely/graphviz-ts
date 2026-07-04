# D5 — Diagnose 1879's ltail long-chain pre-clip spline residual

## Context (from .agent-notes/path-structure-1879.md "Secondary" — read fully)
36 of 348 edges in 1879.dot — all `ltail=`-tagged compound edges
(`couple_X -> node_Y [ltail=cluster_X]`) spanning multiple ranks — diverge
from C with large per-point deltas (worst 875.68) or differing retained
bezier segment counts. T2 verified `src/layout/dot/compound.ts`'s clip
algorithm byte-faithful against `lib/dotgen/compound.c` (side order,
rounding, degenerate/normal branch, index arithmetic) and showed the
UN-clipped end of every diverged edge matches C exactly — so the divergence
is in the RAW, PRE-CLIP spline fed to `makeCompoundEdge` for long/multi-rank
chain edges. Node/cluster coordinates in 1879 are byte-identical to C, so
this is spline ROUTING, not layout.

## Task
Diagnosis ONLY (~/.claude/rules/diagnosis.md). Pick 1-2 diverged ltail edges
(e.g. `couple_74x75->node_20x21_21`) and one matching conformant ltail edge;
dump the port's pre-clip `bez.list` (env-gated instrumentation at the
makeCompoundEdge input or the chain-router output) and reconstruct C's
pre-clip spline analytically (C post-clip SVG + the byte-faithful clip
algorithm run in reverse is usually enough; C code as spec:
lib/dotgen/dotsplines.c make_regular_edge chain path). Pin where the chain
routing first departs: box corridor? recover_slack? piece-count from the
fitter? straight-mode? Check prior notes first: edge-order,
long-edge-undersegment, recover-slack-and-c-harness,
active-fitter-no-loop-corridors, faithful-corridor-minw-per-rank memories
all touched this subsystem.

## Write-set
- `.agent-notes/1879-ltail-chain-spline.md` (deliverable, standard schema)
- Temporary env-gated instrumentation in `src/layout/dot/edge-route-chain.ts`
  / `edge-route-faithful.ts` / `splines-route.ts` — fully reverted.

## Read-set
- `.agent-notes/path-structure-1879.md` (Ruled-out section = your head start)
- C: `~/git/graphviz/lib/dotgen/dotsplines.c` (make_regular_edge,
  completeregularpath, recover_slack neighborhood)
- Port: `src/layout/dot/edge-route-chain.ts`, `edge-route-boxes.ts`,
  `edge-route-faithful.ts`
- Relevant `.agent-notes/`: lone-edge-recoverslack-fix-and-perf-followup.md,
  parallel-corridor-fix-and-lone-recoverslack-followup.md

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/1879.dot -o /tmp/1879.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/1879.dot dot > /tmp/1879.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/1879.c.svg /tmp/1879.port.svg
```
Bash allowlist: first token must be one of node, npx, npm, git, python3, ls,
cat, grep, find, head, tail, wc, sort, diff, mkdir, cp, mv. NEVER prefix
with `cd` (already in the repo root); write multi-line scripts to files and
run `node /tmp/<file>.mjs`, never `node -e`.

## Interface contract
Note per the batch-1 overview schema (Mechanism/Origin/Causal chain/Ruled
out/Fix target JSON with classification).

## Quality bar
- `git status` clean except the note; `npx tsc --noEmit` passes.
- Mechanism + file:line pinned, or ruled-out list + next instrumentation
  named. No speculative fixes.

## Boundaries
- Never: apply fixes; touch rank*/ns*/position/mincross/ortho (other tasks);
  edit C source in ~/git/graphviz.
