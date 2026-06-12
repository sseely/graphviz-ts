# T8 — html emission unskip in the live render path

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Hook
rule: smallest fix, ≤2 attempts per file, then move on.

src/gvc/device.ts `renderOneLabel` (:119) has a blanket
`if (lp.html) return` (:125) — skipping html for edge labels ×4, node
xlabel, graph label. `renderClusterLabel` (:191) is an inline
txt-only path with no html branch (silent no-op on html). The node
MAIN label renders html via poly-gencode.ts:98 → emitHtmlLabel
(htmltable-pos/emit — fully working after T5/T6). C dispatches every
label kind through emit_label, which routes html to emit_html_label
(emit.c) at the label's pos.

## Task

1. renderOneLabel: replace the lp.html skip with the html branch —
   call emitHtmlLabel(placed, pos, renderer, job)
   (src/common/htmltable-emit.ts:72; position-parameterized) at the
   same pos the txt path uses, mirroring C emit_label's html routing
   (read emit.c emit_label html branch for the pos/anchor handling —
   html labels anchor differently than text baselines; match C).
2. renderClusterLabel: add the html branch the same way.
3. TDD: failing tests first — placed html edge label renders cells;
   txt-only graphs byte-identical; set=false html labels skipped.

## Write-set (strict — nothing else)

src/gvc/device.ts + its co-located test file (device.test.ts exists).

## Read-set

~/git/graphviz/lib/common/emit.c (emit_label html branch — grep
emit_html_label); src/gvc/device.ts:110-210;
src/common/htmltable-emit.ts:60-85; src/common/poly-gencode.ts:90-110
(the working node-path call shape).

## Architecture decisions

AD1/AD4/AD6 indirectly; no new decisions — this is wiring.

## Interface contract (consumed by T9, T10)

None new — terminal emission. All 7 slots now render html end to end.

## Acceptance criteria

- Given a placed html edge label (set=true), then table cells/text
  render at lp, matching C's structural placement for the same input
- Given an html cluster label, then it renders (no more silent no-op)
- Given set=false or txt labels, then behavior unchanged; 72 goldens
  byte-identical; suite 0 failed

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. Commit (orchestrator): `feat(T8): render html labels in all
live emission slots`
