<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: orientation=land rotation (SVG)

## Objective

Port Graphviz's landscape rotation (`orientation=land` / `rotate=90` /
`landscape=true`) for the SVG renderer. Native rotates the final drawing 90°
via the graph group transform (`rotate(-90)`) while keeping inner coordinates
in the unrotated frame; the port currently ignores it and emits `rotate(0)`,
leaving all landscape graphs diverged. This is an **emit-only** feature —
`GD_drawing->landscape` is read solely in gvc/emit.c (`gvc->rotation = 90`),
never in `lib/dotgen/` or splines, so layout and routing are untouched.

## Branch

`feature/orientation-land` (create from `main`; do not work on `main`).

## Architecture (locked — see decisions.md)

1. **Group transform**, not ptf coord rotation: emit `rotate(-job.rotation)` in
   the graph `<g>`; inner coords stay unrotated. Matches native byte-for-byte.
2. `job.rotation = 90` when landscape; `transformPoint` does **not** apply
   `applyRotation` (ptf rotation is raster-only, currently dead).
3. Rotated translate derived from `bb` + pad + `rotate(-90)` geometry, validated
   against b68 native (`-634, 208.5`).
4. **Scope: rotation only.** `ratio=compress` (NaN), `page=` pagination
   (proc3d), cluster edge-47 are out of scope.

## Acceptance canary

`graphs/b68.gv` (landscape + `ratio=auto`, no other complications) — its inner
coords already match native; only the transform/dims differ. **b68 must flip to
byte-match.** NaN and proc3d will improve but stay diverged (separate blockers).

## Constraints

**STOP if:**
- Any non-landscape graph's verdict changes (byte-stability is mandatory).
- A landscape graph regresses to a worse bucket (e.g. b68 structural→diverged).
- The implementation needs to touch layout/routing (`src/layout/**`,
  `src/pathplan/**`, splines) — contradicts the emit-only architecture.
- A change is needed outside a task's declared write-set.
- Two consecutive quality-gate failures on the same check.

**PUSH FORWARD (decide and log):**
- Iterating the rotated-translate formula against b68/proc3d native values.
- Refactors within the write-set to satisfy the complexity hook (file ≤500
  lines, CCN ≤10, ≤5 params — note: lizard counts `??` as +2 CCN).
- Test additions and JSDoc `@see` citations.

## Quality gates (run between batches)

| command | pass |
|---|---|
| `npm run typecheck` | exit 0, no errors outside `instr-port`/`probe-edgeinfo` scratch |
| `npm test` | exit 0, all green |
| `~/.claude/hooks/.venv/bin/lizard <changed files> -C 10 -w` | no warnings |
| survey: `npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts` | diff `parity.json` vs `/tmp/parity.before.json`: **0 regressions on non-landscape graphs; b68 → byte-match** |

Baseline before starting: `cp test/corpus/parity.json /tmp/parity.before.json`.

## Batches

| Batch | Task | Status |
|---|---|---|
| 1 | [T1 — landscape flag → job.rotation (byte-stable)](batch-1/T1-landscape-flag.md) | [x] |
| 2 | [T2 — SVG rotation emit (transform + dims + translate)](batch-2/T2-svg-rotation-emit.md) | [x] |

## Docs

- [decisions.md](decisions.md) — architecture decisions
- [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)

## C references

- `lib/common/input.c:699-704` — parse rotate/orientation/landscape → landscape
- `lib/common/emit.c:3260` — `landscape → gvc->rotation = 90`; `:3390` → job
- `lib/common/emit.c:1201` — `init_job_pagination` swaps imageSize on rotation
- `lib/common/emit.c:1568` — `setup_page` rotation translation
- `plugin/core/gvrender_core_svg.c:svg_begin_page` — `rotate(-job->rotation)`

## Mission summary (2026-06-24) — COMPLETE

- **Tasks:** T1, T2 — both done. Commits `9dde0d0` (T1), `33236df` (T2) on
  `feature/orientation-land`.
- **Result:** `b68` flips `structural-match → byte-match` (the canary) — the
  only verdict change across all 795 corpus graphs. **0 non-landscape
  regressions** (byte-stability held; only the 4 landscape graphs change any
  bytes). byte-match corpus count 324 → 325.
- **Landscape graphs (4, not 3):** NaN, b68, **b69** (uses quoted
  `rotate = "90"`, missed by the initial grep), proc3d. b68 → byte-match;
  the rest improve maxDelta but stay diverged on separate out-of-scope
  blockers (NaN: ratio=compress NaN; proc3d/b69: page=/rankdir residuals),
  none entering a worse bucket. proc3d 2620→217, b69 2728→117, NaN 2007→1907.
- **Key derivation:** rotated group translate `tx=-(bb.ur.x+PAD)`,
  `ty=bb.ur.y+PAD` traced from `setup_page`'s rotation branch (SVG =
  `GVRENDER_Y_GOES_DOWN`): `translation.x=-(focus.x+pageSize.x/2)`.
  `pageSize=imageSize/zoom` is Z-independent (outer `scale` carries Z), so the
  formula is correct for any `size=` fit, not just the Z=1 canary.
- **Gates:** typecheck 0; `npm test` 2367 green; lizard clean on all changed
  files; survey gate met.
- **Decisions of note:** parseLandscape kept self-contained in viewport.ts
  (avoid layering inversion gvc←layout); transformPoint ptf rotation branch
  neutralized (ADR-2, SVG rotation is the group transform); parseLandscape
  tests colocated in new `viewport.test.ts` (forced by the 500-line hook).
