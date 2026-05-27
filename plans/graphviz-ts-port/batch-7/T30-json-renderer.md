# T30 — JSON Renderer

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC.

T30 ports `plugin/core/gvrender_core_json.c`. The JSON renderer outputs the
graph structure and layout positions as JSON. It handles four format IDs:

```c
enum {
  FORMAT_JSON,
  FORMAT_JSON0,
  FORMAT_DOT_JSON,
  FORMAT_XDOT_JSON,
};
```

TypeScript scope (AD-12): implement `FORMAT_JSON` and `FORMAT_JSON0`. The
`FORMAT_DOT_JSON` and `FORMAT_XDOT_JSON` variants are out of scope.

### Format differences: JSON vs JSON0

`FORMAT_JSON` uses `gvCloneGVC` and re-renders the graph to embed XDOT draw
attributes for each element. `FORMAT_JSON0` is the simpler variant: it outputs
position and attribute data only, without xdot drawing operations.

The C code for `FORMAT_JSON` (line 59):
```c
if (job->render.id == FORMAT_JSON) {
  GVC_t* gvc = gvCloneGVC(job->gvc);
  ...
}
```

`gvCloneGVC` creates a shallow clone of the context for a parallel render.
In the TypeScript port, `FORMAT_JSON` should produce `json0` output plus an
additional `"_draw_"` array on each node and edge containing the xdot draw
operations. See the C source for the exact JSON structure.

### JSON output structure

```json
{
  "name": "<graph name>",
  "directed": true,
  "strict": false,
  "bb": "0,0,<w>,<h>",
  "_subgraph_cnt": 0,
  "objects": [
    {
      "_gvid": 0,
      "name": "A",
      "pos": "x,y",
      "width": "w",
      "height": "h",
      ...node attrs...
    }
  ],
  "edges": [
    {
      "_gvid": 0,
      "tail": 0,
      "head": 1,
      "pos": "e,x,y x1,y1 ...",
      ...edge attrs...
    }
  ]
}
```

Numeric IDs (`_gvid`) are zero-based sequential integers assigned during the
render pass, matching the `gvid_t` record attached to each graph object in the
C source (`ND_gid`, `ED_gid`, `GD_gid` macros at lines 53–55).

Node `pos` uses `printNum` format (same as DOT renderer: 3 decimals, leading
`0.` → `.`). `width` and `height` are in inches (divide points by 72), also
using `printNum`.

### Indentation

The C source tracks an indentation `Level` in `state_t`. Each nesting level
adds two spaces. TypeScript should use `JSON.stringify(obj, null, 2)` as the
output mechanism, or replicate the C indentation manually — whichever produces
byte-identical output for the test cases. Read the C source to determine exact
indentation depth at each nesting level.

### Latin-1 encoding

The C `state_t` has an `isLatin` field. When true, the renderer escapes
non-ASCII characters differently. The TypeScript port may assume UTF-8
throughout (matching Node.js and browser environments); emit `isLatin = false`
behavior.

## Task

1. Read `~/git/graphviz/plugin/core/gvrender_core_json.c` in full before
   writing any code. Pay particular attention to:
   - `json_begin_graph` / `json_end_graph` — overall JSON envelope.
   - `json_begin_node` / `json_end_node` — node object structure.
   - `json_begin_edge` / `json_end_edge` — edge object, tail/head indices.
   - The `gvid_t` record and `ND_gid`/`ED_gid` access macros.
   - The `Level` indentation counter.
   - `json_comment` — how comments are handled (dropped in JSON).

2. Implement `JsonRenderer` class implementing `RendererPlugin` with
   `type = "json"` and `quality = 0`.

3. Implement `Json0Renderer` class implementing `RendererPlugin` with
   `type = "json0"` and `quality = 0`.

   Both may share a base class or helper. The distinction:
   - `Json0Renderer`: position data only, no draw ops.
   - `JsonRenderer`: position data plus `"_draw_"` arrays.

4. Assign `_gvid` values starting at 0 for nodes, incrementing per node
   in the order visited. Edges have a separate `_gvid` counter starting at 0.
   Store the assigned IDs in per-render state (not on the graph objects
   themselves, as the graph objects are shared and reads of T25's `GvcContext`
   may run concurrently in tests).

5. Edge `tail` and `head` fields are `_gvid` values of the tail and head nodes
   respectively, not node names.

6. Export factory functions:

   ```typescript
   export function createJsonRenderer(): RendererPlugin;
   export function createJson0Renderer(): RendererPlugin;
   ```

7. Tests in `src/render/json.test.ts`:
   - Given a laid-out graph, when JSON-rendered, then `JSON.parse(output)`
     succeeds (output is valid JSON).
   - Given a graph with two nodes `A` and `B` and one edge `A->B`, when
     JSON0-rendered, then `output.objects[0].pos` is a string, `output.edges[0].tail`
     is `0`, and `output.edges[0].head` is `1`.
   - Given a graph with a node, when JSON0-rendered, then `output.objects[0]`
     has a `pos` key with a string value in `"x,y"` format.
   - Given a graph with a node, when JSON-rendered, then `output.objects[0]`
     has a `_draw_` key (xdot draw operations present).

## Write-Set

```
src/render/json.ts
src/render/json.test.ts
```

## Read-Set

- `~/git/graphviz/plugin/core/gvrender_core_json.c` (full)
- `src/gvc/context.ts` — `RendererPlugin`
- `src/gvc/job.ts` — `RenderJob`, `ObjState`
- `src/render/dot.ts` — `printNum` (shared helper; import from dot.ts)
- `src/model/index.ts` — `Graph`, `Node`, `Edge`

## Architecture Decisions

**AD-2** — Static registration. Register via `ctx.register(new JsonRenderer())`
and `ctx.register(new Json0Renderer())`.

**AD-12** — `FORMAT_JSON` and `FORMAT_JSON0` are in scope.
`FORMAT_DOT_JSON` and `FORMAT_XDOT_JSON` are out of scope; throw
`Error("not implemented: dot_json")` etc. if invoked.

## Interface Contracts

```typescript
// src/render/json.ts
export class JsonRenderer implements RendererPlugin {
  readonly type: "json";
  readonly quality: 0;
}

export class Json0Renderer implements RendererPlugin {
  readonly type: "json0";
  readonly quality: 0;
}

export function createJsonRenderer(): RendererPlugin;
export function createJson0Renderer(): RendererPlugin;
```

## Acceptance Criteria

- Given a laid-out graph rendered to `"json"` format, then `JSON.parse(output)`
  succeeds without throwing.
- Given a graph with nodes, when JSON0-rendered, then `output.objects` is an
  array and each element has a `pos` field containing a string.
- Given a graph with edges, when JSON0-rendered, then `output.edges` is an
  array and each element has `tail` and `head` fields containing integers
  corresponding to node `_gvid` values.
- Given a graph with at least one node, when JSON-rendered (not JSON0), then
  at least one `objects` entry has a `"_draw_"` field.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes, no data migrations.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0; all tests in `json.test.ts` pass
- One commit: `feat(render): add JSON renderer`
