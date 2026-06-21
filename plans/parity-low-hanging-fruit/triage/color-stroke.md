# Color/Stroke Triage — Batch 2

Triaged 2026-06-21. Each case run through `triage-probe.mjs`; port and
oracle SVGs read directly at the `firstDiffPath` element. Probe commands
were `npx tsx triage-probe.mjs <id> <relpath> dot`.

---

## Case Table

| id | engine | firstDiffPath | port value | oracle value | root cause | verdict | fixModule | fixPlan |
|----|--------|---------------|------------|--------------|------------|---------|-----------|---------|
| 1896 | dot | `svg/g[1]/polygon[1]/@fill` | `#1E1E1E` | `#1e1e1e` | `resolveGraphBgcolor` returns the raw bgcolor attribute verbatim (no colorxlate), so a hex string like `#1E1E1E` is emitted uppercase instead of lowercase | simple | `src/render/svg-graph.ts` | Run the bgcolor through `resolveRenderColor` + `colorPaint` before returning from `resolveGraphBgcolor` |
| 2325 | dot | `svg/g[1]/g[1]/ellipse[1]/@fill` | `lightgrey` | `none` | C's `parse_style` has `FUNLIMIT=64`: when the 64th token is seen it sets `parse[63]=NULL` and returns *before* the pointer-construction loop runs, leaving the static array effectively empty for this call; port's `parseStyleFlags` has no such truncation so `filled=true` leaks through | simple | `src/common/style-resolve.ts` | In `parseStyleFlags`, count tokens; if the count reaches 64 before the loop ends, return `zeroFlags()` (empty flags) to match C's FUNLIMIT truncation |
| 2470 | dot | `svg/g[1]/polygon[1]/@fill` | `#FFFFFF` | *oracle throws* | Same root cause as 1896 (`resolveGraphBgcolor` uppercase bypass); oracle is not available for this case (`triangulation failed` error in C) — port value verified against port SVG only | simple | `src/render/svg-graph.ts` | Same fix as 1896 (same module); oracle unavailability does not affect the port-side diagnosis |
| 2801 | dot | `svg/g[1]/g[9]/text[1]/@fill` | `#000000` | `#1f78b4` | Edge has `colorscheme=paired12 fontcolor=2`; the numeric color index `"2"` is stored in the text span at label-init time and resolved via `textFillAttrs("2")` at render time, but no `withColorScheme` wrapper is active around the text emission so `colorxlate("2")` runs with the global scheme (empty/X11) and returns black | simple | `src/gvc/device.ts` | Wrap the `renderer.beginEdge` / `renderer.endEdge` call block in `renderEdge` with `withColorScheme(e.attrs.get('colorscheme'), ...)` so text spans resolve numeric color indices against the edge's scheme |
| graphs-b155 | dot | `svg/g[1]/polygon[1]/@fill` | `lightcyan1` | `#e0ffff` | `resolveGraphBgcolor` returns `"lightcyan1"` verbatim; `lightcyan1` is an X11 color name not in the SVG `KNOWN_COLORS` set, so it should be canonicalized via `colorxlate` to `#e0ffff` but the bypass skips that path | simple | `src/render/svg-graph.ts` | Same fix as 1896: run bgcolor through `resolveRenderColor` + `colorPaint` |
| graphs-grdcluster | dot | `svg/g[1]/g[2]/polygon[1]/@stroke` | `black` | `none` | `cluster1` has `peripheries=0`; C suppresses the border polygon stroke when peripheries < 1 but the port's `applyClusterPenState` in `device-cluster.ts` does not read the `peripheries` attribute, so the cluster always emits `stroke="black"` | simple | `src/gvc/device-cluster.ts` | In `applyClusterPenState`, read `clusterAttr(sg, 'peripheries')`; if it parses to `0`, set `obj.pen = PenType.Invis` (or emit `stroke="none"` by setting pen color to none) |
| graphs-style | dot | `svg/g[1]/g[5]/ellipse[1]/@stroke-width` | *(absent, defaults to 1)* | `3` | Node `e` has `style="setlinewidth(3)"`; `parseStyleFlags` skips all tokens containing `(` so the penwidth value is never extracted; `resolvePenWidth` returns 1.0 and no `stroke-width` is emitted | simple | `src/common/style-resolve.ts` | Parse `setlinewidth(N)` tokens in `parseStyleFlags` (or `resolvePenWidth`): extract `N` as a float and expose it so `resolvePenWidth` can return it |
| share-proc3d | dot | `svg/g[1]/g[1]/polygon[1]/@stroke-width` | *(absent, defaults to 1)* | `8` | Graph-level `style="setlinewidth(8)"` sets the default penwidth for all cluster borders; same root cause as graphs-style — `parseStyleFlags` skips the token | simple | `src/common/style-resolve.ts` | Same fix as graphs-style |
| windows-proc3d | dot | `svg/g[1]/g[1]/polygon[1]/@stroke-width` | *(absent, defaults to 1)* | `8` | Identical to share-proc3d (same `.gv` content, different OS path); same root cause | simple | `src/common/style-resolve.ts` | Same fix as graphs-style / share-proc3d |

---

## Summary

- **Simple**: 9 cases (all nine in this bucket)
- **Deep**: 0 cases

### Root-cause groups (Batch-2 fix candidates)

#### Group A — `src/render/svg-graph.ts` (3 cases: 1896, 2470, graphs-b155)
`resolveGraphBgcolor` returns the raw attribute string without normalizing it
through `resolveRenderColor` + `colorPaint`. Hex strings pass through uppercase;
X11 names not in SVG's `KNOWN_COLORS` set pass through unresolved.
**Fix**: call `colorPaint(resolveRenderColor(bgcolorAttr))` on the final return
value in `resolveGraphBgcolor` (the `grad !== null ? grad[0] : bgcolorAttr` branch).

#### Group B — `src/common/style-resolve.ts` (3 cases: graphs-style, share-proc3d, windows-proc3d + 1 separate: 2325)
Two sub-issues in the same module:

- **B1 — setlinewidth() not parsed** (graphs-style, share-proc3d, windows-proc3d):
  `parseStyleFlags` silently drops tokens that contain `(`, so `setlinewidth(N)` is
  never converted to a penwidth value.
  **Fix**: extract the numeric argument from `setlinewidth(N)` tokens and return it
  via a new `penWidthOverride` field on `PolyStyleFlags` (or equivalent), consumed
  by `resolvePenWidth`.

- **B2 — style FUNLIMIT truncation not ported** (2325):
  C `parse_style` with ≥64 style tokens returns an empty style list (due to the
  static-array pointer construction loop never executing after the early return).
  Port does not truncate.
  **Fix**: in `parseStyleFlags`, if the token count reaches 64 before the end of
  the string, return `zeroFlags()` immediately.

#### Group C — `src/gvc/device.ts` (1 case: 2801)
Edge label text spans store the raw fontcolor string (e.g. `"2"`) at init time; at
render time, `textFillAttrs` resolves it without the edge's `colorscheme` context
active, so numeric palette indices resolve to black.
**Fix**: wrap `renderer.beginEdge(e, job)` / `renderer.endEdge(e, job)` in
`renderEdge` with `withColorScheme(e.attrs.get('colorscheme'), ...)`.

#### Group D — `src/gvc/device-cluster.ts` (1 case: graphs-grdcluster)
Cluster `peripheries=0` should suppress the border stroke (`stroke="none"`), but
`applyClusterPenState` does not read the `peripheries` attribute.
**Fix**: read `clusterAttr(sg, 'peripheries')`; when it is `0`, set
`obj.pen = PenType.Invis` so the SVG renderer omits the stroke.
