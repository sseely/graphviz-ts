# T5 — rankdir=LR/RL/BT regular edges

## Context

The corpus found regular edges diverge under `rankdir=LR` (long-span `a->d`
~Δ10.6; LR fan outer edges collapse). dot lays out in a rotated frame and routes
in it; the faithful path must respect `GD_flip` like the flat side-port path
already does. After Batches 2–4 most LR/RL/BT edges may already match (shared
frame); this task verifies and fixes any residual.

## Task

1. Run the corpus + a rankdir sweep (`rankdir=LR/RL/BT` over fan, long-span,
   diamond, back-edge) through the faithful routing from Batches 2–4. Identify
   residual divergences vs the dot oracle.
2. If residuals exist, fix the frame handling in `routeRegularEdgeFaithful` /
   `routeMultiRankEdgeFaithful` (the `GD_flip` / coordinate-rotation path) to
   mirror C. Reuse the flip handling already proven for flat side-port edges.
3. Goldens byte-identical (the goldens include rankdir cases — guard them).
4. Pin oracle tests: `rankdir=LR` long-span and LR fan, `rankdir=BT` chain, tol
   0.5. If no residual divergence remains, this task is pins-only — log that.

## Write-set

- `src/layout/dot/edge-route-faithful.ts` — flip/frame handling (if needed)
- `src/layout/dot/edge-route-chain.ts` — flip/frame for chains (if needed)
- `src/layout/dot/edge-route-splines.test.ts` — rankdir oracle pins

## Read-set

- `decisions.md#ad-2`; T1 inventory (`rankdir` category)
- `src/layout/dot/splines-flat.ts:cloneGraph` (flip handling reference)
- `~/git/graphviz/lib/dotgen/dotsplines.c` + `lib/common/postproc.c` (rankdir frame)

## Acceptance criteria

- **Given** `digraph{rankdir=LR; a->b->c->d; a->d}`, **then** `a->d` matches dot
  within 0.5pt.
- **Given** `digraph{rankdir=LR; a->{b..f}}`, **then** no degenerate edge; all
  within 0.5pt.
- **Given** the 115 goldens, **then** all byte-identical.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T5): regular-edge rankdir parity + oracle pins`.

## Observability / Rollback

N/A — pure layout. Reversible.
