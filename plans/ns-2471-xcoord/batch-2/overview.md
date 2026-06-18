# Batch 2 — Localize the exact ns.c deviation

Pin the precise C-vs-TS behavioral difference behind the network-simplex
non-convergence and write the root-cause doc. **Hard-gated:** 2 diagnostic
rounds. Only runs if T1 classified the hang as cycling/correctness (not
faithful-but-slow).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Localize the deviation; write `ns-root-cause.md` | (inline/opus) | batch-2/ns-root-cause.md | T1 | [ ] |

T2 is the research core — run inline so harness + C-oracle state persist across
probes. If 2 diagnostic rounds don't localize a single C-faithful divergence,
STOP, write what's known to `ns-root-cause.md`, leave the tree reverted (per
ADR-5 / stop conditions). Do not thrash a fix into `ns.ts`/`ns-core.ts` before
the root cause is pinned.

Output gates Batch 3: `ns-root-cause.md` must name the exact function + the
precise C-vs-TS behavioral difference + the proposed faithful fix, the way
`../../mincross-2471-faithful/batch-2/layer2-root-cause.md` does.
