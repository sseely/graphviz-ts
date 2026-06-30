<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Apply the faithful concentrate fix (graphs-b15)

## Context
T1 pinned why the port drops 6 concentrate edges (`maxDelta 0`; the 6 are
different-tail record-port edges, mostly into `HoverRest:In`). C never deletes
originals under concentrate — it merges only virtual nodes (portcmp-gated) and
emits every original. Read T1's mechanism artifact before starting:
`.agent-notes/graphs-b15-concentrate-drop.md` (fields `originFile`, `originLine`,
`cReference`, `mechanism`, `ruledOut`).

## Task
Apply the **faithful** fix at the origin the mechanism names, mirroring the C
reference exactly (AD-2). Edit only the implicated file(s) within the AD-3 set:
`conc.ts`, `classify.ts`, `edge-route.ts`, `splines.ts` (+ colocated tests). Do
NOT patch the symptom with a non-C dedup-key change.

1. Implement the change the mechanism prescribes.
2. Add/extend a unit test that pins the corrected behavior at the unit level
   (e.g. the concentrate decision / emission for a different-tail ported edge),
   asserting on the specific outcome — not just "no throw".
3. Verify `graphs-b15` now emits **153 edge blocks** and that all 6 README-named
   edges are present (recipe below).

## Write-set
Only the file(s) T1 implicates, from:
- `src/layout/dot/conc.ts` + `src/layout/dot/conc.test.ts` (if present, else
  extend the relevant existing test)
- `src/layout/dot/classify.ts` + colocated test
- `src/layout/dot/edge-route.ts` + colocated test
- `src/layout/dot/splines.ts` + `src/layout/dot/splines.test.ts`

Touching any file outside this set is a STOP.

## Read-set
- `.agent-notes/graphs-b15-concentrate-drop.md` (T1 mechanism — read first)
- The `originFile` section T1 names; its C reference in `~/git/graphviz/lib/dotgen/`
  (`conc.c` / `class2.c` / `dotsplines.c`)
- `src/layout/dot/conc.ts` (portcmp, candidate predicates, rebuild_vlists port)
- `decisions.md#ad-2` (faithful), `decisions.md#ad-3` (write-set)

## Verify recipe
```
DOT=~/git/graphviz/build/cmd/dot/dot; IN=~/git/graphviz/tests/graphs/b15.gv
GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts "$IN" dot > /tmp/p_b15.svg
grep -c 'class="edge"' /tmp/p_b15.svg          # expect 153
for e in 'FallFaceBack:Normal' 'HoverFaceBack:Normal' 'HoverForwardToStop:Normal' \
         'HoverStrafeToStop:Target' 'MidJumpFaceBack:Normal' 'LandVertical:Target'; do
  grep -q "$e" /tmp/p_b15.svg && echo "OK $e" || echo "MISSING $e"; done
```

## Architecture decisions in scope
AD-2 (faithful, no dedup-key shortcut), AD-3 (write-set), AD-5 (reversible).

## Interface contracts
No public type/signature change expected — concentrate is internal to the dot
layout pass. If the mechanism requires a signature change, note it for T3.

## Acceptance criteria
- **Given** the implicated fix, **when** `graphs-b15` is rendered by the port,
  **then** it emits 153 edge blocks and all 6 named edges are present.
- **Given** a non-concentrate graph, **then** its edge set is unchanged (the fix
  is gated to the concentrate path).
- **Given** the new/extended unit test, **then** it asserts the corrected
  concentrate decision/emission for a different-tail ported edge and passes.
- **Given** `npm run typecheck`, **then** exit 0.
- **Given** `npx vitest run src/layout/dot/conc src/layout/dot/classify
  src/layout/dot/splines`, **then** all pass.

## Observability requirements
N/A — no new observable runtime operations.

## Rollback notes
Reversible — revert the commit. No data/schema/API change.

## Quality bar
Minimal faithful change at the named origin. Return only the diff summary and the
b15 edge-count + 6-edge check. No preamble.

## Boundaries
- **Always:** mirror the C reference; keep the change gated to concentrate.
- **STOP:** if the fix needs a file outside the AD-3 set; if the same line is
  changed 3× without fixing the count.
- **Never:** add a non-C dedup key, config knob, or measurer/algorithm rewrite.

## Commit format
`fix(T2): emit concentrate-merged edges faithfully (graphs-b15)` with a body
noting the C `conc.c`/`class2.c` mechanism and the 6-edge / concentrate blast
radius.
