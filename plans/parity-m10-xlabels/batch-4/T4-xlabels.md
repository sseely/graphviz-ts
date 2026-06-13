# T4 — src/label/xlabels.ts: placeLabels + Hilbert ordering + adjust

## Context

graphviz-ts lib/label port (mission 10), batch 4. T1–T3 landed
src/label/{rectangle,node,split-q,index}.ts — import, don't re-port.
C is the spec; SPDX; @see cites; strict TS. Hook rule: ≤2 attempts per
file. A parallel agent owns src/common/postproc.ts,
src/layout/dot/splines.ts, src/model/graphInfo.ts — never touch them.

## Task

Port `lib/label/xlabels.{h,c}` (~686 lines) into NEW
src/label/xlabels.ts:

- Public types per xlabels.h: xlabel_t {sz, pos, lbl, set},
  object_t {pos, sz, lbl}, label_params_t {bb, force}; and
  `placeLabels(objs, lbls, params)` (xlabels.c:549+).
- Internals: XLabels_t state (hdx splay dict + spdx R-tree), xlnew/
  xlfree, xlhorder + hd_hil_s_from_xy (Hilbert spatial codes —
  bit-exact integer math; mind JS number semantics on shifts),
  aabbaabb, lblenclosing, objp2rect/objplp2rect/objplpmks, getintrsxi
  (the 9-neighbor index, XLNBR grid), recordointrsx/recordlintrsx,
  xlintersections, xladjust (the candidate-position chooser),
  xlhdxload/xlhdxunload/xlspdxload, xlinitialize. Constants XLXDENOM=8,
  XLYDENOM=2 per AD3.
- Hilbert dict (xlabels.c:47 `dtopen(&Hdisc, Dtobag)` with icompare on
  int keys): per AD4, reuse src/cdt DtSplay IF it reproduces Dtobag
  semantics — ordered iteration by key with DUPLICATE keys retained
  (insertion order among equals). Verify by reading src/cdt/splay.ts;
  if duplicates are rejected/overwritten, extend src/cdt minimally and
  faithfully (journal-worthy: flag in your report) — do NOT substitute
  an ad-hoc sort without proving iteration-order equivalence, the
  order feeds placement order.

TDD: failing tests first in src/label/xlabels.test.ts:
- hd_hil_s_from_xy: pin several (x,y,n) → code values hand-derived
  from the C bit loop
- xladjust on a small fixture (one obstacle, one label): chosen
  position matches a hand-trace of the 9-candidate search
- placeLabels end-to-end micro-fixture: 2 node obstacles + 1 unset
  label → final pos + set=1. If hand-tracing is impractical, a C
  probe is available: compile against Homebrew graphviz... NOTE
  placeLabels is not exported by the installed lib; instead extract
  expectations by compiling the C files directly
  (`cc /tmp/probe.c ~/git/graphviz/lib/label/*.c -I... `) printing at
  %.17g — probes live in .probes/ (untracked).

## Write-set

src/label/xlabels.ts (new), src/label/xlabels.test.ts (new),
src/cdt/* ONLY under the AD4 condition (minimal, journaled),
.probes/* (untracked). Nothing else.

## Read-set

~/git/graphviz/lib/label/xlabels.{h,c}; src/label/index.ts (T3) +
rectangle.ts; src/cdt/splay.ts + types.ts;
~/git/graphviz/lib/cdt/ (Dtobag semantics, if extension needed)

## Interface contract (consumed by T5)

Exactly xlabels.h: `placeLabels(objs: ObjectT[], lbls: XLabelT[],
params: LabelParamsT): number`; `XLabelT {sz: Pointf, pos: Pointf,
lbl: unknown, set: number}`; `ObjectT {pos: Pointf, sz: Pointf,
lbl: XLabelT | null}`; `LabelParamsT {bb: Boxf, force: boolean}`.
(Counts are array lengths — C's n_objs/n_lbls params collapse away;
keep argument ORDER otherwise.)

## Acceptance criteria

- Given pinned (x,y,n) triples, hd_hil_s_from_xy matches hand-derived
  C values
- Given the micro-fixtures, xladjust and placeLabels match the C
  trace/probe at full precision
- Existing suite 0 failed

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator):
`feat(T4): port lib/label placeLabels and Hilbert placement`
