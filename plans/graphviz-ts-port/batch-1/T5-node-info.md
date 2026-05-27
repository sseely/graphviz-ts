# T5 — NodeInfo Interface

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC. T5
ports `Agnodeinfo_t` from `lib/common/types.h` — the struct that all ND_*
macro accessors read and write. Two fields require special treatment documented
below: `rank` (dual-use) and `alg` (discriminated union per engine).

## Task

Create `src/model/nodeInfo.ts` with a `NodeInfo` interface whose fields
correspond 1-to-1 with `Agnodeinfo_t` (minus `Agrec_t hdr`). Stub per-engine
`alg` variant types as empty interfaces with a `kind` discriminant. Add a
factory function `makeNodeInfo()`. The dual-use `rank` field must carry the
exact JSDoc specified in the Interface Contracts section.

## Write-Set

```
src/model/nodeInfo.ts
```

## Read-Set

- `~/git/graphviz/lib/common/types.h` — `Agnodeinfo_t` struct (lines 410–481)
  and full ND_* macro list (lines 483–538)
- `~/git/graphviz/docs/architecture/lib/common.md` — Agnodeinfo_t table and
  ND_* list
- `~/git/graphviz/docs/architecture/typescript-port.md` — Layer 2 NodeInfo
  mapping
- `~/git/graphviz/docs/architecture/typescript-port.md` — AD-7 and AD-8
  descriptions

## Architecture Decisions

- AD-1: agbindrec/GD_*/ND_*/ED_* → typed fields. The `hdr Agrec_t` is dropped.
- AD-7: ND_alg per-engine via discriminated union. Each engine's batch (8–10)
  will replace the stub `*AlgData` interfaces with concrete types. Until then
  they are empty interfaces with a `kind` literal. Never use `unknown` casting.
- AD-8: ND_rank dual-use — see critical JSDoc below.

## Interface Contracts

```typescript
import type { Point, Box, Port } from './geom.js';
import type { Edge, Graph } from './index.js';

// Stub alg types — concrete fields added by each engine's batch.
// The `kind` discriminant is the ONLY required field in each stub.
export interface DotAlgData     { readonly kind: 'dot' }
export interface NeatoAlgData   { readonly kind: 'neato' }
export interface FdpAlgData     { readonly kind: 'fdp' }
export interface CircoAlgData   { readonly kind: 'circo' }
export interface TwopiAlgData   { readonly kind: 'twopi' }
export interface OsageAlgData   { readonly kind: 'osage' }
export interface PatchworkAlgData { readonly kind: 'patchwork' }

export type NodeAlgData =
  | DotAlgData
  | NeatoAlgData
  | FdpAlgData
  | CircoAlgData
  | TwopiAlgData
  | OsageAlgData
  | PatchworkAlgData;

export interface NodeInfo {
  // === Always-present rendering fields ===
  coord: Point;           // ND_coord — final layout coordinate (node center)
  width: number;          // ND_width — node width in inches
  height: number;         // ND_height — node height in inches
  bb: Box;                // ND_bb — bounding box
  ht: number;             // ND_ht — total height in points
  lw: number;             // ND_lw — left half-width in points
  rw: number;             // ND_rw — right half-width in points
  outline_width: number;  // ND_outline_width — width including penwidth
  outline_height: number; // ND_outline_height — height including penwidth
  state: number;          // ND_state — layout state char
  gui_state: number;      // ND_gui_state — GUI state flags
  clustnode: boolean;     // ND_clustnode — true if node represents a cluster

  // === Labels (typed in Batch 5b) ===
  label?: unknown;        // ND_label — textlabel_t*
  xlabel?: unknown;       // ND_xlabel — textlabel_t*

  // === Shape (typed in Batch 4/5) ===
  shape?: unknown;        // ND_shape — shape_desc*
  shape_info?: unknown;   // ND_shape_info — polygon_t* or field_t*

  // === dot-specific fields ===
  /**
   * During the dot rank-assignment phase this field holds the assigned rank
   * (integer row in the layered graph).
   *
   * DUAL-USE WARNING: During the dot position phase (x-coordinate assignment),
   * `rank` is REPURPOSED as the x-coordinate by network simplex. Do not read
   * this field as a rank value while the position phase is active. The field
   * is restored to its rank value by `set_xcoords` at the end of the position
   * phase. See lib/dotgen/position.c and AD-8.
   */
  rank?: number;          // ND_rank — see dual-use warning above
  order?: number;         // ND_order
  mval?: number;          // ND_mval
  node_type?: number;     // ND_node_type — NORMAL/VIRTUAL/SLACKNODE
  ranktype?: number;      // ND_ranktype
  weight_class?: number;  // ND_weight_class
  mark?: number;          // ND_mark — size_t in C; used by acyclic DFS
  onstack?: number;       // ND_onstack — char in C
  has_port?: boolean;     // ND_has_port
  showboxes?: number;     // ND_showboxes

  // Edge lists (dot layout)
  in?: { list: Edge[]; size: number };       // ND_in
  out?: { list: Edge[]; size: number };      // ND_out
  flat_in?: { list: Edge[]; size: number };  // ND_flat_in
  flat_out?: { list: Edge[]; size: number }; // ND_flat_out
  other?: { list: Edge[]; size: number };    // ND_other
  save_in?: { list: Edge[]; size: number };  // ND_save_in
  save_out?: { list: Edge[]; size: number }; // ND_save_out
  tree_in?: { list: Edge[]; size: number };  // ND_tree_in
  tree_out?: { list: Edge[]; size: number }; // ND_tree_out

  // Linked-list links for dot nlist traversal
  next?: import('./index.js').Node;   // ND_next
  prev?: import('./index.js').Node;   // ND_prev

  // Network simplex
  par?: Edge;             // ND_par — tree parent edge
  low?: number;           // ND_low
  lim?: number;           // ND_lim
  priority?: number;      // ND_priority

  // Union-find
  UF_size?: number;       // ND_UF_size
  UF_parent?: import('./index.js').Node; // ND_UF_parent
  rep?: import('./index.js').Node;       // ND_rep
  set?: import('./index.js').Node;       // ND_set
  clust?: Graph;          // ND_clust — cluster subgraph

  // === neato/fdp-specific fields ===
  pinned?: boolean;       // ND_pinned — unsigned char in C; treat as boolean
  id?: number;            // ND_id — neato integer node id
  heapindex?: number;     // ND_heapindex
  hops?: number;          // ND_hops
  pos?: number[];         // ND_pos — ndim-dimensional position array
  dist?: number;          // ND_dist

  // === Engine algorithm scratch data (AD-7) ===
  alg?: NodeAlgData;      // ND_alg — discriminated union; never use unknown
}
```

### Factory function

```typescript
export function makeNodeInfo(): NodeInfo;
```

The factory must initialize all required (non-optional) fields to zero/false
values: `coord = {x:0, y:0}`, `width = 0`, `height = 0`, `bb = {ll:{x:0,y:0}, ur:{x:0,y:0}}`,
`ht = 0`, `lw = 0`, `rw = 0`, `outline_width = 0`, `outline_height = 0`,
`state = 0`, `gui_state = 0`, `clustnode = false`.

## Critical JSDoc Requirement

The `rank` field MUST carry the dual-use JSDoc comment shown above verbatim
(or equivalent wording that communicates the same semantic). This comment is
required by AD-8. An implementation missing this comment fails the quality bar.

## Acceptance Criteria

- Given `makeNodeInfo()`, when `coord`, `width`, `height`, `bb`, `ht`, `lw`,
  `rw`, `outline_width`, `outline_height`, `state`, `gui_state`, and
  `clustnode` are inspected, then they have zero/false values (not undefined).
- Given `NodeInfo.rank`, when the JSDoc is read, then it mentions the position
  phase repurposing and the `set_xcoords` restore point.
- Given `NodeInfo.alg`, when TypeScript checks its type, then it is the
  `NodeAlgData` discriminated union and each member has a `kind` literal
  discriminant.
- Given all ND_* fields in `lib/common/types.h` Agnodeinfo_t, when compared
  to `NodeInfo`, then every field is present (either required or optional).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for this module
- One commit: `feat(model): add NodeInfo interface`
