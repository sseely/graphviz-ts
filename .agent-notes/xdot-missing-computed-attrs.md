# xdot: missing computed attributes

## Observation: the xdot emitter wrote none of the label-geometry attributes, and the comparator was blind to all of them

- **Context**: Auditing the port's `-Txdot` output against the native oracle
  (`~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/ghl`). Native attaches a
  family of COMPUTED attributes to the laid-out graph in
  `lib/common/output.c:attach_attrs_and_arrows`; the port emitted only
  `pos`/`bb`/`width`/`height`.
- **Finding**: Seven computed attributes were never emitted — graph/cluster
  `lp`/`lwidth`/`lheight`, node `xlp`/`rects`, edge `lp`/`xlp`/`head_lp`/`tail_lp`.
  Independently, `test/golden/compare-xdot.ts` listed only
  `POSITIONAL_ATTRS = ['pos','bb','width','height']`, so even once emitted they
  would not have been diffed. The two gaps masked each other: label geometry
  could be arbitrarily wrong (or absent) and the corpus still reported
  `conformant`. This is why two large label bugs (126 ids and 218 ids) hid in the
  corpus.
- **Impact**: Any future xdot attribute added to the emitter MUST also be added
  to `POSITIONAL_ATTRS`, or it is emitted into a blind spot. Treat
  `attach_attrs_and_arrows` as the authoritative inventory of what xdot must
  carry — it is the single C function that decides the whole set.
- **Confidence**: High — every emitted value now matches the oracle byte-for-byte
  on the reference graph; the golden xdot suite (144 native refs, of which 20
  carry `lp`, 15 `lwidth`/`lheight`, 6 `xlp`, 5 `head_lp`/`tail_lp`, 4 `rects`)
  passes with the widened comparator.

## Observation: C's emit CONDITIONS are as load-bearing as the values

- **Context**: Porting `attach_attrs_and_arrows` / `rec_attach_bb` emit gates.
- **Finding**: The conditions are not uniform, and guessing them wrongly produces
  spurious attributes on exactly the graphs that have labels:
  - `lp`/`head_lp`/`tail_lp` are emitted whenever the label OBJECT exists.
  - `xlp` additionally requires `->set` (`output.c:309`, `:382`) — an xlabel that
    the placer never positioned is omitted. `lp` has no such check.
  - graph/cluster `lp`/`lwidth`/`lheight` require a label with NON-EMPTY text
    (`GD_label(g) && GD_label(g)->text[0]`, `output.c:239`) — `label=""` emits none.
  - all four edge attributes live INSIDE the loop that writes `pos`, so an
    IGNORED edge or one with no spline gets none of them even when it has a
    label (`output.c:349-353`).
  - `rects` keys on the shape NAME being exactly `"record"` (`strcmp`,
    `output.c:314`). Verified against the oracle: `Mrecord` and HTML-table nodes
    get NO `rects`.
- **Impact**: `lwidth`/`lheight` are also the only computed attrs written in
  INCHES with `%.2f` (`output.c:244-247`); everything else is points at `%.5g`.
  Use `printfFixed(v, 2)` / `gfmt5`, not `toFixed`.
- **Confidence**: High — each condition read from the C and confirmed against the
  native binary.

## Observation: record-shape nodes never get an xlabel (pre-existing layout bug, NOT an emit bug)

- **Context**: The reference graph's record node `c[shape=record,xlabel="NX"]`
  produced no `xlp` from the port while native emitted `xlp="61.89,159"`.
- **Finding**: `src/common/nodeinit.ts:233-236` — `initNodeFromLabel` early-returns
  on the record branch:
  ```ts
  if (shape.kind === ShapeKind.SH_RECORD) {
    recordNodeInit(n, g, measurer);
    return true;            // skips initNodeXLabel() on line 238
  }
  ```
  C's `common_init_node` (`lib/common/utils.c:443`) creates `ND_xlabel`
  UNCONDITIONALLY for every shape; `shapeOf(n) == SH_RECORD` is only passed as a
  flag to the MAIN label's `make_label` (utils.c:441). So in the port a record
  node's `n.info.xlabel` stays `undefined` → no xlabel placement → no `_ldraw_`
  text op, no `xlp`, and a short `bb`.
- **Ruled out**: the emitter's `xlp` gate. A plain node
  (`digraph{c[xlabel="NX"];}`) emits `xlp="10.11,44.4"`, matching native exactly,
  and edge xlabels (`set:true`) emit correctly too. Only the record path loses it.
- **Impact**: Real divergence, exposed the moment the comparator gained `xlp`.
  Fix belongs in `src/common/nodeinit.ts` (call `initNodeXLabel` before the
  record early-return), which is outside this change's write-set. NOTE: the
  corpus does NOT catch this — no file in `~/git/graphviz/tests` combines a
  record shape with an xlabel (the record ∩ xlabel intersection is EMPTY across
  all 180 corpus `.dot` files). A regression test must be written by hand.
- **Confidence**: High — isolated by differential test across shape variants.

## Observation: widening the comparator revealed ZERO new divergences on the corpus

- **Context**: Phase-3 quantification over a 90-file corpus sample (of 180)
  spanning graph labels (42), edge labels (35), clusters (48), record nodes (7),
  head/tail labels (6/6) and xlabels (4), under BOTH dot and neato.
- **Finding**: 0 ids newly diverge on either engine — every id that was reported
  conformant before is still conformant with the 7 attributes now compared. The
  result is NOT vacuous: the attributes are genuinely exercised (dot, 58
  comparable ids: `lp` on 36, `lwidth`/`lheight` on 23, `head_lp`/`tail_lp` on 6,
  `xlp` on 2, `rects` on 2; neato, 75 comparable ids: `lp` on 49,
  `lwidth`/`lheight` on 28, `head_lp`/`tail_lp` on 6, `rects` on 4, `xlp` on 2).
- **Impact**: The port's label geometry was ALREADY correct — it was simply never
  written out, and never checked. The two label bugs this hunt was chasing are
  therefore not corpus-visible label-POSITION errors; the corpus's blind spot was
  emission, not computation. Pre-existing divergences on the old attrs are
  unchanged (dot 8, neato 27) and are untouched by this change.
- **Confidence**: High — measured, with the exercise counts above establishing
  non-vacuity.
