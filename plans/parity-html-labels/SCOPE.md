# HTML Labels — Mission Scoping

## Gap Table (front-loaded)

| Label slot | Creation site | Gap | Emission skip |
|---|---|---|---|
| node main label | `src/common/poly-init.ts:97` | LIVE — dispatches HTML | `src/common/poly-gencode.ts:98` dispatches `emitHtmlLabel` |
| node xlabel | `src/common/nodeinit.ts:156` | plain `makeLabel` only (D2 comment line 148) | `src/gvc/device.ts:125` skips `lp.html` |
| edge label | `src/common/edge-label-init.ts:128` | plain `makeLabel` only (D2 comment line 121) | `src/gvc/device.ts:125` via `renderOneLabel` |
| edge xlabel | `src/common/edge-label-init.ts:148` | plain `makeLabel` only | `src/gvc/device.ts:125` |
| edge headlabel | `src/common/edge-label-init.ts:160` | plain `makeLabel` only | `src/gvc/device.ts:144` |
| edge taillabel | `src/common/edge-label-init.ts:172` | plain `makeLabel` only | `src/gvc/device.ts:145` |
| graph/cluster label | `src/layout/dot/graph-label.ts:60` | plain `makeLabel` only (no D2 comment; implied) | `src/gvc/device.ts:192–198` inline txt-only path |

## 1. What Works — Live Node HTML-Label Path

`buildNodeLabel` (`src/common/poly-init.ts:91`) checks `isHtmlValue(labelAttr)`
(`src/common/html-string.ts:15`). When true it calls `makeHtmlLabel`
(`src/common/htmltable-pos.ts:210`), which:
1. `parseHtmlLabel(content)` — `src/common/htmltable-parse.ts:400`
   (lex: `htmltable-lex.ts`, parse: `htmltable-parse.ts`)
2. `sizeHtmlLabel(lbl, measurer)` — `src/common/htmltable.ts:288`
   (calls `layoutHtmlTable` at line 249, which computes cell sizes via
   `size_html_txt` / colspan/rowspan logic)
3. Returns a `TextlabelT` with `html: true` and `u: { kind: 'html', html: PlacedHtml }`
   (`src/common/htmltable-pos.ts:235`)

`polyGencode` (`src/common/poly-gencode.ts:98`) checks `label.html &&
label.u.kind === 'html'` and calls `emitHtmlLabel`
(`src/common/htmltable-emit.ts`) which emits cell borders via `emitHtmlBox`
and text runs via `emitHtmlLine`.

### Render comparison: `digraph G { A [label=<<b>hi</b>>]; }`

| | Text content | `font-weight` | `x` | `y` | Dims |
|---|---|---|---|---|---|
| Port (TS) | `hi` | absent | `21.75` | `-13.5` | `62pt × 44pt` |
| C `dot -Tsvg` | `hi` | `bold` | `21.38` | `-13.95` | `62pt × 44pt` |

**Verdict: PARTIAL MATCH.** Node dimensions match; text content is rendered.
Two divergences: (a) `font-weight:bold` missing from TS output — the port
renders the text but drops the bold font-flag from the `<FONT>` stack, and
(b) x/y offsets differ by ~0.4pt, likely a FreeType 96dpi vs LUT baseline
difference.

## 2. What's Missing

### C dispatch (`lib/common/utils.c:441–542`)

Every call site passes `aghtmlstr(str)` as the `is_html` flag to
`make_label`:
- node main: line 441 → already dispatches in port
- node xlabel: line 444 → port calls `makeLabel` unconditionally
- edge label: line 519 → port calls `makeLabel` unconditionally
- edge xlabel: line 528 → port calls `makeLabel` unconditionally
- edge headlabel: line 535 → port calls `makeLabel` unconditionally
- edge taillabel: line 542 → port calls `makeLabel` unconditionally
- graph/cluster: `lib/common/input.c` `do_graph_label` also uses `make_label`
  with `aghtmlstr`; graph-label.ts:60 calls `makeLabel` unconditionally.

C `make_label` (`lib/common/labels.c:142,147`) sets `rv->html = true`
and calls `make_html_label` (`lib/common/htmltable.c:1856`) which runs
`parseHTML` + `size_html_tbl`/`size_html_txt` + `pos_html_tbl`.

### Emission skips (`src/gvc/device.ts`)

`renderOneLabel` (`device.ts:119`): line 125 `if (lp.html) return` — blanket
skip for all non-node-main labels. Affects: edge labels ×4, node xlabel,
graph/cluster label.

`renderClusterLabel` (`device.ts:191`): inline txt-only path with no html
branch — skips html cluster labels silently.

## 3. C Spec Map

| C file | LOC | TS equivalent | Status |
|---|---|---|---|
| `lib/common/htmllex.c` | 1127 | `src/common/htmltable-lex.ts` (111) | PARTIAL — core tokenizer ported; GRADIENTANGLE, SIDES attrs absent from TS |
| `lib/common/htmlparse.y` | 529 | `src/common/htmltable-parse.ts` (417) | PARTIAL — TABLE/TD/FONT/B/I/U/S/BR/IMG/HR/VR parsed; VR render not wired |
| `lib/common/htmltable.c` | 1941 | `htmltable-types.ts`+`htmltable.ts`+`htmltable-pos.ts`+`htmltable-emit.ts` (590) | PARTIAL — sizing + basic table/text emit ported; `emit_html_img`, anchor/map, `setFill`/BGCOLOR render, GRADIENTANGLE, `html_port`, rules/cell-sides rendering not ported |

Key unported C surface: `emit_html_img` (line 597), `setFill` BGCOLOR/STYLE
fill (line 348), `initAnchor`/`endAnchor` URL map (lines 381, 432),
`html_port` (line 916), bold/italic font-flag propagation through `pushFontInfo`
(line 79) — causes the missing `font-weight:bold` divergence above.

## 4. Open Decisions for `/plan-mission`

1. **Parser completeness**: GRADIENTANGLE and SIDES table attrs exist in C
   (`lib/common/htmllex.c:220, 498`) but not in TS types or parse; decide
   scope (full parity vs defer).
2. **Font-flag propagation**: `pushFontInfo`/`popFontInfo` in C tracks bold/
   italic across nested `<B>`, `<I>`, `<FONT>` — `htmltable-lex.ts` tokenizes
   them but the emit path drops the flag. Must fix to pass bold/italic golden.
3. **Browser text measurement for HTML cells**: `size_html_txt` uses FreeType
   in C; TS uses LUT-based measurer which diverges ~0.4pt per line. Decide
   golden tolerance class (1pt? pixel-level?) before setting acceptance bar.
4. **Image cells (`<IMG>`)**: parsed to `HtmlImage` but no `size_html_img` /
   `emit_html_img` equivalent exists in TS. In-scope or deferred?
5. **BGCOLOR/STYLE fill rendering**: cell background colors parsed but not
   emitted in SVG. In-scope for this mission?

## 5. Batch Sketch

| Batch | Tasks | Description |
|---|---|---|
| 1 | T1, T2 | **Creation dispatch**: add `isHtmlValue` check + `makeHtmlLabel` call to node xlabel (`nodeinit.ts:156`), edge label/xlabel/head/tail (`edge-label-init.ts`), graph/cluster label (`graph-label.ts:60`) — mirrors `aghtmlstr` path in C utils.c |
| 2 | T3 | **Font-flag propagation**: fix `pushFontInfo` / bold/italic carry-through in `htmltable-pos.ts` `buildLineRuns` so `font-weight` / `font-style` appear in emitted `TextSpan` |
| 2 | T4 | **Emission unskip**: replace `if (lp.html) return` in `renderOneLabel` (`device.ts:125`) and add html branch to `renderClusterLabel` (`device.ts:191`); wire `emitHtmlLabel` for all label slots |
| 3 | T5 | **Goldens**: generate reference SVGs for each new html-label slot via C `dot -Tsvg`; promote quarantined or create new test fixtures |
| 3 | T6 (opt) | **Image cells**: port `size_html_img` + `emit_html_img` if in scope |
