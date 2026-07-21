# Batch 3 — B3 rankdir_dot edge family

Depends on Batch 0. Skip if T0.2 marks B3 empty.

The `rankdir_dot` family (linux.x86-rankdir_dot / _dot1 / _dot2, nshare-*) —
`_dot` test inputs carrying `rankdir=`, run under sfdp (which ignores rankdir,
as does native). Edge-first divergence. Representative: **linux.x86-rankdir_dot**;
copies are the numbered/platform variants of the same input.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3.1 | Analyze rep: is it the same edge-tie class as B2, or distinct? | debugger | batch-3/findings.md | T0.2 | [ ] |
| T3.2 | Fix aggressively or accept; apply to family | general-purpose | (src fix, isolated) + batch-3/findings.md | T3.1 | [ ] |

Method identical to Batch 2 (inject → instrument predicate → mechanism). Likely
outcome: same CDT/flat FP-tie as B2, or a rankdir-ignored-but-node-order
difference. If T3.1 finds it IS the B2 class, note it and let B2's fix cover it
(re-sweep to confirm) rather than duplicating.
