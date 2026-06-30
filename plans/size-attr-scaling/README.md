<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: `size=` / `ratio` drawing scaling

## Objective

Port the Graphviz **drawing-scale (viewport fit)** feature: consume the `size=`
graph attribute (and the `ratio=fill` / `size="x,y!"` *filled* condition) so the
SVG output is scaled to fit the requested size, exactly as the native `dot`
oracle does. Today the port ignores `size=` entirely — it hardcodes
`transform="scale(1 1)"` and emits unscaled `width`/`height`/`viewBox`. The
native oracle computes a zoom factor `Z` and emits `scale(Z)` plus
size-fitted dimensions.

This is the dominant conformant blocker for the `rankdir_dot*` cluster (the
selected "best" target: 6 diverged rows) and generalizes to **~137 corpus
inputs that set `size=`** (24 also set `ratio=`).

A secondary, independent fix rides along (T1): the port emits an empty `<text>`
element for each blank line in a multi-line label; the oracle emits none. This
is the `childCount` first-diff on the same `rankdir_dot*` rows.

## Branch

`feature/size-attr-scaling` — merge commit to `main` (per-task commit IDs are
referenced in the decision journal; do not squash).

## Scope boundary (read before starting)

- **IN:** `size=` parse → `drawing.size` (inches→points); the *filled* flag
  (`ratio=fill` or trailing `!` on size); `init_job_viewport` zoom `Z`
  computation; SVG render scaling (group `scale(Z)`, fitted `width`/`height`/
  `viewBox`); the empty-label-span guard.
- **OUT (do NOT touch):** `ratio=compress|expand|auto|value` **layout
  reshaping**. That code already exists but inert (`layout/dot/position-bbox.ts`
  reads `ratioKind` but nothing sets it). Activating it changes node positions
  and is a separate, riskier mission. This mission sets `ratioKind` only insofar
  as `init_job_viewport` needs the *filled* condition — see
  [decisions.md](./decisions.md#d3) for exactly how to avoid activating layout
  aspect.

## Canonical C reference (the spec)

| Step | C location |
|------|-----------|
| `ratio=` → `ratio_kind` | `lib/common/input.c:576` `setRatio` |
| `size=` → `GD_drawing->size`, returns `filled` | `lib/common/input.c:694` (`getdoubles2ptf`) |
| zoom `Z` computation | `lib/common/emit.c:3356` `init_job_viewport` |
| `job->scale = zoom * dpi/72` | `lib/common/emit.c:3680` |
| ptf short-circuit for SVG (DOES_TRANSFORM) | `lib/gvc/gvrender.c:422` |
| SVG `width`/`height`/`viewBox` / `scale()` emit | `plugin/core/gvrender_core_svg.c:258,312` |
| empty-string textspan guard | `lib/gvc/gvrender.c:419` `gvrender_textspan` |

## Constraints

**Stop and ask** when: a change needs a file outside the task write-set that is
in no other task's write-set; two consecutive quality-gate failures on the same
check; the same code location is changed ≥3× without resolving a failing check;
the implementation would contradict [decisions.md](./decisions.md); **any of the
278 existing conformant rows regress** (see D5); activating ratio-aspect layout
reshaping appears necessary (out of scope — stop).

**Push forward** (log to decision journal) when: a choice is purely stylistic;
a task is simpler than estimated; an obvious self-explanatory fix; pinning a
constant (rounding mode, pad) directly from instrumented C output.

## Quality gates (run between every batch)

```
- command: npx tsc --noEmit --stableTypeOrdering
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0
  on_fail: fix_and_rerun
- command: git diff --name-only main
  pass: only files in completed tasks' write-sets
  on_fail: stop
```

Regression scan (T3): `npx tsx test/corpus/survey.ts` then confirm
`conformant >= 278` and `errored`/`timeout` counts do not rise.

## Baseline (pre-flight verified 2026-06-22)

- `feature/size-attr-scaling` does not exist ✓
- `npx tsc --noEmit` clean ✓ (stray untracked `debug-*.ts`/`*-probe.ts` are
  outside the compile graph — ignore them)
- `plans/` and `.claude/settings.autonomous.json` gitignored ✓
- Executor must confirm `npx vitest run` is green before T1 (not run at
  planning time; ~1999 tests).

## Batches

| Batch | Task | Status |
|-------|------|--------|
| 1 | [T1 — empty-label-span guard](./batch-1/T1-empty-label-spans.md) | [x] |
| 2 | [T2 — size= drawing scaling](./batch-2/T2-size-scaling.md) | [x] |
| 3 | [T3 — goldens, dashboard, regression](./batch-3/T3-verify.md) | [x] |

Batches are **sequential** (T2's zoom-compute and T1's guard both edit
`gvc/device.ts`; T3 verifies the prior two). One commit per task,
`type(Tn): …` per `~/.claude/rules/commits.md`.

## Session summary (2026-06-22)

**Tasks:** T1, T2, T3 — all complete. Commits: `2b6d43b` (T1), `3f0c23d`
(T2), `59a5f5e` (T3), on `feature/size-attr-scaling` (+ `5a2e838` chore).
**NOT yet merged to main** — awaiting user decision (see canary note below).

**Delivered:**
- T1: `renderOneLabel` skips empty label spans (`gvrender_textspan` guard),
  baseline advance unconditional. Golden `dot-label-blank-lines`.
- T2: faithful `size=` parse (`getdoubles2ptf`) + `init_job_viewport` zoom in
  new `src/gvc/viewport.ts`; SVG group `scale(Z)` + size-fitted dims. Golden
  `dot-size-scaling`. Filled/upscale cases match the oracle exactly.
- T3: survey/dashboard refreshed.

**Results:** conformant **278 → 280** (+2), structural 236 → 237, diverged
254 → 251; errored/timeout unchanged. **0 regressions** (per-id verified).
All `size=` graphs' divergence shrank (rankdir `maxDelta 3075 → 43–68`).

**Two corrections to the brief (C source is the spec):**
- **D4 mechanism wrong:** `transformPoint` never short-circuits in this port
  (flag never set). Carrying `job.zoom=Z` double-scaled SVG coords. Fix: carry
  Z in `job.scale` (what C's `svg_begin_page` actually emits), leave
  `job.zoom=1`; raster ptf path untouched.
- **D3 rule wrong:** `ratio=fill` must NOT set `init_job_viewport`'s `filled`
  (only size-`!` does). It sets `ratio_kind=R_FILL` → layout reshaping (out of
  scope). OR-ing it upscaled ~31× vs the oracle's ~1×.

**Canary shortfall (for user review):** the 6 `rankdir_dot*` rows did NOT reach
byte/structural — they remain `diverged` on a **pre-existing ~7.5pt graph-label
height layout divergence** (uniform y-offset, x-coords exact), independent of
`size=` and out of scope (D3/D4). The scaling itself conforms to the oracle.
Comparison page: [comparisons/rankdir-dot-residual.md](./comparisons/rankdir-dot-residual.md).
`ratio=fill` position residuals also deferred (R_FILL layout reshaping).

## Index

- [decisions.md](./decisions.md) — architecture decisions (D1–D5)
- [batch-1/overview.md](./batch-1/overview.md) · [T1](./batch-1/T1-empty-label-spans.md)
- [batch-2/overview.md](./batch-2/overview.md) · [T2](./batch-2/T2-size-scaling.md)
- [batch-3/overview.md](./batch-3/overview.md) · [T3](./batch-3/T3-verify.md)
- [diagrams/data-flow.md](./diagrams/data-flow.md) · [diagrams/component-map.md](./diagrams/component-map.md)
- [decision-journal.md](./decision-journal.md)
