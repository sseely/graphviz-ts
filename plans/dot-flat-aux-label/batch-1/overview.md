# Batch 1 — aux flat-edge label

Three sequential tasks, one executor (inline — deep context already in
session). T1 and T2 both touch the aux pipeline; T2 depends on T1 (the
spline/X fix is what exposes the isolated Y bug). T3 depends on T2 (the
label must be correctly positioned in the aux before copy-back).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | reposition iterates `nlist` (DOT-11a) | inline | `splines-flat.ts`, `splines-flat.test.ts` | — | [ ] |
| T2 | aux label Y tracks repositioned vnode (DOT-11b) | inline | `splines-label.ts` (and/or `splines-flat.ts`) | T1 | [ ] |
| T3 | copy label back (DOT-10) | inline | `splines-flat.ts`, `splines-label.ts`, `splines-flat.test.ts` | T2 | [ ] |

## C spec anchors

- reposition loop — `dotsplines.c:1215-1232` (`for n = GD_nlist...`)
- `setEdgeLabelPos` / `place_vnlabel` — `dotsplines.c:199-212, 484`
- label copy-back — `dotsplines.c:1273-1277`

## Diagnosis artifacts (from planning session)

- After T1 fix: spline byte-exact, label = (72, **-54.2**) — X right, Y wrong.
- Aux label vnode pre-splines: `type 1, in 1, out 1, coord {51,72}`.
- Aux label `pos = {60.75, 59.25}` (frozen pre-reposition) vs needed y≈72.
