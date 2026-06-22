# T1 — Arrow types, name→ARR_TYPE resolution, draw-op union

## Context
graphviz-ts: faithful TS port of graphviz C. `src/common/arrows.ts` already has
`parseArrow(str) → ArrowComponent[]` ({name, open, left, right}) and
`arrows-constants.ts` has `ARR_TYPE_*` codes. We need to (a) define the typed
draw-op union (ADR-1), and (b) resolve a parsed component's `name` → `ARR_TYPE`
code + its `lenfact`, so Batch-1/2 can dispatch.

## Task
1. Create `src/common/arrows-types.ts`:
   - `ArrowDrawOp` discriminated union per ADR-1 (`polygon`/`ellipse`/`polyline`).
   - `ResolvedArrow` type: `{ type: number /*ARR_TYPE_*/, open: boolean,
     left: boolean, right: boolean, lenfact: number }`.
2. In `src/common/arrows.ts`: add `resolveArrowType(comp: ArrowComponent) →
   ResolvedArrow` mapping each base name to its `ARR_TYPE_*` + `lenfact` from the
   `Arrowtypes[]` table (arrows.c:146-154). Handle `inv` = normal + INV flag and
   the name synonyms already in `parseArrow`.
3. In `arrows-constants.ts`: add the per-type `lenfact` constants if not present
   (NORM 1.0, CROW 1.0, TEE 0.5, BOX 1.0, DIAMOND 1.2, DOT 0.8, CURVE 1.0,
   GAP 0.5) and `ARR_MOD_INV` if missing.

## Write-set
- `src/common/arrows-types.ts` (create) + `src/common/arrows-types.test.ts`
- `src/common/arrows.ts` (modify — add `resolveArrowType`)
- `src/common/arrows-constants.ts` (modify — lenfact/flags)

## Read-set
- `src/common/arrows.ts` (parseArrow, ArrowComponent, ARROW_NAMES)
- `src/common/arrows-constants.ts` (ARR_TYPE_*)
- `~/git/graphviz/lib/common/arrows.c:62-160` (Arrowdirs/synonyms/mods/names,
  Arrowtypes table, arrow_match_name)
- decisions.md#adr-1

## Interface outputs (consumed by T2/T3)
`ArrowDrawOp` union; `ResolvedArrow {type:number, open, left, right, lenfact:number}`;
`resolveArrowType(comp) → ResolvedArrow`.

## Acceptance criteria
- Given `parseArrow('odot')[0]`, when `resolveArrowType`, then
  `{type:ARR_TYPE_DOT, open:true, lenfact:0.8}`.
- Given `parseArrow('vee')[0]`, then `type:ARR_TYPE_CROW` with the INV modifier
  set (vee = crow|inv per arrows.c synonyms).
- Given `parseArrow('inv')[0]`, then `type:ARR_TYPE_NORM` with INV set.
- Given an unknown name, then it resolves to `ARR_TYPE_NORM` (C default).

## Observability / Rollback
N/A — pure types/functions. Reversible.

## Quality bar
`npm run typecheck && npm test` green. One commit: `feat(arrows): resolve arrow
type + draw-op union (T1)`.

## Boundaries
- Do NOT touch layout/render yet. Do NOT change `parseArrow`'s output shape
  (other code/tests depend on it) — add resolution alongside.
