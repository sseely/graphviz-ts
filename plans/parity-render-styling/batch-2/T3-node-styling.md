# T3 — node fill / pen / penwidth / style (AD1, AD2)

## Context

graphviz-ts port; C spec at ~/git/graphviz/lib (15.0.0). Baseline
1466/0, 82 goldens. Hook rule: smallest fix, ≤2 attempts/file, move on.

The node shape codefn (src/common/poly-gencode.ts `polyGencode` →
`renderPeripheries` → renderer.polygon/ellipse) draws node boundaries
through `emitStyle`, which reads `job.obj`. T2 now pushes a default
ObjState per node; T1 provides the resolvers. This task populates the
node's obj-state from its attrs before the shape draws, so
`style=filled`+`fillcolor`, `color` (pen), `penwidth`, and
`style=dashed/dotted/bold` render — matching C poly_gencode.

## Task

1. In polyGencode (after `job.obj` is the pushed node state, before
   renderPeripheries), resolve and set on `job.obj`:
   `fillColor`/`fill` (T1 resolveNodeFill + style.filled →
   FillType.Solid; transparent-pen-when-filled-borderless per C
   peripheries==0 block), `penColor` (T1 resolvePenColor), `pen` (T1
   resolvePenType), `penWidth` (T1 resolvePenWidth). Mirror
   poly_gencode's order: filled fill first, then pen.
   @see lib/common/shapes.c:poly_gencode (:2950-3060 fill/pen block).
2. The first periphery is filled; inner peripheries are not (C sets
   `filled = 0` after the first). Honor that with the M12 peripheries
   loop already in renderPeripheries.
3. Use node attrs via the existing `nodeAttr(n, n.root, key)` helper.
4. TDD: failing tests first (string-level SVG assertions per case).
5. Oracle-verify each: `echo '<dot>' | dot -Tsvg` for fillcolor, color,
   penwidth, style=dashed, style=dotted, style=bold, filled+no-fillcolor
   (→ color), filled-borderless (peripheries via shape=...).

## Write-set (strict)

src/common/poly-gencode.ts + its co-located test file.

## Read-set

~/git/graphviz/lib/common/shapes.c:poly_gencode (fill/pen/peripheries,
:2940-3060); src/common/poly-gencode.ts; src/common/style-resolve.ts
(T1 exports); src/gvc/job.ts (ObjState, FillType, PenType);
src/render/svg-helpers.ts:112-123 (emitStyle).

## Architecture decisions (locked)

AD1 (set on the pushed obj-state, don't side-channel), AD2 (use T1
resolvers), AD3 (two-color fill → first solid), AD4 (don't change
emitStyle).

## Acceptance criteria

- Given `style=filled fillcolor=lightblue`, then
  `<ellipse fill="lightblue" stroke="black" .../>` matching C
- Given `color=red`, then `stroke="red"`
- Given `penwidth=3`, then `stroke-width="3"`; `style=bold` → 2
- Given `style=dashed`, then `stroke-dasharray="5,2"`; dotted → "1,5"
- Given `style=filled` (no fillcolor), then fill = the color attr or
  C default; verify against oracle
- Given an UNstyled node, then output conformant to pre-task
  (default obj-state → `fill="none" stroke="black"`); 82 goldens stable

## Observability / rollback

N/A — gates are the SLI. Reversible (single commit).

## Quality bar

tsc clean; vitest 0 failed; byte-stability clean. Commit (orchestrator):
`feat(T3): render node fill, pen, penwidth, and line style`.
