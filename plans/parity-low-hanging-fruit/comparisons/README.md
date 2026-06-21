# Deep-case comparison pages

38 deep cases across 10 root-cause groups. All cases are deferred per ADR-3
(each exceeds the localized ≤~30-line / single-module cutoff and requires
infrastructure work beyond this mission's scope).

---

## G1 — arrowhead `dot`/`odot` emits polygon instead of `<ellipse>` (13 cases)

**Follow-on bucket:** `arrowhead-geometry`

Port `arrow_type_dot` from `lib/common/arrows.c` to emit a filled/open circle
as `<ellipse>` instead of the current 3-point polygon stub.

| Case | Corpus path |
|------|-------------|
| [1408](1408.md) | `1408.dot` |
| [1447_1](1447_1.md) | `1447_1.dot` |
| [graphs-arrows](graphs-arrows.md) | `graphs/arrows.gv` |
| [graphs-b79](graphs-b79.md) | `graphs/b79.gv` |
| [graphs-newarrows](graphs-newarrows.md) | `graphs/newarrows.gv` |
| [graphs-root](graphs-root.md) | `graphs/root.gv` |
| [linux.x86-arrows_dot](linux.x86-arrows_dot.md) | `linux.x86/arrows_dot.gv` |
| [linux.x86-root_circo](linux.x86-root_circo.md) | `linux.x86/root_circo.gv` |
| [linux.x86-root_twopi](linux.x86-root_twopi.md) | `linux.x86/root_twopi.gv` |
| [macosx-arrows_dot](macosx-arrows_dot.md) | `macosx/arrows_dot.gv` |
| [nshare-arrows_dot](nshare-arrows_dot.md) | `nshare/arrows_dot.gv` |
| [nshare-root_circo](nshare-root_circo.md) | `nshare/root_circo.gv` |
| [nshare-root_twopi](nshare-root_twopi.md) | `nshare/root_twopi.gv` |

---

## G2 — arrowhead `crow`/`vee` 9-point geometry (3 cases)

**Follow-on bucket:** `arrowhead-geometry`

Port `arrow_type_crow0` from `lib/common/arrows.c:632` for `crow` and `vee`
arrow types; wire arrowhead-type dispatch into `arrowheadPolygon`.

| Case | Corpus path |
|------|-------------|
| [144_no_ortho](144_no_ortho.md) | `144_no_ortho.dot` |
| [144_ortho](144_ortho.md) | `144_ortho.dot` |
| [2490](2490.md) | `2490.dot` |

---

## G3 — cluster/object AGSEQ id numbering (4 cases)

**Follow-on bucket:** `agseq-id-numbering`

Port cgraph's global AGSEQ sequence into the Graph model; use it for cluster
SVG ids (`clust<AGSEQ>`) instead of the current per-type sequential counter.

| Case | Corpus path |
|------|-------------|
| [1453](1453.md) | `1453.dot` |
| [2242](2242.md) | `2242.dot` |
| [2592](2592.md) | `2592.dot` |
| [705](705.md) | `705.dot` |

---

## G4 — charset=latin1 / ISO-8859 input (8 cases)

**Follow-on bucket:** `charset-encoding`

Add charset-aware input decoding: detect Latin-1 / ISO-8859 encoding and apply
`latin1ToUTF8` conversion before parsing (mirrors C's `labels.c:make_label`
CHAR_LATIN1 branch).

| Case | Corpus path |
|------|-------------|
| [graphs-Latin1](graphs-Latin1.md) | `graphs/Latin1.gv` |
| [graphs-b34](graphs-b34.md) | `graphs/b34.gv` |
| [graphs-b56](graphs-b56.md) | `graphs/b56.gv` |
| [graphs-b60](graphs-b60.md) | `graphs/b60.gv` |
| [share-Latin1](share-Latin1.md) | `share/Latin1.gv` |
| [windows-Latin1](windows-Latin1.md) | `windows/Latin1.gv` |
| [1308_1](1308_1.md) | `1308_1.dot` |
| [1367](1367.md) | `1367.dot` |

---

## G5 — binary / corrupt input + charset (4 cases)

**Follow-on bucket:** `charset-encoding`

Requires both latin1 re-decode AND a tolerant lexer that accepts trailing
binary garbage after the closing `}` (C's lex scanner recovers; the PEG grammar
requires strict EOF).

| Case | Corpus path |
|------|-------------|
| [1474](1474.md) | `1474.dot` |
| [1489](1489.md) | `1489.dot` |
| [1494](1494.md) | `1494.dot` |
| [1676](1676.md) | `1676.dot` |

---

## G6 — HTML named-entity table, e.g. `&alpha;` (1 case)

**Follow-on bucket:** `html-entities`

Implement the full ~200-entry HTML named-entity table from C's `entities.c`
and call it from `make-label.ts:makeAnyLabel` (UTF-8 path).

| Case | Corpus path |
|------|-------------|
| [graphs-Symbol](graphs-Symbol.md) | `graphs/Symbol.gv` |

---

## G7 — HTML-table cell layout / rounded border (2 cases)

**Follow-on bucket:** `html-table-layout`

Two distinct sub-gaps: fixed-size nested table cell dimensions (1622_0) and
`style=rounded` outer border as bezier `<path>` via `render_corner_arc`
(graphs-rd_rules).

| Case | Corpus path |
|------|-------------|
| [1622_0](1622_0.md) | `1622_0.dot` |
| [graphs-rd_rules](graphs-rd_rules.md) | `graphs/rd_rules.gv` |

---

## G8 — graph/object tooltip anchor wrapper (1 case)

**Follow-on bucket:** `tooltip-anchor`

Port `svg_begin_anchor` / `emit_begin_graph` tooltip-anchor wrapping for graph,
cluster, node, and edge objects from `lib/common/emit.c`.

| Case | Corpus path |
|------|-------------|
| [1880](1880.md) | `1880.dot` |

---

## G9 — outputorder=edgesfirst (1 case)

**Follow-on bucket:** `outputorder`

Port `outputorder` graph attribute from `lib/common/emit.c:emit_graph`; add a
pre-pass that re-orders the node/edge emit loop when `outputorder=edgesfirst`
or `outputorder=nodesfirst`.

| Case | Corpus path |
|------|-------------|
| [42](42.md) | `42.dot` |

---

## G10 — shapefile node bbox (1 case)

**Follow-on bucket:** `shapefile-node`

Port shapefile shape handling: emit a rectangular polygon bounding box when
`shapefile=` is set, instead of falling back to ellipse.

| Case | Corpus path |
|------|-------------|
| [graphs-user_shapes](graphs-user_shapes.md) | `graphs/user_shapes.gv` |
