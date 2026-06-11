# T1 — src/label/rectangle.ts: R-tree rectangle primitives

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C source
at ~/git/graphviz/lib (tag 15.0.0) is the spec. Vitest, strict TS, tests
co-located, SPDX EPL-2.0 headers on new files, JSDoc `@see` cites per
ported symbol. Suite baseline 1138/0. This is the first module of the
lib/label port (mission 10); nothing imports it yet.

Hook rule: if a pre-commit/length/CCN hook complains, smallest fix, at
most 2 attempts per file, then move on.

## Task

Port `lib/label/rectangle.{h,c}` (~145 lines) to NEW
src/label/rectangle.ts: the `Rect` type (boundary array indexed via the
CX/NX/CY/NY macros from index.h — port the macros as small functions or
constants, keeping the flat-array layout so later modules match C
loops), InitRect, NullRect, RectArea, CombineRect, Overlap, and any
remaining functions in the file. Preserve the flat
`boundary[NUMSIDES]` representation — do NOT redesign into
{ll,ur} objects; split.q.c and node.c index the array directly.
NUMDIMS=2 / NUMSIDES=4 per AD3 (decisions.md).

TDD: failing tests first in src/label/rectangle.test.ts with
hand-computed C cases.

## Write-set

src/label/rectangle.ts (new), src/label/rectangle.test.ts (new).
Nothing else.

## Read-set

~/git/graphviz/lib/label/rectangle.c, rectangle.h;
~/git/graphviz/lib/label/index.h:1-60 (NUMDIMS/NUMSIDES/CX/NX/CY/NY)

## Interface contract (consumed by T2–T4)

Exported: `Rect` (flat boundary array), `NUMDIMS`, `NUMSIDES`,
`CX/NX/CY/NY` index helpers, `initRect`, `nullRect`, `rectArea`,
`combineRect`, `overlap` — names camelCased per CLAUDE.md, semantics
byte-faithful.

## Acceptance criteria

- Given two overlapping rects, when overlap(), then true; disjoint →
  false (hand-computed C cases incl. touching edges — match C's
  comparison operators exactly)
- Given combineRect of disjoint rects, then the covering rect equals
  C's result
- Given an undefined/Null rect, then rectArea/combineRect behave as C
  (read the C NullRect convention carefully)

## Quality bar

npx tsc --noEmit clean; npx vitest run >=1138 passed / 0 failed.
Commit (by orchestrator): `feat(T1): port lib/label rectangle primitives`
