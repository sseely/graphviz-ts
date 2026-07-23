# Glossary

One definition per term, alphabetized. Each links to the guide page (or the
source) that covers it in depth.

## Cluster

A subgraph whose name starts with `cluster` (e.g. `subgraph cluster_build`) —
Graphviz renders it as a distinct box grouping its member nodes. Internally,
@knowvah/dot-engine's geometry snapshot re-keys every cluster subgraph to a
positional name like `cluster6` (`ClusterGeometry.name`), not the DOT source
name, so a consumer that needs the original name builds an `idByName` map
before layout and re-keys `snapshot.clusters` afterward. See
[Recipes](/guide/recipes) for the re-key pattern and
[Build a graph](/guide/build-a-graph) for creating clusters via `addSubgraph`.

## Conformance

The mechanically-checked property behind the claim that a @knowvah/dot-engine render
"matches" the C oracle. After both SVGs are parsed into normalized element
trees, every numeric value (coordinates, path data, `points`) must agree
within a fixed tolerance — **±0.01pt** for the deterministic engines
(`dot`, `circo`, `twopi`, `osage`, `patchwork`) and **±0.5pt** for the
iterative force-directed engines (`neato`, `fdp`, `sfdp`) — and every
non-numeric value (tags, colors, text) must be exactly equal. It is not a
claim of byte-for-byte SVG output. See [Conformance](/conformance).

## Coordinate frame / y-axis

Graphviz's native coordinate system is **y-up**, origin at the lower-left
corner; browsers and screens are **y-down**, origin at the upper-left.
`getLayout` defaults to `yAxis: 'down'` (flipping every y and normalizing
`bounds` to `(0, 0)`) and accepts `yAxis: 'up'` to return native graphviz
coordinates unchanged. xdot draw ops (from `getDrawOps`) are always in the
native y-up frame. See [Read computed geometry](/guide/geometry).

## Divergence

A difference between a @knowvah/dot-engine render and the oracle that has been
investigated, root-caused, and catalogued — as opposed to silently
tolerated. Catalogued divergences fall into one of three classes: accepted
deltas (deliberately not made conformant, e.g. cross-platform
floating-point non-determinism), a tracked long tail still being closed, and
explicit non-goals. An unlisted difference is treated as a defect, not
accepted behavior. See [Known divergences](/divergences).

## DOT

The graph description language — `digraph { ... }` / `graph { ... }` with
node, edge, and attribute statements — that @knowvah/dot-engine parses before
handing the result to a layout engine. See [Getting started](/guide/getting-started).

## Image sizer / resolver

The two injectable seams for external images (usershape nodes and `<IMG>`
HTML-label cells). An `ImageSizer` reports an image's natural width/height so
node sizing and label layout can proceed without loading pixel data; an
`ImageResolver` supplies the actual image bytes for embedding at render time.
See [Images](/guide/images).

## Layout engine

One of the eight layout algorithms @knowvah/dot-engine registers, selected by name
(`renderSvg(dot, engine)`): `dot` (hierarchical/layered), `neato`
(spring-model, Kamada–Kawai), `fdp` (force-directed), `sfdp` (multiscale
force-directed, for large graphs), `circo` (circular), `twopi` (radial),
`osage` (clustered), and `patchwork` (squarified treemap). See
[Layout engines](/guide/engines).

## Oracle

The native C Graphviz `dot` binary, built from the canonical C source, that
every @knowvah/dot-engine render is validated against. @knowvah/dot-engine spawns this
binary directly (never a WASM build) to avoid ABI drift between the
reference and the port. See [Conformance](/conformance) and
[Parity](/parity) for how oracle comparisons are run and reported.

## Rank / rankdir

In `dot`'s hierarchical layout, a **rank** is a layer of nodes placed at the
same depth in the drawing. `rankdir` sets the direction ranks flow in — the
default `TB` (top to bottom), or `LR`, `BT`, `RL` — set as a graph attribute
(`b.setAttr('rankdir', 'LR')`). See [Build a graph](/guide/build-a-graph).

## Spline / edge routing

The curved (Bézier) path an edge is drawn along, computed by routing code
that steers around node and cluster obstacles. @knowvah/dot-engine exposes the
routed control points as `EdgeGeometry.points` — an ordered array of
`{x, y}` points, in points — from `getLayout`. See
[Read computed geometry](/guide/geometry).

## Text measurer

The injectable seam (`TextMeasurer`) that reports label width/height so node
and edge-label sizing can proceed before layout. @knowvah/dot-engine resolves one
automatically per render — an explicit `setTextMeasurer` first, then the
browser's `<canvas>` if available, then the built-in deterministic
`EstimateTextMeasurer` in Node — or accepts a custom implementation. See
[Text measurement](/guide/text-measurement).

## Usershape

Graphviz's term for a node whose shape is an externally supplied image
(via the `image` attribute) rather than a drawn polygon or ellipse.
@knowvah/dot-engine resolves usershapes through the injectable image sizer/resolver
seam rather than reading files directly, keeping the library browser-safe.
See [Images](/guide/images).

## xdot

The extended DOT draw-op format: a structured stream of operations (set
fill/stroke color, set font, fill/stroke an ellipse or polygon, draw a
Bézier, draw text) describing exactly how a rendered graph should be
painted, in paint order. `getDrawOps` returns this stream as typed `XdotOp`
values for driving a custom renderer (canvas, WebGL, PDF) without parsing
SVG. See [Custom rendering with xdot draw-ops](/guide/xdot-drawops).
