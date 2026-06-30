<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: ratio=compress activation (+ ratio-aspect dead-code inventory)

## Objective

Activate `ratio=compress` in the `dot` layout so landscape graph **NaN.gv**
compresses to fit `size=` like native dot. The compression *machinery*
(`compressGraph`, `containNodes`, `makeLrvn`, `GD_ln`/`GD_rn`) is **already
ported and correct** — it never runs because `g.info.drawing` is never
populated, so `setRatio` (`ratio_kind`) and the layout-level `size` are unported
and `compressGraph` always early-returns.

This mission also **captures the rest of the dead ratio-aspect family** as
tracked tasks (Batch 2, deferred): `ratio=fill`, `ratio=expand`, `ratio=value`,
and `ratio=auto`/`idealsize` are all implemented-but-dead (or unported) for the
same root cause. They are NOT in scope here — captured so they are not lost.

## Root cause (verified during scoping)

`src/model/graphInfo.ts` declares `drawing?: LayoutParams` but **nothing in the
port ever assigns it**. Consequences:
- `compressGraph` (position-cluster.ts): `drawing?.ratioKind !== 'compress'` →
  always early-returns → `ratio=compress` is a silent no-op.
- `setAspect` (position-bbox.ts): gated on `drawing?.ratioKind` → never fires →
  `ratio=fill`/`expand`/`value` are all dead.
- `setRatio` (C `input.c:576`) is unported; the layout `size`/`filled`
  (`getdoubles2ptf`, `input.c:694`) is parsed only for the viewport zoom
  (device.ts), never into `drawing`.

**Probe (temporary, reverted):** populating `drawing` for compress moved NaN
from `width 307 / scale 0.443 / translate -2596.58` to
`width 396 / scale 0.572 / translate -2011.11` — essentially onto native
(`397 / 0.574 / -2003.6`). The fix is pure wiring.

## Branch

`feature/ratio-compress` (create from `main`; do not work on `main`).

## Architecture (locked — see decisions.md)

1. **Populate `g.info.drawing` in `dotGraphInit`** (the `graph_init` equivalent),
   right after the `nodesep`/`ranksep` block — matching C order (`setRatio` →
   `getdoubles2ptf(size)` immediately follow the ranksep parse in `input.c`).
2. **Compress-only scope (ADR-1).** Populate `drawing` **only for
   `ratio=compress`**. Leave it unset for `fill`/`expand`/`value`/`auto` so
   `setAspect` stays dead for them → the 6 non-compress `ratio=` graphs are
   byte-stable. (`aspectScaleFactors` already returns null for compress/auto, so
   even if compress's `drawing` is read by `setAspect` it self-gates to a no-op.)
3. **Reuse `parseDrawingSize`** (viewport.ts) for the size→points parse; do not
   re-implement `getdoubles2ptf`.

## Acceptance canary

`graphs/NaN.gv` (`landscape` + `ratio=compress` + `size="16,10"`) — currently
**diverged, maxDelta 1906.99**. Must flip to **conformant**, or to
structural-match with maxDelta **≪ 1907** (the probe left a ~1pt width / ~7pt
translate residual, almost certainly the same x-NS/font-metric class documented
for proc3d — see `docs/known-divergences.md` A2 — not a compress bug).

## Constraints

**STOP if:**
- Any of the 6 non-compress `ratio=` graphs changes verdict
  (`b68` auto, `b22` fill, `polypoly` fill, `jsort`/`pgram`/`trapeziumlr` fill) —
  with compress-only scope this must not happen.
- Any non-`ratio` graph's verdict changes (byte-stability is mandatory).
- The fix needs to touch the compress machinery itself (compressGraph /
  containNodes / x-NS) — it is already correct; this mission is wiring only.
- Two consecutive quality-gate failures on the same check.

**PUSH FORWARD (decide and log):**
- The exact `RatioKind` mapping and the `drawing` object shape.
- Refactors within the write-set to satisfy the complexity hook.
- Accepting the NaN residual at structural-match IF it matches the
  proc3d-class font-metric/x-NS delta (cite the known-divergences page).

## Quality gates (run between batches)

| command | pass |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0, all green |
| `~/.claude/hooks/.venv/bin/lizard <changed files> -C 10 -w` | no warnings |
| survey: `npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts` | diff `parity.json` vs `/tmp/parity.before.json`: **0 regressions; NaN → conformant or maxDelta ≪ 1907** |

Baseline before starting: `cp test/corpus/parity.json /tmp/parity.before.json`.

## Batches

| Batch | Task | Status |
|---|---|---|
| 1 (in scope) | [T1 — populate drawing; activate ratio=compress](batch-1/T1-compress-activation.md) | [x] wiring done (commit `6ef3eeb`); canary partial — see below |
| 3 (OPEN — revealed by T1) | [T6 — compress x-NS arrangement divergence](batch-3/T6-compress-arrangement.md) | [ ] |
| 2 (captured, DEFERRED — needs sign-off) | [T2 — ratio=fill (activate setAspect fill)](batch-2/T2-ratio-fill.md) | [ ] |
| 2 | [T3 — ratio=expand (aspectExpandScale)](batch-2/T3-ratio-expand.md) | [ ] |
| 2 | [T4 — ratio=value (aspectValueScale)](batch-2/T4-ratio-value.md) | [ ] |
| 2 | [T5 — ratio=auto / idealsize (unported)](batch-2/T5-ratio-auto-idealsize.md) | [ ] |

## Outcome (2026-06-24)

**T1 shipped** (`6ef3eeb`): `ratio=compress` now activates — faithful `setRatio`
+ size into `g.info.drawing`, compress-only scope. **0 regressions**; the 4
compress corpus graphs (NaN ×3, `1447_1`) get correct overall dims + ranks
(NaN width 307→396 vs native 397; maxDelta 1907→1601).

**Canary only partially met.** NaN improved but stayed `diverged`: the compress
x-NS — dead until T1, never validated — produces a different within-rank
arrangement than C (STOP condition: "machinery correct, wiring only" was false).
Per-node diff: dims/ranks match, within-rank x diverges (median 535). Promoted to
**T6** (Batch 3, open) for a dedicated instrumented investigation
(constraint-bug vs NS-degeneracy). User-approved: ship T1 wiring, open T6.

> **Batch 2 is a captured inventory of dead/unported code, not a work order.**
> Do NOT execute Batch 2 tasks in this mission. Each carries its own oracle
> validation and regression risk (notably T2 fill vs `b22`, currently
> conformant). They exist so the dead ratio-aspect paths are tracked, not lost.

## Docs

- [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
- [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md)
- [diagrams/component-map.md](diagrams/component-map.md)

## C references

- `lib/common/input.c:576` — `setRatio` (ratio attr → `ratio_kind`)
- `lib/common/input.c:693-694` — `setRatio(g)`; `getdoubles2ptf(g,"size",…)` + `filled`
- `lib/dotgen/position.c:501` — `compress_graph` (contain_nodes + ln→rn weight-1000 edge)
- `lib/dotgen/position.c:905` — `set_aspect` (R_AUTO/idealsize, R_FILL, R_EXPAND, R_VALUE)
- `lib/dotgen/position.c:idealsize` — R_AUTO fill decision (unported)
