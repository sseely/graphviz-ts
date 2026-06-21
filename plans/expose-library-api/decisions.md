# Architecture Decisions

All accepted by the user during planning (2026-06-21).

## ADR-1: Thin facade — no internal-class leakage

**Context:** A facade wrapping every node/edge in a handle is heavy and re-exposes
internal detail.
**Decision:** The public "graph handle" is the existing internal `Graph` object,
treated as opaque by consumers. Construction goes through a small builder;
inspection/geometry return plain data. The mutable internal `Graph`/`Node`/`Edge`
classes are **not** re-exported.
**Consequences:** Thinnest layer, least code. Consumers never touch
`Node.info`/`Map` internals.

## ADR-2: Two subpath entries + discoverable root

**Decision:** `graphviz-ts/api` (build, inspect, geometry) and `graphviz-ts/render`
(output formats, xdot ops). Root `graphviz-ts` re-exports both plus today's
`renderSvg`/`parse`.
**Consequences:** Adds a `package.json` `"exports"` map and per-entry build
outputs. The existing `"."` → `dist/index.js` import MUST stay intact.

## ADR-3: Geometry readout is a materialized snapshot

**Decision:** `getLayout(graph, opts)` returns plain JSON-serializable data
(`{ bounds, nodes[], edges[] }`) after layout — not lazy getters over the live
graph.
**Consequences:** Simplest, serializable, decoupled from internal mutation.

## ADR-4: Coordinate system is an option; default screen y-down

**Decision:** `opts.yAxis: 'down' | 'up'`, default `'down'`. Native graphviz is
y-up, origin lower-left; we flip by default using the graph bbox height — nodes,
edge splines, and label positions all flipped consistently.
**Consequences:** Consumers get screen-ready coords by default; `'up'` returns
native `ND_coord`-equivalent values.

## ADR-5: One `render(graph, format, opts?)` with a string-union type

**Decision:** `OutputFormat = 'svg'|'dot'|'xdot'|'json'|'plain'|'plain-ext'|'imap'
|'cmapx'`. The default context registers all existing renderers (today only SVG
is wired in).
**Consequences:** Every already-built renderer becomes reachable through one call.

## ADR-6: Programmatic construction in scope; typed node/edge handles

**Decision:** Builder `createGraph({ directed, strict, name })` with
`addNode/addEdge/addSubgraph/setAttr/getAttr`. Lightweight public `GvNode`/`GvEdge`
handle types are returned by the builder so `addEdge(a, b)` is type-safe (not
stringly-typed); handles carry identity + `setAttr`/`getAttr` and wrap the
internal ref WITHOUT re-exposing the internal mutable class (consistent with
ADR-1). Requires a safe `addEdge` porting `parser/builder.ts` insertion (dual-list,
strict-dedup, subgraph membership) — the one internal correctness fix.

## ADR-7: `pack` and `pathplan` deferred to a follow-on

**Decision:** Excluded from this mission (consistent with the gvpr exclusion and
the dot-centric consumer plantuml-js). Task T11 scaffolds the follow-on
mission brief so `/plan-mission` can complete it later.

## ADR-8: Attribute access is idiomatic string get/set

**Decision:** `getAttr`/`setAttr` + attr records in the builder. Typed
numbers/geometry come from the snapshot (ADR-3), not from coercing attribute
strings. Left as-is per user.

## Rollback classification

**Reversible.** All work is additive exports + one internal helper. Revert the
commits. Sole risk vector: the `exports` map; covered by an entry-import smoke
test in T9.
