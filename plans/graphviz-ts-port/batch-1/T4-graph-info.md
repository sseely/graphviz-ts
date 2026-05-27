# T4 — GraphInfo Interface

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC. T4
ports `Agraphinfo_t` from `lib/common/types.h` — the struct that all GD_* macro
accessors read from and write to. All engine-specific fields are optional so
that one interface serves all layout engines.

## Task

Create `src/model/graphInfo.ts` with a `GraphInfo` interface whose fields
correspond 1-to-1 with the fields of `Agraphinfo_t` (minus the `Agrec_t hdr`
record header, which is eliminated per AD-1). All optional fields are
`undefined` when a fresh `GraphInfo` is constructed.

## Write-Set

```
src/model/graphInfo.ts
```

## Read-Set

- `~/git/graphviz/lib/common/types.h` — `Agraphinfo_t` struct (lines 278–349)
  and GD_* macro list. Read the actual struct field names and types, not just
  the macro list.
- `~/git/graphviz/docs/architecture/lib/common.md` — Agraphinfo_t table
- `~/git/graphviz/docs/architecture/typescript-port.md` — Layer 2 GraphInfo
  mapping

## Architecture Decisions

- AD-1: agbindrec/GD_*/ND_*/ED_* → typed fields. The `hdr Agrec_t` field is
  dropped. All remaining fields become plain typed properties.
- AD-2: Plugin system → direct dispatch. The `GVC_t *gvc` field becomes
  `gvc: GVContext | null` where `GVContext` is a forward-declared type stub
  (import from `src/gvc/types.ts` which does not exist yet — declare
  `export type GVContext = unknown` as a placeholder).

## Interface Contracts

The interface must be exported as `GraphInfo` from `src/model/graphInfo.ts`.
All fields that are pointers in C become optional (`| undefined`) in TypeScript.
Required (non-pointer, always-present) fields: `bb`, `rankdir`, `flags`,
`charset`, `gui_state`, `has_labels`, `has_images`.

### Minimum required shape

```typescript
import type { Box, Point, Node, Edge, Graph } from './index.js';

// Forward stub for GVC context — replaced in Batch 6
export type GVContext = unknown;

// From lib/common/types.h: typedef struct layout_t
export interface LayoutParams {
  quantum: number;
  scale: number;
  ratio: number;
  dpi: number;
  margin: Point;
  page: Point;
  size: Point;
  filled: boolean;
  landscape: boolean;
  centered: boolean;
  ratioKind: 'none' | 'value' | 'fill' | 'compress' | 'auto' | 'expand';
  xdots: unknown | null;
  id: string | null;
}

// From lib/common/types.h: typedef struct rank_t
export interface RankEntry {
  n: number;
  v: Node[];
  an: number;
  av: Node[];
  ht1: number;
  ht2: number;
  pht1: number;
  pht2: number;
  candidate: boolean;
  valid: boolean;
  cache_nc: number;    // C: int64_t — JavaScript number is safe up to 2^53
}

export type RankTable = RankEntry[];

export interface GraphInfo {
  // === Always-present rendering fields ===
  bb: Box;                          // GD_bb — bounding box
  rankdir: number;                  // GD_rankdir2 — raw rankdir int from C
  flags: number;                    // GD_flags — edge type and other flags
  charset: number;                  // GD_charset — input character set
  gui_state: number;                // GD_gui_state — GUI state flags
  has_labels: number;               // GD_has_labels — bitmask
  has_images: boolean;              // GD_has_images

  // === Optional rendering fields ===
  drawing?: LayoutParams;           // GD_drawing
  label?: unknown;                  // GD_label — textlabel_t; typed in Batch 5b
  border?: [Point, Point, Point, Point]; // GD_border — pointf[4]
  gvc?: GVContext;                  // GD_gvc — context; typed in Batch 6
  cleanup?: ((g: Graph) => void);   // GD_cleanup — engine teardown callback

  // === dot-specific fields ===
  nlist?: Node;                     // GD_nlist — head of linked node list
  rank?: RankTable;                 // GD_rank
  n_cluster?: number;               // GD_n_cluster
  clust?: Graph[];                  // GD_clust — clust[1..n_cluster] (1-indexed in C)
  dotroot?: Graph;                  // GD_dotroot
  parent?: Graph;                   // GD_parent — containing cluster
  level?: number;                   // GD_level — cluster nesting level
  minrank?: number;                 // GD_minrank
  maxrank?: number;                 // GD_maxrank
  minset?: Node;                    // GD_minset — set leader
  maxset?: Node;                    // GD_maxset — set leader
  minrep?: Node;                    // GD_minrep
  maxrep?: Node;                    // GD_maxrep
  leader?: Node;                    // GD_leader
  rankleader?: Node[];              // GD_rankleader
  expanded?: boolean;               // GD_expanded
  installed?: number;               // GD_installed — char in C
  set_type?: number;                // GD_set_type
  label_pos?: number;               // GD_label_pos
  exact_ranksep?: boolean;          // GD_exact_ranksep
  has_flat_edges?: boolean;         // GD_has_flat_edges
  showboxes?: number;               // GD_showboxes
  fontnames?: 'native' | 'ps' | 'svg'; // GD_fontnames — fontname_kind enum
  nodesep?: number;                 // GD_nodesep — in points
  ranksep?: number;                 // GD_ranksep — in points
  ln?: Node;                        // GD_ln — left node of bounding box
  rn?: Node;                        // GD_rn — right node of bounding box
  ht1?: number;                     // GD_ht1
  ht2?: number;                     // GD_ht2
  comp?: { list: Node[]; size: number }; // GD_comp — nlist_t fast graph

  // === neato/fdp/sfdp-specific fields ===
  neato_nlist?: Node[];             // GD_neato_nlist
  move?: number;                    // GD_move
  dist?: number[][];                // GD_dist — all-pairs distance matrix
  spring?: number[][];              // GD_spring — spring constants matrix
  sum_t?: number[][];               // GD_sum_t
  t?: number[][][];                 // GD_t
  ndim?: number;                    // GD_ndim — number of layout dimensions
  odim?: number;                    // GD_odim

  // === Engine algorithm scratch data ===
  alg?: unknown;                    // GD_alg — engine-specific; typed per engine
}
```

### Factory function

```typescript
// Returns a GraphInfo with all required fields at their zero values
export function makeGraphInfo(): GraphInfo;
```

## Acceptance Criteria

- Given `makeGraphInfo()`, when all optional fields are inspected, then they
  are each `undefined` (no default values are assigned to optional fields).
- Given a `GraphInfo`, when `bb` is accessed, then it is typed as `Box`.
- Given a `GraphInfo`, when `clust` is accessed, then it is typed as
  `Graph[] | undefined` (the 1-indexed C convention is noted in a JSDoc comment
  on the field, but the TypeScript array is 0-indexed — the caller is
  responsible for the offset).
- Given `GraphInfo`, when `tsc --noEmit` is run, then no errors are reported
  for any field in the interface.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for this module
- One commit: `feat(model): add GraphInfo interface`
