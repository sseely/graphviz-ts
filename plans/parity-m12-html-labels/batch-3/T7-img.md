# T7 — `<IMG>` sizing + emission + ImageSizer injection (AD3)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Hook
rule: smallest fix, ≤2 attempts per file, then move on.

`<IMG>` parses to HtmlImage (T3 added size fields) but no
size_html_img / emit_html_img equivalent exists. C sizes images via
gvusershape (filesystem) — browser-hostile. AD3: dimensions come from
a caller-injected ImageSizer (name → {w,h} | null); absent or
unresolvable → C's missing-image behavior EXACTLY (read what C does:
warning text + zero size — cite it).

## Task

1. src/common/htmltable.ts: port size_html_img against the ImageSizer
   interface (define the interface here or in htmltable-types.ts —
   wherever the existing type conventions put it; SCALE attr semantics
   per C).
2. src/common/htmltable-emit.ts: port emit_html_img (htmltable.c:597)
   — `<image>` SVG element via the renderer, positioned/scaled per C.
3. Plumbing: thread the optional ImageSizer from the public render
   entry to sizeHtmlLabel. Locate the existing options path (how does
   renderSvg pass the measurer? — match that plumbing). Declare the
   located file(s) in your report. If plumbing requires MORE THAN ONE
   file beyond this task's two, STOP and report.
4. TDD: failing tests first (fake ImageSizer in tests).

## Write-set

src/common/htmltable.ts, src/common/htmltable-emit.ts, + co-located
tests, + AT MOST ONE plumbing file (declared in report).

## Read-set

~/git/graphviz/lib/common/htmltable.c (size_html_img — grep; 
emit_html_img :597); ~/git/graphviz/lib/gvc/gvusershape.c (missing-
image behavior, overview); src/common/htmltable.ts;
src/common/htmltable-emit.ts; src/index.ts (render entry / options).

## Architecture decisions

AD3 (this task). The ImageSizer is optional and additive — absent
must be indistinguishable from C-with-missing-file.

## Interface contract (public, document in JSDoc)

`ImageSizer: (src: string) => {w: number, h: number} | null` passed
via the render options; consumed only by html IMG sizing.

## Acceptance criteria

- Given `<IMG SRC="x.png"/>` + ImageSizer returning 32×16, then the
  cell sizes to it (SCALE rules per C) and `<image>` is emitted at
  C's position
- Given no ImageSizer, then warning + zero-size cell matching C's
  missing-image output for the same input (oracle: dot -Tsvg with a
  nonexistent image path)
- Given graphs without IMG, then output unchanged; suite 0 failed;
  72 goldens byte-identical

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit; new API
optional).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. Commit (orchestrator): `feat(T7): html img sizing and emission
via injected ImageSizer`
