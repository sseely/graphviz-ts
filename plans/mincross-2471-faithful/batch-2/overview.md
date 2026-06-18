# Batch 2 — Diagnose the transpose oscillation

Localize the **exact C-faithful divergence** behind TS `transpose`'s
non-convergence. Path depends on T2's classification:
- **(A) small-reproducible** → diagnose on the fast repro.
- **(B) 2471-scale-only** → diagnose on 2471 with the convergence-point harness.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Localize the oscillation root cause; write Layer-2 root-cause doc | (inline/opus) | layer2-root-cause.md | T2 | [ ] |

T3 is the research core — run inline so harness + C-oracle state persist across
probes. **Hard-gated:** if 2 diagnostic rounds don't localize a single C-faithful
divergence, STOP, write what's known to `layer2-root-cause.md`, leave the tree
reverted (per AD-3 / stop conditions). Do not thrash a fix into `mincross-cross.ts`
before the root cause is pinned.

Output gates Batch 3: `layer2-root-cause.md` must name the exact function +
the precise C-vs-TS behavioral difference and the proposed faithful fix, the way
`faithful-fix.md` does for Layer 1.
