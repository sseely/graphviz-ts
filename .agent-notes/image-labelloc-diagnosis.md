## Observation: node label Y ignores labelloc (image+text nodes) — root cause pinned

- **Context**: Diagnosing why a node with an image + text label and `labelloc`
  places the label `<text>` Y a few/many points off the oracle
  (inv/nul/val matrix `b` node, and `2082.dot`'s `e1fd845...` node).
- **Confidence**: High — confirmed via instrumented native C build (temporary
  fprintf in a local `~/git/graphviz` checkout, reverted after capture;
  `git diff --stat lib/common/shapes.c lib/common/labels.c` is clean) plus
  direct reading of the port's TS source with Serena.

### Mechanism

Two compounding gaps in the port, both in the node-label sizing/rendering path
(NOT the image code — the missing image resolves to `imagesize=(0,0)` in both
C and the port, so image-size accounting was ruled out):

1. `poly-sizing.ts`'s `polySize()` never computes or returns the C
   `ND_label(n)->space.x` / `space.y` values that `poly_init` derives from the
   final node box (shapes.c:2132–2152). The port's `TextlabelT.space` is set
   once at label construction (`make-label.ts:131`, `space: { x: w, y: h }`,
   mirroring C `labels.c:104: lp->space = lp->dimen;`) and is **never
   overwritten afterward** for plain polygon/box node labels — no call site
   in `nodeinit.ts` (or anywhere else in `src`) assigns to `label.space.x`/`.y`
   post-construction (grep for `space.x =` / `space.y =` across `src` returns
   zero hits outside `record.ts`'s field-tree accumulation and
   `htmltable-pos.ts`'s HTML-cell path — neither applies to this plain-text
   node-label path).
2. `poly-gencode.ts:176`'s `renderLabel()` (the sole renderer for node
   plain-text labels, reached via `renderNodeLabel` at `poly-gencode.ts:415`
   and also reused by `record.ts:437`) hardcodes the **center** formula:
   `let py = coord.y + label.dimen.y / 2.0 - label.fontsize;` and never
   branches on `label.valign` at all. C's `emit_label` (labels.c:240–251)
   switches on `lp->valign` between `t`/`b`/`c` formulas, all of which read
   `lp->space.y`. A faithful port of that exact switch already exists —
   `labelFirstSpanY()` in `src/gvc/device.ts:242–248` — but it is wired only
   into `renderOneLabel` (`device.ts:265`), which is used for edge labels,
   node xlabels, and graph/cluster labels (`edge-labels.ts`, `device.ts:49`,
   `device.ts:297`, `device.ts:309`) — **never** for the main node label.

Both gaps must be fixed together. Because `label.space` always equals
`label.dimen` in the current port, the C `t`/`c`/`b` formulas are
algebraically identical when `space.y == dimen.y`:
`bottom = pos.y - space.y/2 + dimen.y - fontsize` reduces to
`pos.y + dimen.y/2 - fontsize` (the center formula) when `space.y = dimen.y`.
So adding the valign switch alone (gap 2) without fixing `space.y` (gap 1)
would produce **zero visible change** — confirmed algebraically and by
plugging in the port's current (uncorrected) numbers below.

### Origin

- `src/common/poly-sizing.ts` — `polySize()` (defined at line 446) computes a
  local, padded `dimen` and does the box-fit/justification math needed for
  `space.x`/`space.y` (the `expandForShape`/`applySizeConstraints` pipeline
  mirrors shapes.c up through `bb`/`min_bb`), but never assembles or returns
  the `shapes.c:2132–2152` "compute space available for label" block — there
  is no `space` field in `PolySizeResult` (lines 78–92) at all.
- `src/common/poly-gencode.ts:176` — `renderLabel()`'s hardcoded
  `py = coord.y + label.dimen.y / 2.0 - label.fontsize;`, never reading
  `label.valign` or `label.space.y`.
- C reference: `lib/common/shapes.c:2147-2152` (space.y computation) and
  `lib/common/shapes.c:2065-2070`/`2132-2145` (valign resolution + space.x),
  consumed by `lib/common/labels.c:217-275` (`emit_label`, esp. the
  `switch (lp->valign)` at lines 240-251).

### Causal chain

1. `b`/`e1fd845...` nodes set `labelloc=b`, no image loads (`imagesize=(0,0)`
   in C, confirmed by instrumented print), so node box height is driven
   entirely by the padded label box (`bb == min_bb`, `temp = bb.y - min_bb.y
   == 0` in C's poly_init) — this is a coincidence of these specific repro
   graphs, not a separate defect; see "Ruled out" below for how this was
   isolated.
2. C's `poly_init` still assigns
   `ND_label(n)->space.y = dimen.y(padded) + temp` — e.g. for `nul_nul`'s `b`
   node: `dimen.y(padded)=44`, `temp=0` → `space.y=44`; for `2082.dot`'s
   `e1fd845...`: `dimen.y(padded)=23.6`, node box height 136.8 (from
   `height=1.9in` fixed via `fixedsize=true`), `min_bb.y=23.6` → `temp=
   136.8-23.6=113.2` → `space.y = 23.6+113.2 = 136.8`.
3. `emit_label`'s `case 'b'` then computes
   `p.y = pos.y - space.y/2 + dimen.y(raw,unpadded) - fontsize`, which for
   `nul_nul`'s `b` node with captured C values
   `pos.y=50.5, space.y=44, dimen.y=36, fontsize=30` gives `p.y=34.5`
   (internal coords) — this is what produces oracle's `y="-37.5"`.
   For `2082.dot`'s `e1fd845...` node, captured C values
   `pos.y=476, space.y=136.8, dimen.y=15.6, fontsize=13` give `p.y=410.2`,
   matching oracle's `y="-411.5"`.
4. The port's `label.space.y` is stuck at the raw (unpadded) `label.dimen.y`
   (36 for `nul_nul`'s `b`; 15.6 for `2082`'s `e1fd845...`) because nothing
   ever overwrites it, and `renderLabel` ignores `valign` anyway, always
   computing `py = pos.y + dimen.y/2 - fontsize`:
   - `nul_nul` `b`: `50.5 + 18 - 30 = 38.5` → emits `y="-41.5"` (oracle
     `-37.5`, off by 4pt — matches the reported delta exactly).
   - `2082.dot` `e1fd845...`: `476 + 7.8 - 13 = 470.8` → port actually
     emitted `y="-472.1"` vs oracle `y="-411.5"`, a 60.6pt delta — matches
     the analytically predicted `470.8 - 410.2 = 60.6` exactly (confirmed by
     directly running the port: `test/corpus/render-one.ts` on `2082.dot`
     produced `y="-472.1"`; oracle produced `y="-411.5"`).

### Ruled out

- **Image-size accounting bug** (imagesize misread/mis-added into node bb):
  Instrumented C `poly_init` directly (temporary fprintf, reverted) and
  confirmed `imagesize=(0,0)` for every node in both repro files — the
  missing/invalid image contributes nothing to sizing in C itself (the
  `agwarningf("No or improper image=...")` branch zeroes `imagesize` before
  it reaches the `bb = max(dimen, imagesize)` line). Since C's own imagesize
  is zero, the port's documented gap ("usershape/image sizing... needs an
  image loader", `poly-sizing.ts:11`) is provably irrelevant to this specific
  defect family (both repro graphs use non-existent image files).
- **Node box / polygon geometry divergence**: the `<polygon>` (`nul_nul`
  `b` node) and path/edge geometry around `e1fd845...` (`2082.dot`) are
  byte-identical between port and oracle SVGs — confirmed by diffing the
  raw SVG fragments. The defect is confined to the label `<text>` element's
  `y` attribute only.
- **Text measurement / font metrics divergence**: captured raw `dimen.y`
  (unpadded label height) matches between C and the port exactly in both
  cases (36pt for the 30pt single line in `nul_nul`; 15.6pt = 13*1.2 for the
  2082 "lb" label) — so `EstimateTextMeasurer` output is not the cause.
- **labelloc attribute not parsed**: `nodeinit.ts`'s `sizeAttrs()` (line
  128, `labelloc: nodeAttr(n, g, 'labelloc')`) does read the attribute and
  pass it into `polySize`/`labelValign()`, which is used correctly (internally)
  for the ellipse-expansion path (`expandForShape`). The attribute is not
  lost at parse time; it is lost between `polySize()`'s internal
  `labelValign()` result and the label object (never written to
  `label.valign`), and independently ignored again at render time.
- **Fixing only the valign switch (gap 2) as a standalone fix**: ruled out
  algebraically and numerically above — with the port's current
  `space.y == dimen.y` invariant, adding a valign branch to `renderLabel`
  produces the *same* numeric output as today's hardcoded center formula for
  all three of `t`/`b`/`c`, because the three C formulas coincide exactly
  when `space.y = dimen.y`. Confirmed this isn't accidental by deriving it
  symbolically (see Mechanism), not just checking one example.

### Captured concrete values

`nul_nul.gv`, node `b` (`shape=box, labelloc=b, fontsize=30`, missing
`image="image.jpg"`):
| quantity | C (oracle) | port (current) |
|---|---|---|
| node box (`<polygon>`) | y: -72.5..-28.5 | y: -72.5..-28.5 (match) |
| `imagesize` | (0, 0) | n/a (image sizing unported, but contributes 0 either way) |
| `dimen.y` (raw label height) | 36.0 | 36.0 (match) |
| `dimen.y` (padded, poly_init-local) | 44.0 | 44.0 internally in `polySize`, never surfaced |
| `pos.y` (node center) | 50.5 | 50.5 (match) |
| `space.y` | **44.0** (computed) | **36.0** (== dimen.y, never updated) |
| `valign` | `'b'` | `'c'` (never set from labelloc) |
| label `<text> y=` | **-37.5** | **-41.5** (4pt off) |

`2082.dot`, node `e1fd845a83e841e98a47939a50a5649d` (`shape=none,
labelloc=b (inherited node default), fixedsize=true, height=1.9`, missing
image PNG):
| quantity | C (oracle) | port (current) |
|---|---|---|
| `imagesize` | (0, 0) | n/a |
| `dimen.y` (raw) | 15.6 | 15.6 (match, "lb" @ fontsize 13) |
| `pos.y` | 476.0 | 476.0 (match — node box/layout unaffected) |
| `space.y` | **136.8** | **15.6** (== dimen.y) |
| `valign` | `'b'` | `'c'` |
| label `<text> y=` | **-411.5** | **-472.1** (60.6pt off) |

Both deltas (4pt, 60.6pt) are reproduced exactly by the derived formula
substitution above, confirming the mechanism (not a coincidental match).

### PROPOSED FIX (not applied — diagnosis only)

1. In `src/common/poly-sizing.ts`, port the `shapes.c:2132-2152` "space
   available for label" block into `polySize()` (or a small sibling function
   it calls), producing `space: Point` in `PolySizeResult`:
   - `space.x`: `isBox ? max(dimen.x, bb.x) - spacex : (dimen.y < bb.y ?
     max(dimen.x, bb.x * sqrt(1 - (dimen.y/bb.y)^2)) - spacex : dimen.x -
     spacex)`, gated on the (currently also unported) `nojustify` attr —
     check whether `nojustify` is read anywhere in the port first; if not,
     that is a second, narrower gap to flag separately, not to silently fold
     into this fix.
   - `space.y`: `!fixedshape ? dimen.y(padded) + (bb.y - min_bb.y) +
     (dimen.y(padded) < imagesize.y ? imagesize.y - dimen.y(padded) : 0) :
     unchanged`. Since image sizing is unported, `imagesize.y` is always 0
     here today — faithful to C's *current* zero-image-size behavior for
     these repro cases, but will need revisiting once image loading is
     ported (tracked already in `poly-sizing.ts`'s file header TODO).
   - Also compute and expose `valign` (`labelValign(p)`, already computed
     internally at line 451 — just needs to be returned).
2. In `src/common/nodeinit.ts`'s `initNodeFromLabel()` (around line 246),
   after `storeNodeSize(...)`, write the returned `space`/`valign` back onto
   `label.space` and `label.valign` (as a char code, matching
   `make-label.ts`'s `'c'.charCodeAt(0)` convention) — mirroring how C's
   `poly_init` mutates `ND_label(n)->space` and `ND_label(n)->valign` in
   place.
3. In `src/common/poly-gencode.ts`'s `renderLabel()` (line 176), replace the
   hardcoded `py` line with the same three-way switch already implemented
   correctly in `src/gvc/device.ts:242-248` (`labelFirstSpanY`) — either by
   importing/reusing that helper or by porting the identical branch inline,
   and use `label.space.x` (not just `label.dimen.x`) for the `l`/`r`
   justification cases at lines 180-182 to match `labels.c:256-261` (this
   file already has a `// @see lib/common/labels.c:emit_label (254-266)`
   comment above the x-justification switch, suggesting the x side was
   *intended* to match `space.x` but currently reads a value that's also
   frozen at construction-time `dimen.x`).
4. `record.ts:437` reuses the same `renderLabel`; once fixed, verify record
   labels (which also read `labelloc`, per `shapes.c` record init paths) do
   not regress — this is outside the two given repro cases and needs its
   own targeted check before landing.

This targets the mechanism at its origin (the unported `space` computation +
the render-time formula) rather than special-casing image nodes; the fix is
generic to all node labels with `labelloc=t`/`b`, of which "has an image"
repro cases are simply two instances that happen to also have a missing
image (irrelevant to the mechanism, as shown above).
