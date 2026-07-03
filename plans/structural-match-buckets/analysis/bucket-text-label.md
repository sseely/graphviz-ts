# structural-match text-label bucket — diagnosis

Scope: 86 `structural-match` ids whose worst numeric diff is a `<text>` @x/@y
or enclosing `<g>` @transform, restricted to `label(clust|root)|train11|fsm`.
Diagnosis only — no port source, no `parity.json`, no fix diffs.

## Summary table

| sub-cluster | ids | count | family | tractability | ref |
|---|---|---:|---|---|---|
| labelclust-x-justify | labelclust-{fbl,fbr,fdl,fdr,ftl,ftr,nbl,nbr,ndl,ndr,ntl,ntr} (×3: graphs-,share-,windows-) | 36 | label-justify | known-mechanism | src/layout/dot/graph-label.ts:23-26 |
| labelroot-x-justify | labelroot-{fbl,fbr,fdl,fdr,ftl,ftr,nbl,nbr,ndl,ndr,ntl,ntr} (graphs-, ×1=12) + labelroot-{fdl,fdr,ftl,ftr,ndl,ndr,ntl,ntr} (share-,windows-, ×2=16) | 28 | label-justify | known-mechanism | src/layout/dot/graph-label.ts:23-26 |
| labelroot-y-anchor-inherit | labelroot-{fbc,fbd,fbl,fbr,nbc,nbd,nbl,nbr} (share-,windows-, ×2=16) | 16 | label-anchor | known-mechanism | src/parser/builder.ts:78 |
| self-loop-flip-label-pos | fsm (×3: graphs-,share-,windows-), train11 (×3) | 6 | NOVEL | known-mechanism | — |

Total: 36+28+16+6 = **86**.

## Method note (platform-triplicate check)

Before trusting the "same input, 3 platform dirs" assumption, the `graphs/`,
`share/`, and `windows/` copies of `labelroot-fbl.gv` were diffed directly: the
`share`/`windows` copies are NOT byte-identical to `graphs` — they are the same
logical graph re-serialized by a *previous* `dot` run, with baked-in
`pos=`/`bb=`/`lp=` attributes and `graph [k=v, ...]` bracket-attribute syntax in
place of the `graphs/` copy's bare `k=v;` statements. Native `dot -Tsvg` on both
forms produces **byte-identical** output (verified directly), because plain
`dot` recomputes layout from scratch — the baked-in pos/bb/lp are inert. So the
oracle-side triplicate assumption holds. But rendering both forms through the
**port** does not: the bracket-form copies diverge differently than the
bare-statement copies for some variants. That divergence, not the baked
coordinates, is the actual signal — isolated below.

## labelclust-x-justify / labelroot-x-justify (label-justify)

**Discriminating axis:** none needed — this divergence fires unconditionally,
independent of the b/d/t/l/r/c variant letters, whenever a cluster has (or
inherits) a non-default `labeljust`. **Offset:** large (49.8pt) when the
cluster label text is bigger (font-heavy variants, `rankdir=LR` "f*" prefix —
NOT "font-size" as the corpus-naming heuristic guessed; direct inspection of
`graphs/labelroot-fbl.gv` vs `graphs/labelroot-nbl.gv` shows the `f`/`n` axis
is `rankdir=LR` present/absent, unrelated to fontsize), 4.8pt for the
smaller/no-rankdir variants — direction is always "port renders the cluster
label centered when it should be left/right-justified."

**Mechanism:** `readLabelPos()` in `src/layout/dot/graph-label.ts:23-26` reads
only `sg.attrs.get('labelloc')` and returns a 0/1 (bottom/top) flag; it never
reads `labeljust` and never sets the `LABEL_AT_LEFT`(2)/`LABEL_AT_RIGHT`(4)
bits. The consumer, `placeLabelNonFlip`/`placeLabelFlip` in
`src/layout/dot/position-bbox.ts:174-199`, correctly implements the
`(labelPos & 4) ? right : (labelPos & 2) ? left : center` ternary — the bug is
that `label_pos` for clusters can never carry bits 2/4, so clusters always take
the `center` branch. This is confirmed by contrast with the ROOT-graph path:
`rootLabelPos()` in `src/common/postproc.ts:283-297` correctly ORs in
`LABEL_AT_LEFT`/`LABEL_AT_RIGHT` from `labeljust` — the cluster path
(`graph-label.ts`) was never given the equivalent logic. Root-cause origin:
**`src/layout/dot/graph-label.ts:23-26`**.

**Evidence:** `graphs/labelclust-fdl.gv` cluster0 sets `labeljust="left"`
explicitly (own attr, no inheritance needed) yet the port still renders the
label centered (x=88, bb center) vs oracle x=38.16 (left-justified) — this
rules out "inheritance-only" as the cause; the bug reproduces even when the
cluster declares its own `labeljust`, proving the read path for cluster
labeljust is simply absent, not merely non-inheriting.

## labelroot-y-anchor-inherit (label-anchor)

**Discriminating axis:** cluster0's own `labelloc` presence. The corpus's
`share-`/`windows-` "b" third-letter-position variants (`fbc,fbd,fbl,fbr,
nbc,nbd,nbl,nbr`) omit `labelloc` on `cluster0` and rely on inheriting the
root's `graph [..., labelloc=bottom, ...]` default; the "d"/"t" variants
(`fdl,fdr,ftl,ftr,ndl,ndr,ntl,ntr`) explicitly re-declare
`labelloc=bottom` on `cluster0` itself. **Offset:** 52.2pt ("f"/rankdir=LR
variants) / 124.0pt ("n" variants) on the cluster-label `@y` — direction:
cluster0's label renders at the cluster's TOP instead of BOTTOM.

**Mechanism:** confirmed via minimal repro (isolated `/tmp/t2.gv`: root
`graph[labelloc=bottom]`, cluster0 omits its own `labelloc` — port puts
cluster0's label at y=-93.2 instead of native's y=-41; adding
`labelloc=bottom` to cluster0 explicitly makes the port match exactly). Root
cause: `GRAPH_LABEL_INHERIT_KEYS` in `src/parser/builder.ts:78` —
`['label', 'fontname', 'fontsize', 'fontcolor']` — is the whitelist of
graph-attribute keys seeded from a subgraph's `graphDefaultsSnapshot` into its
own `attrs` map (so the value survives the layout's cluster rebuilds, per the
comment at builder.ts:257-265). `labelloc` (and `labeljust`) are absent from
this whitelist, so when a cluster does not declare its own `labelloc`, no
seeding occurs, and `readLabelPos()` (`graph-label.ts:24`) reads
`sg.attrs.get('labelloc')` directly with **no snapshot fallback** (unlike the
parallel `graphAttrInherited()` helper at `graph-label.ts:35-41`, used for
font/label keys, which does fall back to `sg.graphDefaultsSnapshot`). The
cluster then falls through to the hardcoded default (`LABEL_AT_TOP`), instead
of inheriting the root's `bottom`. Root-cause origin:
**`src/parser/builder.ts:78`** (whitelist) and
**`src/layout/dot/graph-label.ts:24`** (missing snapshot fallback).

**Why `graphs-` labelroot never shows this:** the `graphs/` corpus copies of
these `.gv` files always re-declare `labelloc` explicitly on `cluster0`
wherever the variant needs bottom — the corpus happens to lack a `graphs-`
copy of the `fbc/fbd/nbc/nbd` variants at all (only present under
`share/`,`windows/`), and its `fbl/fbr/nbl/nbr` copies set cluster0's
`labelloc="bottom"` directly (source-level difference, not a platform
rendering difference) — so the missing-inheritance path is simply never
exercised by `graphs-`. This is a corpus asymmetry, not evidence the mechanism
is platform-dependent.

## self-loop-flip-label-pos (NOVEL)

**Discriminating axis:** both `fsm.gv` and `train11.gv` set `rankdir=LR`
(flip=true) and both diverge specifically on a **self-loop edge's label**
(`st0->st0` in train11, an analogous self-loop in fsm) — regular (non-self-loop)
edge labels in the same files render byte-identical to the oracle (verified:
`st9->st10 "10/1"` label at x=66.44 matches exactly; only the self-loop
`st10->st10 "10/1"` and `st0->st0 "00/0"` labels diverge). **Offset:** ~4.0pt
(3.6-3.7 for fsm, 4.0 for train11) on the rendered `<text>` @y — small and
consistent in magnitude, in the direction of the port placing the label closer
to the loop curve than the oracle.

**Mechanism:** `lib/common/splines.c:selfRight` (C) computes the self-loop
label's on-axis offset from a single `width` variable that branches on
`GD_flip`: `width = flip ? dimen.y : dimen.x` (`splines.c:1037-1040`), then
uses that same `width` in `pos.x = ND_coord(n).x + dx + width/2.0`
(`splines.c:1042`) — before a whole-graph coordinate flip swaps x/y for the
final SVG, so this pre-flip `pos.x` becomes the rendered `<text>@y` under
`rankdir=LR`. The port's equivalent, `SelfEdgeImpl.setLabelX()` in
`src/common/splines-selfedge.ts:120-125`, always uses `lbl.dimen.x`
unconditionally — it has **no flip branch** — even though the sibling sizing
function three lines away, `selfRightSpace()` (`splines-selfedge.ts:359-364`),
correctly implements the identical `flip ? lbl.dimen.y : lbl.dimen.x` ternary
(with a comment citing the same C function). This is an internal
inconsistency within one file: the flip-aware ternary was ported for the
space/sizing check but not for the position-assignment call that must use the
same value. Root-cause origin: **`src/common/splines-selfedge.ts:120-125`**
(missing flip branch in `setLabelX`); the perpendicular counterpart
`setLabelY()` (`splines-selfedge.ts:113-118`, used by `selfTop`/`selfBottom`)
has the same missing-branch pattern relative to C's `selfBottom`
(`splines.c:858-862`, `height = flip ? dimen.x : dimen.y`) but is not
exercised by any id in this bucket (train11/fsm's self-loops all dispatch to
`selfRight`/`rightLoop`, not `selfTop`/`selfBottom`, since none of their
self-loop edges declare ports) — noted as a latent sibling bug, not part of
this bucket's evidence.

**Ruled out:**
- `label-justify` (readLabelPos missing labeljust bits) — that mechanism only
  fires on CLUSTER graph labels; fsm/train11 have no clusters at all, and the
  divergence is on an EDGE label, a structurally distinct code path
  (`splines-selfedge.ts`, not `graph-label.ts`).
- `label-anchor` (builder.ts inheritance whitelist) — that mechanism concerns
  graph/cluster-attribute default inheritance at parse time; edge labels carry
  no such inherited attrs, and the divergence reproduces with no clusters or
  `graph[...]` default statements present in the minimal offending files.
- Cluster-label-placement family generally — confirmed by checking a
  non-self-loop edge label in the same file (`st9->st10`), which matches the
  oracle exactly, isolating the defect to self-loop-specific label placement
  code.

text-label: 86 cases → 4 sub-clusters; 80 attributed (known-mechanism), 6 novel;
top candidate = label-justify (64 cases)
