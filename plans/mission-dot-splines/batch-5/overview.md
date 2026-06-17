# Batch 5 — rankdir=LR/RL/BT regular edges

Verify and fix regular-edge routing under non-default rankdir. The corpus found
LR long-spans drift ~10pt and LR fan outer edges collapse. If the faithful path
shares C's coordinate frame (it should — flat side-port edges already handle
flip), Batches 2–4 may already fix LR/RL/BT; this batch confirms and pins, or
fixes the residual frame handling.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T5 | Verify/fix LR/RL/BT regular edges under faithful routing; pin rankdir oracles | opus | `src/layout/dot/edge-route-faithful.ts`, `src/layout/dot/edge-route-chain.ts`, `src/layout/dot/edge-route-splines.test.ts` | T4 | [x] |

If T2–T4 already brought LR/RL/BT to parity, T5 collapses to pinning oracle tests
only (log it). Gate per [../README.md](../README.md). One commit.
Commit: `feat(T5): regular-edge rankdir parity + oracle pins`.
