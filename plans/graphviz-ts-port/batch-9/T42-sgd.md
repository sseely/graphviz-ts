# T42 — Stochastic Gradient Descent Layout

## Context

SGD layout is `MODE_SGD` in neato. The C implementation is `lib/neatogen/sgd.c`
using the Zheng, Pawar, Goodman 2019 algorithm. It replaces stress majorization
for large graphs where full APSP is expensive — SGD computes Dijkstra from
each node and works directly on `(i, j, d, w)` term pairs.

**CRITICAL — MT19937, not Math.random():**

The Fisher-Yates shuffle in `fisheryates_shuffle` uses `rk_interval` from
`randomkit.c` (the MT19937 PRNG ported in T7). The C code seeds with
`rk_seed(0, &rstate)` — this is noted in the C source as a TODO. The
TypeScript port reads the seed from `GraphInfo.seed` (the equivalent of
`GD_seed(g)`) which is set from the `start` graph attribute by neato init
(T45). `Math.random()` is absolutely forbidden in this file. The layout
must be reproducible: same seed → same positions, every run.

**SGD architecture decision:**

The source contains this comment:
> seed is hardcoded to 0 (`rk_seed(0, &rstate)`) — TODO comment in source.

The TypeScript port does NOT keep the hardcoded-0 behavior. Instead, it reads
`GraphInfo.seed` (set by the `start` attribute in T45). When no `start` attribute
is present, `GraphInfo.seed` is initialized to `0`, reproducing the C default.

**`graph_sgd` CSR structure:**

The SGD algorithm builds a compressed-sparse-row adjacency (`graph_sgd` in
C) from the full `Agraph_t`. This is separate from the `vtx_data` adjacency
used by the stress engine. The CSR structure stores source offsets, target
indices, and per-edge weights. Self-loops and double edges are explicitly
ignored in `extract_adjacency`.

**MODEL_CIRCUIT and MODEL_MDS:**

Per the C source, both MODEL_CIRCUIT and MODEL_MDS fall back to
MODEL_SHORTPATH with a warning. The TypeScript port must replicate this
fallback — do not silently support the unsupported models.

**Step size schedule:**

```
eta_max = 1 / w_min
eta_min = Epsilon / w_max       (Epsilon = DFLT_TOLERANCE = 1e-4)
lambda = log(eta_max / eta_min) / (MaxIter - 1)
eta(t) = eta_max * exp(-lambda * t)
mu(t) = min(eta(t) * w, 1)      // cap at 1
```

`MaxIter` is a fixed count — SGD always runs all iterations. It does not
early-exit based on convergence. `Epsilon` here is used as a step-size floor,
not an energy threshold — this is a non-obvious re-use of the same constant.

**Pinned nodes:**

Pinned (fixed) nodes are stored in a bitarray in C (`graph_sgd.pinneds`).
In TypeScript, use `NodeInfo.pinned` (from AD-1 typed fields). Fixed nodes
do not move — skip position updates for them in the inner loop.

## Task

Port `lib/neatogen/sgd.c` to TypeScript.

1. **`GraphSgd` interface**: TypeScript equivalent of `graph_sgd`. Stores
   CSR source offsets (`sources: number[]`), target indices (`targets:
   number[]`), per-edge weights (`weights: Float32Array`), and node count.
   Pinned status is not stored here — read from `NodeInfo.pinned`.

2. **`extractAdjacency`**: Build `GraphSgd` from a `Graph` object. Skip
   self-loops and double edges. For `MODEL_SUBSET`, compute degree-reweighted
   weights: `w_ij = deg_i + deg_j - 2 * |common_neighbors(i,j)|`.

3. **`dijkstraSgd`**: Dijkstra from a source node that writes `TermSgd`
   entries directly. This is declared in T40 (`dijkstra.ts`) but the
   `GraphSgd` input type is defined here. T40 imports the type.

4. **`fisheryatesShuffle`**: Fisher-Yates in-place shuffle of `TermSgd[]`
   using `rkInterval` from `src/util/mt19937.ts`. No `Math.random()`.

5. **`sgdLayout`**: Main entry point. Reads seed from `g.info.seed`.

## Write-Set

- `src/layout/neato/sgd.ts`
- `src/layout/neato/sgd.test.ts`

## Read-Set

- `~/git/graphviz/lib/neatogen/sgd.c` — full file: `extract_adjacency`,
  `fisheryates_shuffle`, `dijkstra_sgd`, main `sgd` function, step-size
  schedule, inner position update loop
- `~/git/graphviz/docs/architecture/lib/neatogen.md` — `sgd.c` section

## Architecture Decisions

- **AD-1**: `GD_seed(g)` → `g.info.seed` (typed field on `GraphInfo`).
  `GD_neato_nlist` → `g.info.neatoNlist`. `ND_pos` → `n.info.pos`.
- **AD-9**: Not directly relevant here, but the PRNG must be MT19937.

## Interface Contracts

```typescript
// src/layout/neato/sgd.ts

export interface GraphSgd {
  n: number;
  sources: number[];   // CSR row pointers, length n+1
  targets: number[];   // CSR column indices
  weights: Float32Array;
}

/**
 * Run SGD layout on graph g.
 * Reads seed from g.info.seed (set by neato init from 'start' attribute).
 * MODEL_CIRCUIT and MODEL_MDS fall back to MODEL_SHORTPATH with a warning.
 */
export function sgdLayout(
  g: import('../../model/Graph').Graph,
  model: number,
): void;
```

## Acceptance Criteria

1. With the same `GraphInfo.seed` value, `sgdLayout` produces identical node
   positions on repeated calls (deterministic).

2. `fisheryatesShuffle` uses `rkInterval` from `src/util/mt19937.ts` — no
   `Math.random()` calls anywhere in `sgd.ts`.

3. `g.info.seed` is read as the PRNG seed; the seed value `0` reproduces
   the C hardcoded default behavior.

## Observability

N/A — pure algorithmic function; no I/O.

## Rollback

Reversible. Writes only new files under `src/layout/neato/`. Revert by
removing the files.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/layout/neato/sgd.test.ts` exits 0
- One commit: `feat(neato): port SGD layout with MT19937 Fisher-Yates shuffle`
- Tests cover: deterministic output with seed 0 on a 5-node graph (two
  calls produce identical positions); verify no `Math.random` call via grep
  in the test (or structural check); MODEL_CIRCUIT fallback emits warning
  and proceeds as MODEL_SHORTPATH.
