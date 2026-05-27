# T45 — neato Init and Entry Point

## Context

`lib/neatogen/neatoinit.c` (1453 lines) is the top-level orchestrator for the
neato layout engine. It handles:

1. **Graph initialization**: Allocating `ND_pos` arrays (`neato_init_node`),
   parsing node `pos` and `pin` attributes (`user_pos`), computing node sizes.

2. **Seed handling**: Parsing the `start` graph attribute into a random seed
   stored in `GD_seed(g)`. The TypeScript equivalent is `g.info.seed`. The
   `setSeed` function accepts `start=<value>` or `start=random` or
   `start=self` (rejected — INIT_SELF is invalid for neato).

3. **Mode dispatch** (`solve_model`):
   - `MODE_KK` → `stressMajorizationKD` (from T41) with `maxi=0` and KK
     initialization
   - `MODE_MAJOR` → `stressMajorizationKD` (full stress majorization)
   - `MODE_SGD` → `sgdLayout` (from T42)
   - `MODE_HIER` → DiG-CoLa (hierarchy-constrained, from T41)
   - `MODE_IPSEP` → IPSep-CoLa (from T41 / T43)

4. **Default mode**: `MODE_MAJOR` (stress majorization) when no `mode`
   attribute is set.

5. **Connected component handling**: The C `neato_layout` splits the graph
   into connected components via `lib/pack`, lays each component out
   independently, then packs them back together. The TypeScript port must
   replicate this: `ccomps` → per-component layout → `packSubgraphs`.

6. **`user_pos`**: Reads the `pos` attribute from each node. Coordinates
   are in inches divided by `PSinputscale` (default 72 points/inch) when
   `PSinputscale > 0`. Fixed/pinned nodes set `NodeInfo.pinned`.

7. **`neato_translate`**: After layout, shift all node positions so the
   lower-left corner is at the origin. Adjusts `ND_pos` (inches) and
   `ED_spl` (points) and cluster bounding boxes.

8. **`neato_set_aspect`**: Copies `ND_pos` → `ND_coord` (converting inches
   to points: multiply by `POINTS_PER_INCH = 72`). Applies ratio/size
   constraints if the `ratio` or `size` graph attributes are set.

**Attribute parsing:**

The `mode` graph attribute accepts string values: `"KK"`, `"major"`,
`"hier"`, `"ipsep"`, `"sgd"`. The default is `"major"` (MODE_MAJOR).

The `model` graph attribute accepts: `"shortpath"` (default), `"circuit"`,
`"subset"`, `"mds"`. The default is `"shortpath"` (MODEL_SHORTPATH).

The `overlap` graph attribute is passed to overlap removal after layout.

The `epsilon` attribute sets the outer stress convergence tolerance
(DFLT_TOLERANCE = 1e-4 is the default).

The `maxiter` attribute sets max outer iterations (DFLT_ITERATIONS = 200).

## Task

Port `lib/neatogen/neatoinit.c` to TypeScript. This task wires all Batch 9
parallel tasks (T40–T44) into a complete layout engine.

1. **`init.ts`**: `neatoInitNode`, `userPos`, `setSeed`, `solveModel`,
   `neatoTranslate`, `neatoSetAspect`.

2. **`index.ts`**: `neatoLayout(g, ctx)` — the public entry point. Registers
   the "neato" engine. Calls: `neatoInitNodeEdge` → per-component
   `solveModel` → `splineEdges` → `dotneato_postprocess`.

## Write-Set

- `src/layout/neato/init.ts`
- `src/layout/neato/index.ts`
- `src/layout/neato/neato.test.ts`

## Read-Set

- `~/git/graphviz/lib/neatogen/neatoinit.c` — full 1453-line file:
  `neato_init_node`, `user_pos`, `setSeed`, `solve_model` dispatch,
  `neato_layout`, `neato_translate`, `neato_set_aspect`
- `~/git/graphviz/docs/architecture/lib/neatogen.md` — `neatoinit.c` section

## Architecture Decisions

- **AD-1**: `GD_seed(g)` → `g.info.seed`; `GD_neato_nlist` → `g.info.neatoNlist`;
  `ND_pos` → `n.info.pos`; `ND_coord` → `n.info.coord`.
- **AD-2**: Engine registered directly as a static entry, not via dlopen.

## Interface Contracts

```typescript
// src/layout/neato/index.ts

/** Public entry point. Registered as the "neato" layout engine. */
export function neatoLayout(
  g: import('../../model/Graph').Graph,
  ctx: import('../../gvc/context').GvcContext,
): void;

// src/layout/neato/init.ts

export const MODE_KK = 0;
export const MODE_MAJOR = 1;
export const MODE_HIER = 2;
export const MODE_IPSEP = 3;
export const MODE_SGD = 4;

export const MODEL_SHORTPATH = 0;
export const MODEL_CIRCUIT = 1;
export const MODEL_SUBSET = 2;
export const MODEL_MDS = 3;

export function solveModel(
  g: import('../../model/Graph').Graph,
  mode: number,
): void;

export function setSeed(
  g: import('../../model/Graph').Graph,
  defaultMode: number,
  seed: { value: number },
): number;
```

## Acceptance Criteria

1. Default mode is `MODE_MAJOR` (stress majorization) when no `mode`
   attribute is present in the graph.

2. `mode=sgd` attribute causes `solveModel` to call `sgdLayout` (from T42).

3. The `start` attribute value is parsed and stored in `g.info.seed` before
   `solveModel` is called — SGD and stress majorization both read seed from
   there.

4. The engine is registered under the string key `"neato"` in the layout
   engine registry.

## Observability

N/A — layout functions; no external I/O.

## Rollback

Reversible. Writes only new files under `src/layout/neato/`. Revert by
removing the files.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/layout/neato/neato.test.ts` exits 0
- One commit: `feat(neato): port neatoinit and wire neato layout engine`
- Tests cover: mode constant values (`MODE_MAJOR === 1`, `MODE_SGD === 4`);
  `setSeed` with `start=42` sets `g.info.seed === 42`; engine lookup by
  name `"neato"` resolves to `neatoLayout`; end-to-end layout on a 3-node
  triangle graph produces non-zero positions.
