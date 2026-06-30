<!-- SPDX-License-Identifier: EPL-2.0 -->

# Comparison: `rankdir_dot*` residual after `size=` scaling

**Verdict:** still `diverged` after T1+T2 — but the divergence collapsed from
`maxDelta 3075` (pre-mission) to `maxDelta 43–68`. The remaining divergence is a
**pre-existing layout divergence, not a scaling defect**. Deferred to a separate
layout/text-metric mission (D3/D4: coordinate/layout residuals are out of scope).

Affected rows (all 6): `linux.x86-rankdir_dot{,1,2}`, `nshare-rankdir_dot{,1,2}`.

## What T2 fixed (the size= scaling — correct)

`rankdir_dot` sets `size="6,6"`. The SVG header and group transform now
**conformant** the oracle:

| field | oracle | port (after T2) | before T2 |
|-------|--------|-----------------|-----------|
| `<svg width>` | `432pt` | `432pt` ✓ | `3507pt` |
| group `transform` | `scale(0.123195 …)` | `scale(0.123195 …)` ✓ | `scale(1 1)` |
| node/edge coords | full-size | full-size ✓ (D4) | full-size |

The zoom `Z = 0.123195`, the size-fitted width `432`, and the full-size
coordinates all match. The scaling feature is complete and faithful.

## The residual (out of scope): a uniform +7.5pt y-offset

Every divergence on these rows is a single pre-existing layout difference: the
port's drawing is **~7.5pt taller** than the oracle's. x-coordinates match
exactly; y-coordinates are uniformly shifted by 7.5pt.

| signal | oracle | port |
|--------|--------|------|
| `<svg height>` | `125pt` | `126pt` |
| native height (no `size=`) | `1014pt` | `1021pt` |
| group `translate.y` | `1009.88` | `1017.38` |
| first edge `path/@d` start | `M206.48,-617.29` | `M206.48,-624.79` |
| graph-label line 1 `text/@y` | `-43.3` | `-50.8` |

The first differing path (`svg/g[1]/g[23]/path[1]/@d`) shows x identical
(`206.48, 266.45, 349.66, 406.09`) and y off by exactly 7.5 at every control
point. The `maxDelta 43–68` is this 7.5pt offset amplified at the
largest-magnitude coordinates.

## Root cause (CONFIRMED 2026-06-23) — font-blind vertical text metrics

The port's **vertical** text metrics (`freetypeLineHeight` / `freetypeAscent`
in `src/common/textmeasure.ts`) are hardcoded to **Times-Roman** ascent/descent
ratios (`1825/2048`, `443/2048`) for **every** font. Horizontal metrics (width)
are already font-aware via the LUT (`getFamilyMetrics`), but height is not.
Helvetica/Nimbus Sans has a smaller ascender+descender, so C's FreeType gives a
**smaller line height** for Helvetica labels than the port's Times model.

Measured line height (baseline-to-baseline, Helvetica): the port is too tall by
a fixed per-line amount that scales with fontsize — `+3.75pt/line` at
`fontsize=36` (port `40.5pt` vs oracle `36.75pt`). The graph label here has 2
text lines of Helvetica 36pt → `+7.5pt`, which inflates the label box → the
graph height → a **uniform +7.5pt y-shift of the entire drawing**.

**Isolation proof** (native height, `size=` stripped, fresh layout):

| label | oracle | port | Δ |
|-------|--------|------|---|
| none (`label=""`) | 760 | 760 | **0** |
| 1 text line | 161 | 165 | +4 |
| 2 text lines (no blanks) | 842 | 849 | +7 |
| 3 text lines | 234 | 246 | +12 |
| original (4 blank + 2 text) | 1014 | 1021 | +7 |

Zero divergence with no label; the gap is exactly `N × 3.75pt` per Helvetica
line. Blank lines contribute identically in both (orig − noblank = 172pt both),
so T1's empty-span guard is not implicated.

**End-to-end fix proof (PoC, reverted):** branching `freetypeLineHeight` on
Helvetica with ascent/descent `1537/2048` + `482/2048` (which reproduces the
oracle line height at fontsizes 8–48 exactly) makes rankdir_dot's native height
→ `1014` and `size=` height → `125` — **both conformant with the oracle**. The 7.5pt
offset vanishes; only sub-pixel (~0.5pt) edge-spline routing differences remain
(a separate, much smaller class).

## The fix (proposed follow-up mission)

Make the vertical metrics font-aware, mirroring the existing font-aware width
path: add per-family ascender/descender (hinted to the 96 dpi grid) to the
height model and route `freetypeLineHeight`/`freetypeAscent` through `fontname`.
Start with Helvetica/Arial (the `ARIAL_FAMILY` width entry already exists). Pin
the exact ascent/descent **split** per font from oracle baselines via TDD
(line-height sum is determined; the split affects glyph baseline position).

**Payoff:** 49 of the 251 currently-diverged rows reference Helvetica/Arial; 61
corpus files use Helvetica labels. **Risk:** the ~280 conforms to are all
Times-based and untouched (Times path unchanged); each added font must be
validated across fontsizes with zero regression.

## Update 2026-06-23 — label-height residual FIXED (font-metric mission)

The font-blind metric was fixed: `feature/font-aware-vmetrics` (merge `f5d3500`)
added a name-keyed vertical-metric resolver (Helvetica ascender 1577/2048,
descender 471/2048, exact vs oracle fs6-48). rankdir's graph height now
conforms to the oracle (1014 native / 125 with `size=`); all text, ellipses,
and node polygons align.

**The +7.5pt label-height residual is gone.** What remains on rankdir_dot* is a
*separate, smaller, pre-existing* **edge-routing divergence** (`path/@d` +
arrowhead `<polygon>`, maxDelta ~40–68) — the dominant blocker now. The font fix
flipped 0 verdicts (edge routing keeps these rows diverged) but reduced
divergence broadly elsewhere (e.g. `graphs-xx` maxDelta 5030→1558) and was
merged as a correctness fix. Next blocker for rankdir conformant: edge-spline
routing precision (a separate mission).

## Conclusion

- **Scaling (size= mission): done and correct.**
- **Label-height residual: FIXED** (font-aware vertical metrics, merge `f5d3500`).
- **Remaining rankdir residual: edge-routing precision** (`path/@d`, ~0.5–68pt) —
  a distinct, pre-existing divergence; deferred to an edge-routing mission.
