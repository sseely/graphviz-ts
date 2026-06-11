# T9 — headlabel / taillabel implementation

## Context

graphviz-ts port; C source is the spec; suite baseline ~1065/0 after
batch 2 (66 goldens).

Quarantined repro: dot-head-tail-label (`A->B[headlabel="h"
taillabel="t"]`) — SVG g[3] childCount 3 vs expected 5: the two label
text elements are missing. Port status: emission is ALREADY wired
(src/common/emit-edge.ts:96-117 EdgeLabelHelper emits
e.info.head_label/tail_label), and label creation machinery exists
(src/common/make-label.ts) — but nothing ever populates the fields,
and the positioning pass is unported. C spec:

- Creation: lib/common/utils.c:533-545 — if E_headlabel attr non-empty,
  ED_head_label(e) = make_label(...) with head-label font attrs
  (labelfontname/labelfontsize/labelfontcolor fallbacks — read
  initFontLabelEdgeAttr); GD_has_labels |= HEAD_LABEL. Same for tail.
- minlen interaction: lib/dotgen/rank.c:165-173 doubles minlen for
  labeled edges — check whether the port's equivalent already exists
  and whether head/tail labels participate (read the C carefully:
  ED_label vs head/tail label handling differ).
- Positioning: lib/common/splines.c:1316-1358 place_portlabel —
  position relative to spline endpoint; called from
  lib/dotgen/dotsplines.c:440-453 for edges with head/tail labels.
  Note C only calls it under E_labelangle/E_labeldistance conditions —
  read the actual condition; the quarantined ref shows where default
  attrs put the labels, which is the ground truth.
- Typing: AD6 — change edgeInfo.ts head_label/tail_label from
  `unknown` to the make-label return type.

## Task

1. NEW src/common/edge-label-init.ts: port the head/tail label
   creation (utils.c:533-545 + initFontLabelEdgeAttr fallback chain),
   called from dot init (src/layout/dot/init.ts) at the C-equivalent
   point.
2. Port place_portlabel + the dotsplines.c:440-453 placement loop into
   src/layout/dot/splines-label.ts.
3. AD6 typing in src/model/edgeInfo.ts (and fix any fallout —
   emit-edge.ts casts etc. stay within read-set as verification; if a
   real change is needed there, it is 1-3 lines and in-scope as
   "neighboring fix", journal it).
4. TDD: failing tests first (edge-label-init.test.ts: attr → label
   object with correct font fallbacks; placement values vs
   hand-computed C expectations).
5. Verify quarantined dot-head-tail-label passes via the compare.ts
   probe approach. Report; T10 promotes.

## Write-set

src/common/edge-label-init.ts (new),
src/common/edge-label-init.test.ts (new), src/layout/dot/init.ts,
src/layout/dot/splines-label.ts, src/model/edgeInfo.ts,
src/common/emit-edge.ts (only if a ≤3-line neighboring fix is forced;
journal), .probes/* (untracked)

## Read-set

~/git/graphviz/lib/common/utils.c:500-560 (incl.
initFontLabelEdgeAttr); ~/git/graphviz/lib/common/splines.c:1300-1360;
~/git/graphviz/lib/dotgen/dotsplines.c:430-460;
~/git/graphviz/lib/dotgen/rank.c:155-180; src/common/make-label.ts
(call it, don't re-port); src/common/emit-edge.ts:90-120;
src/layout/dot/splines-label.ts; src/model/edgeInfo.ts:60-80

## Architecture decisions

AD6 (typing). C-is-sacred: font fallback chain and placement
conditions exactly; the quarantined ref is ground truth for default
placement.

## Interface contract (consumed by T10)

Report: dot-head-tail-label PASS/FAIL with structural/maxDelta result.

## Acceptance criteria

- Given `A->B[headlabel="h" taillabel="t"]`, when layout+emit run,
  then the SVG gains both text elements (g childCount 5) and the
  quarantined comparison passes at dot tolerance
- Given labelfontsize/labelfontname attrs, then the fallback chain
  matches C (unit test)
- Given edges without head/tail labels, then output is unchanged
  (suite green, 66 goldens)
- Given AD6, then head_label/tail_label are no longer `unknown` and
  tsc is clean

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`feat(T9): port headlabel/taillabel creation and placement`
