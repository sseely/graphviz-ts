<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Instrument the concentrate edge-drop (graphs-b15)

## Context
graphviz-ts is a faithful TS port; C is the spec. `graphs-b15` (`concentrate=true`,
record nodes, clusters) renders 147 edges vs the oracle's 153 — the port drops 6
edges (maxDelta 0, so drawn geometry is correct). The 6 have different tails, so
the parallel-multi-edge IGNORED path is not the cause. See `README.md` (symptom)
and `decisions.md` (AD-1, AD-2).

## Task
Find and **state the mechanism** for the 6 dropped edges. Do not fix anything in
this task. Produce the diagnosis artifact required by `~/.claude/rules/diagnosis.md`:
mechanism (1–2 sentences), origin (`file:line`), causal chain, and what you ruled
out with evidence.

1. Reproduce: render oracle + port and confirm the 6 missing edges (recipe below).
2. Instrument the port's concentrate path — `conc.ts` (`dotConcentrate`,
   `mergevirtual`/`rebuild_vlists` equivalents) and `classify.ts` (class2 path) —
   to trace each of the 6 edges: is it marked IGNORED, merged into a virtual
   chain, pruned by a degenerate-rank truncation, or lost at emission
   (`edge-route.ts`/`splines.ts`)?
3. Instrument C for the same 6 edges (build flag / fprintf in
   `lib/dotgen/conc.c` + `class2.c`, run the oracle binary) to capture C's
   decision for each: which virtual nodes merge, which originals survive, and how
   each original is emitted. Compare to the port — find where the port's decision
   first diverges from C.
4. Write the mechanism to `.agent-notes/graphs-b15-concentrate-drop.md` and append
   a decision-journal row. Name the exact `file:line` in the port to change and
   the C reference it must mirror.

## Write-set
- `.agent-notes/graphs-b15-concentrate-drop.md` (mechanism artifact)
- `plans/fix-graphs-b15/decision-journal.md` (journal row)

No source edits in T1 (any temporary probes must be reverted before finishing;
confirm `git status` shows no `src/` changes).

## Read-set
- `src/layout/dot/conc.ts` (full — `dotConcentrate`, `rebuild_vlists` port,
  `mergevirtual`, `portcmp`, candidate predicates)
- `src/layout/dot/classify.ts:300-369` (concentrateOrMerge, handleMultiEdge,
  oppEdgeConcOrMerge)
- `src/layout/dot/edge-route.ts:445-460` (IGNORED-edge handling)
- `src/layout/dot/splines.ts:390-410` (concentrate-merged chain routing)
- C `~/git/graphviz/lib/dotgen/conc.c` (dot_concentrate, mergevirtual,
  rebuild_vlists), `class2.c` (multi-edge merge), `dotsplines.c` (how concentrated
  originals are emitted)
- `~/.claude/rules/diagnosis.md`

## Reproduce recipe
```
DOT=~/git/graphviz/build/cmd/dot/dot
IN=~/git/graphviz/tests/graphs/b15.gv
GVBINDIR=/tmp/ghl $DOT -Tsvg "$IN" > /tmp/o_b15.svg
GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts "$IN" dot > /tmp/p_b15.svg
# edge titles present in oracle, missing in port (expect the 6):
grep -oE '<title>[^<]*</title>' /tmp/o_b15.svg | sed 's/<[^>]*>//g' | sort > /tmp/o.txt
grep -oE '<title>[^<]*</title>' /tmp/p_b15.svg | sed 's/<[^>]*>//g' | sort > /tmp/p.txt
comm -23 /tmp/o.txt /tmp/p.txt
```
(C oracle instrumentation harness: see memory `recover-slack-and-c-harness` /
`instrument-c-before-quarantine` for the gvplugin_dot_layout dump pattern.)

## Architecture decisions in scope
AD-1 (instrument before fixing), AD-2 (faithful target).

## Interface contracts (consumed by T2)
The mechanism artifact must state, as plain fields T2 reads:
- `originFile`: port file to change (e.g. `src/layout/dot/conc.ts`)
- `originLine`: approximate line / function
- `cReference`: the C function+line the port must mirror
- `mechanism`: 1–2 sentence cause
- `ruledOut`: list of eliminated hypotheses + the evidence

## Acceptance criteria
- **Given** the render recipe, **then** exactly the 6 README-named edges are
  confirmed missing from the port.
- **Given** the instrumentation, **then** the decision-journal + agent-note state
  a mechanism with `file:line` origin, the C reference, the causal chain, and a
  non-empty ruled-out list (an empty ruled-out on this non-trivial defect means
  the cause was guessed — not acceptable).
- **Given** task completion, **then** `git status` shows no `src/` modifications
  (probes reverted).

## Observability requirements
N/A — no new runtime observable operations (temporary diagnostic probes only,
reverted before finishing).

## Rollback notes
Reversible — notes/journal only; no source change.

## Quality bar
Return only the mechanism artifact fields (originFile/originLine/cReference/
mechanism/ruledOut) and the confirmed missing-edge list. No preamble.

## Boundaries
- **Always:** revert any temporary source probes before finishing.
- **STOP:** if the mechanism traces to an irreducible FP/libm tie-break — report
  with a controlled experiment, do not propose a fix.
- **Never:** apply a production fix in T1; never leave probes in `src/`.

## Commit format
`docs(T1): root-cause graphs-b15 concentrate edge-drop` (journal + agent-note only).
