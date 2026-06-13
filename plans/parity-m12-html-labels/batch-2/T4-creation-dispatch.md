# T4 — html creation dispatch at all 7 label slots

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Hook
rule: smallest fix, ≤2 attempts per file, then move on.

M11 created plain-text labels for all slots; each creation site calls
`makeLabel` unconditionally with a D2 comment marking the html
limitation. C passes `aghtmlstr(str)` to make_label at every site
(utils.c:441/444/519/528/535/542; input.c do_graph_label). T1 (landed)
provides the unified `makeAnyLabel(content, isHtml, ...)` entry —
this task switches the remaining 6 non-main slots to it and removes
the D2 limitation comments.

## Task

1. nodeinit.ts (xlabel block, ~:148-160): call makeAnyLabel with
   `isHtmlValue(attr)`; cite utils.c:444. Remove the D2 comment.
2. edge-label-init.ts: same for label (utils.c:519), xlabel (:528),
   headlabel (:535), taillabel (:542). Preserve the lazy fontinfo
   pattern exactly as it stands.
3. graph-label.ts (doGraphLabel, :60): same for graph/cluster labels;
   cite input.c do_graph_label's aghtmlstr use. This file never got a
   D2 comment (M11 T8 finding) — no comment to remove, add the @see.
4. TDD: failing tests first in each module's co-located test file
   (html xlabel on node, html label/xlabel/head/tail on edge, html
   graph label → info.*.html === true with PlacedHtml).

## Write-set (strict — nothing else)

src/common/nodeinit.ts, src/common/edge-label-init.ts,
src/layout/dot/graph-label.ts, + their co-located test files.

## Read-set

~/git/graphviz/lib/common/utils.c:430-548;
~/git/graphviz/lib/common/input.c:838-900 (do_graph_label);
src/common/make-label.ts (T1's makeAnyLabel);
src/common/html-string.ts (isHtmlValue); the three target files.

## Architecture decisions

AD1 (use the unified entry; no call-site branching), AD6 (PORT data
flows through untouched — no attachment logic here).

## Interface contract (consumed by T8, T9)

`info.xlabel/.label/.headlabel/.taillabel` and graph `info.label` may
now be html TextlabelT (html=true, u.kind='html', set=false until
placement — placement machinery is label-kind agnostic and untouched).

## Acceptance criteria

- Given `A [xlabel=<<b>x</b>>]`, when init, then n.info.xlabel.html
  is true with PlacedHtml and NODE_XLABEL bit set (placement bits
  unchanged from M11)
- Given html on each of the 5 edge/graph slots, then the same per
  slot, with @see cites to the exact utils.c/input.c lines
- Given plain-text attrs only, then 72 goldens byte-identical, suite
  0 failed

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. Commit (orchestrator): `feat(T4): html dispatch at all seven
label creation slots`
