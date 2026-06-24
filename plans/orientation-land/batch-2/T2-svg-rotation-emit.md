<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — SVG rotation emit (transform + dims + translate)

## Context

Same project conventions as T1 (EPL header, `.js` imports, strict TS, vitest
colocated, lizard caps, JSDoc `@see`). T1 has set `job.rotation = 90` for
landscape graphs and neutralized `transformPoint` rotation. This task makes the
SVG renderer emit the rotation via the graph group transform, matching native
byte-for-byte (decisions.md ADR-1/-3). **Emit-only — do not touch layout.**

Concrete target (b68.gv native, the canary):
```
<svg width="213pt" height="638pt" ...        (port currently 638pt x 213pt)
<g ... transform="scale(1 1) rotate(-90) translate(-634 208.5)">
                              ^^^^^^^^^^ port currently rotate(0) translate(4 208.5)
```
Inner node/edge coords are unchanged (unrotated frame) — verified identical to
native already.

## Task — all gated behind `job.rotation !== 0` (non-landscape unchanged)

1. `emitGraphGroupOpen` (svg-graph.ts:90): replace the hardcoded `rotate(0)`
   with `rotate(${-job.rotation})`. @see svg_begin_page (`rotate(%d, -job->rotation)`).
2. `emitSvgTag` (svg-graph.ts:62): when `job.rotation !== 0`, swap the emitted
   `width`/`height` (and the viewBox W/H). @see init_job_pagination exch_xyf
   (emit.c:1201). Non-rotated path unchanged.
3. Rotated translate: when `job.rotation !== 0`, compute the `tx, ty` passed to
   `emitGraphGroupOpen` from `bb` + `SVG_PAD` + the `rotate(-90)` geometry
   (ADR-3). Derive the formula and pin it to b68 native (`-634, 208.5`); confirm
   the same formula on proc3d native (`translate(-2616.4 756.97)` — may be off if
   it depends on `page=`; b68 is the binding canary). The current non-rotated
   translate (`svgBeginPage`: `tx=SVG_PAD`, `ty=bb.ur.y+SVG_PAD`) must be
   untouched for `job.rotation === 0`.

If the translate formula cannot be made exact for b68 within 2 attempts, STOP
and log the attempted formulas + actual vs expected values to the decision
journal (per the consecutive-fix stop rule).

## Write-set
- `src/render/svg-graph.ts` — `emitGraphGroupOpen`, `emitSvgTag`, the rotated
  translate (in `svgBeginPage` or a small helper)
- `src/render/svg-graph.test.ts` — tests (create if absent; else append)

## Read-set
- `decisions.md` (ADR-1, ADR-3)
- `src/render/svg-graph.ts:62-108` (emitSvgTag, emitGraphGroupOpen), the
  `svgBeginPage` translate computation
- `~/git/graphviz/plugin/core/gvrender_core_svg.c:svg_begin_page`
- `~/git/graphviz/lib/common/emit.c:1201` (exch_xyf), `:1568` (setup_page translate)

## Interface contract (consumed)
`job.rotation: number` from T1 (0 | 90).

## Acceptance (Given/When/Then)
- Given `graphs/b68.gv`, when rendered to SVG, then the graph `<g>` transform is
  exactly `scale(1 1) rotate(-90) translate(-634 208.5)`.
- Given b68, then `<svg>` is `width="213pt" height="638pt"` with matching viewBox.
- Given b68, then a sampled inner node coord equals the native value (unrotated).
- Given any non-landscape graph (e.g. `digraph { a -> b }`), then the SVG
  transform/dims are byte-identical to before (rotate(0), unswapped).
- Given the full survey vs `/tmp/parity.before.json`: 0 regressions on
  non-landscape graphs; `b68` flips to byte-match; no landscape graph enters a
  worse bucket.

## Observability
N/A.

## Rollback
Reversible (revert commit).

## Quality bar
typecheck + tests green; lizard clean; survey gate above. Commit:
`feat(svg): emit landscape rotation transform and swapped canvas dims`
(body: ADR-1/-3, b68 canary, scope note that NaN/proc3d stay diverged).
