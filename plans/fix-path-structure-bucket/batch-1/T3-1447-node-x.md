# T3 — Diagnose 1447: node-x shifts under splines=ortho

## Context
graphviz-ts is a faithful TS port of C Graphviz (`~/git/graphviz` = spec; read
project `CLAUDE.md`). Corpus `1447.dot` (97 lines, radare2 CFG style,
`splines="ortho"`, shape=box, empty labels) is tracked diverged maxΔ 192.39.
Triage (2026-07-02): bbox width Δ30 (C 860 vs port 830), height exact; nodes
`0x00400f41`/`0x00400f27` shift 42px in x, several others 12–15px; two edges
have coord-count diffs. Because splines=ortho re-routes from node geometry,
the `@d` divergence is downstream of the node-x shifts — but note the ortho
tie-break class (2620/2361) could ALSO contribute after nodes are fixed.

## Task
Diagnosis ONLY (`~/.claude/rules/diagnosis.md` — read first). Find where the
42px node-x divergence originates:
1. Confirm ranks + in-rank ORDER match C (dump per-rank node order both
   sides — you own mincross instrumentation). If order diverges → pin the
   mincross mechanism (build_ranks? transpose tie? flat handling?).
2. If order matches, the divergence is x-coordinate assignment → that is
   T4's territory (x-NS). Dump the evidence (which nodes, their aux-graph
   neighborhoods, degenerate-span check like the blok_60 cost-equality
   test in `.agent-notes/b51-blok60-is-xcoord-ns-selection.md`) and STOP —
   your note then feeds T4's mechanism.
3. Either way, estimate the residual: with node positions hypothetically
   matched, would ortho routing still diverge (2620-class tie-break)?
   Check whether any diverging edge is an equal-cost L-route pair
   (`-Godb=r` dump per `.agent-notes/2361-ortho-maze-corridor-tiebreak.md`).

## Write-set
- `.agent-notes/path-structure-1447.md`
- Temporary env-gated instrumentation in `src/layout/dot/mincross*` only —
  reverted before finishing.

## Read-set
- `~/git/graphviz/tests/1447.dot` (97 lines — read fully)
- `.agent-notes/2361-ortho-maze-corridor-tiebreak.md` (ortho residual class +
  C route-dump recipe)
- `.agent-notes/b51-blok60-is-xcoord-ns-selection.md` (degenerate-span test)
- Port: `src/layout/dot/mincross*.ts`; C: `~/git/graphviz/lib/dotgen/mincross.c`
- `plans/fix-path-structure-bucket/batch-1/overview.md` (note schema)

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/1447.dot -o /tmp/1447.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/1447.dot dot > /tmp/1447.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/1447.c.svg /tmp/1447.port.svg
```

## Interface contract
Note follows the schema in `batch-1/overview.md`; if you stop at the x-NS
boundary, set `classification: "hand-off-T4"` and include the aux-neighborhood
dump T4 needs.

## Quality bar
- `git status` clean except the note; `npx tsc --noEmit` passes.
- Note answers all three questions above with evidence (no guesses).

## Boundaries
- Never: instrument ns*/position.ts (T4 owns them) or rank* (T1); apply fixes.
- Ask first: editing C source (shared tree).
