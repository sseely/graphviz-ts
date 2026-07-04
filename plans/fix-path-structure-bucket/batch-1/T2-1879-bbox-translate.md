# T2 — Diagnose 1879: bbox + translate-x divergence

## Context
graphviz-ts is a faithful TS port of C Graphviz (`~/git/graphviz` = spec; read
project `CLAUDE.md`). Corpus `1879.dot` (8876 lines, clusters, family-tree
style `couple_*`/`node_*`) is tracked diverged, maxΔ 875.68, firstDiffPath an
edge `@d`. Triage (2026-07-02):
- C: width=10915 height=1563 translate=(278.69, 3376.69)
- port: width=10800 height=1343 translate=(4, 3102)
The C translate-x of 278.69 (vs the standard 4) means C's content extends
~275pt LEFT of the origin before the viewport shift — the port's doesn't.
Height Δ220 as well. Edge coord-count diffs (Issue-2 signature) are
downstream.

## Task
Diagnosis ONLY (`~/.claude/rules/diagnosis.md` — read first). Two questions,
in order:
1. WHY does C's layout extend left of x=0 (which element is at min-x in C,
   and where is that element in the port)? Identify the element(s) at the
   bbox extremes on both sides (parse the SVGs; `flat-geom-diff.mjs` gives
   per-element deltas). This localizes whether it's a node placement,
   cluster box, label, or spline excursion.
2. Trace that element's coordinate back to the pass that first diverges
   (ranking? mincross? x-NS? spline?). Instrument only within your ownership
   (emit/bbox code); if the trail leads into rank (T1) or NS (T4) territory,
   dump the evidence you have, name the owning task, and stop there — that IS
   a valid deliverable.

## Write-set
- `.agent-notes/path-structure-1879.md`
- Temporary env-gated instrumentation in `src/render/*` / emit/bbox code —
  reverted before finishing.

## Read-set
- `~/git/graphviz/tests/1879.dot` (skim structure; 8876 lines)
- `test/diagnostic/flat-geom-diff.mjs` (usage)
- Port emit/translate: `src/render/` SVG emitter (locate translate handling
  via Serena `search_for_pattern 'translate('`)
- C: `~/git/graphviz/lib/common/emit.c` (viewport/translate),
  `lib/dotgen/position.c` if the trail goes there
- `plans/fix-path-structure-bucket/batch-1/overview.md` (note schema)
- Memory hint: issue-numbered tests pin a GitLab issue — check
  `git -C ~/git/graphviz log --all --grep=1879` for the closing MR context.

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/1879.dot -o /tmp/1879.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/1879.dot dot > /tmp/1879.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/1879.c.svg /tmp/1879.port.svg
```

## Interface contract
Note follows the schema in `batch-1/overview.md`.

## Quality bar
- `git status` clean except the note; `npx tsc --noEmit` passes.
- Note pins mechanism + file:line OR a hand-off finding naming T1/T4 with the
  evidence trail.

## Boundaries
- Never: touch rank*/mincross*/ns*/position.ts (owned by T1/T3/T4); apply fixes.
- Ask first: editing C source (shared tree).
