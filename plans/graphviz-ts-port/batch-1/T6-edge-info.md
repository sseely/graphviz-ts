# T6 — EdgeInfo Interface

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source in `~/git/graphviz/lib/` is THE SPEC. T6
ports `Agedgeinfo_t` from `lib/common/types.h` — the struct that all ED_*
macro accessors read and write. `spl` (the rendered spline geometry) is the
most layout-critical field; it is `undefined` before the spline routing phase
runs and must never be accessed before that point.

## Task

Create `src/model/edgeInfo.ts` with an `EdgeInfo` interface whose fields
correspond 1-to-1 with `Agedgeinfo_t` (minus `Agrec_t hdr`). Add a factory
function `makeEdgeInfo(tailPort: Port, headPort: Port): EdgeInfo`. Both port
arguments are required at construction time because `tail_port` and `head_port`
are always initialized when an edge is created.

## Write-Set

```
src/model/edgeInfo.ts
```

## Read-Set

- `~/git/graphviz/lib/common/types.h` — `Agedgeinfo_t` struct (lines 543–576)
  and ED_* macro list (lines 578–603). Read the actual struct definition, not
  just the macro list.
- `~/git/graphviz/docs/architecture/lib/common.md` — Agedgeinfo_t table and
  ED_* list
- `~/git/graphviz/docs/architecture/typescript-port.md` — Layer 2 EdgeInfo
  mapping

## Architecture Decisions

- AD-1: agbindrec/GD_*/ND_*/ED_* → typed fields. The `hdr Agrec_t` is dropped.

## Interface Contracts

```typescript
import type { Port, Spline } from './geom.js';
import type { Edge } from './index.js';

export interface EdgeInfo {
  // === Port specification (always present — initialized at edge creation) ===
  tail_port: Port;       // ED_tail_port — tail-end port
  head_port: Port;       // ED_head_port — head-end port

  // === Spline geometry ===
  /**
   * Rendered spline geometry. Undefined before the spline routing phase.
   * Set by clip_and_install() in lib/common/splines.c. Do not read before
   * the layout engine's spline pass has completed.
   */
  spl?: Spline;          // ED_spl — splines* in C; null = not yet routed

  // === Labels (typed in Batch 5b) ===
  label?: unknown;       // ED_label — textlabel_t*
  head_label?: unknown;  // ED_head_label — textlabel_t*
  tail_label?: unknown;  // ED_tail_label — textlabel_t*
  xlabel?: unknown;      // ED_xlabel — textlabel_t*

  // === Edge metadata ===
  edge_type?: number;    // ED_edge_type — REGULAREDGE/FLATEDGE/SELFEDGE char
  compound?: number;     // ED_compound — char in C; true for compound edges
  adjacent?: number;     // ED_adjacent — char; true for flat edge adj nodes
  label_ontop?: number;  // ED_label_ontop — char
  gui_state?: number;    // ED_gui_state — unsigned char

  // === Virtual edge back-pointers ===
  to_orig?: Edge;        // ED_to_orig — back-pointer to original (for virtual edges)
  to_virt?: Edge;        // ED_to_virt — forward pointer to virtual edge

  // === dot-specific fields ===
  /**
   * Edge weight. In dot layout, the weight attribute controls how tightly
   * the edge is pulled toward its ideal length. Default is 1.
   * C type: int (in Agedgeinfo_t, accessed via ED_weight).
   */
  weight?: number;       // ED_weight — int in C

  /**
   * Minimum edge length in ranks. dot uses this to enforce rank separation.
   * C type: int (in Agedgeinfo_t, accessed via ED_minlen).
   */
  minlen?: number;       // ED_minlen — int in C
  cutvalue?: number;     // ED_cutvalue — network simplex cut value
  tree_index?: number;   // ED_tree_index
  xpenalty?: number;     // ED_xpenalty — short in C
  count?: number;        // ED_count — short in C
  conc_opp_flag?: boolean; // ED_conc_opp_flag
  showboxes?: number;    // ED_showboxes

  // === neato-specific fields ===
  /**
   * Spring factor for neato stress majorization.
   * C type: double, accessed via ED_factor.
   */
  factor?: number;       // ED_factor

  /**
   * Ideal distance for neato/fdp layout.
   * C type: double, accessed via ED_dist.
   */
  dist?: number;         // ED_dist

  // Path used during routing (neato/fdp)
  path?: unknown;        // ED_path — Ppolyline_t in C; typed in Batch 4

  // === Engine algorithm scratch data ===
  alg?: unknown;         // ED_alg — engine-specific pointer
}
```

### Factory function

```typescript
// Both ports are required. tail_port and head_port are always set when an
// edge is created — they are never null in the C model.
export function makeEdgeInfo(tailPort: Port, headPort: Port): EdgeInfo;
```

The factory must set `tail_port` and `head_port` from the arguments and leave
all other fields as `undefined`. No default port values are assumed.

### Default port factory

```typescript
// Returns an unset port (defined=false, constrained=false, clip=false,
// dyna=false). Matches the zero-initialized port in C.
export function makePort(): Port;
```

## Acceptance Criteria

- Given `makeEdgeInfo(makePort(), makePort())`, when `spl` is inspected, then
  it is `undefined` (not yet routed).
- Given `EdgeInfo`, when `weight` is accessed, then it is typed as
  `number | undefined` (optional — not all edges have explicit weight).
- Given `EdgeInfo`, when `minlen` is accessed, then it is typed as
  `number | undefined`.
- Given `EdgeInfo`, when `tail_port` and `head_port` are accessed, then both
  are typed as `Port` (required, not optional).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only changes.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for this module
- One commit: `feat(model): add EdgeInfo interface`
