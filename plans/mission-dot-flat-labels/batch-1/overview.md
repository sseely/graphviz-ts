# Batch 1 — flat label vnode creation

Single task. The wiring fix, `needsAbomination` trigger, and `abomination`
rewrite must land atomically — `flatEdges`-wired-alone crashes on rank-0 flat
labels, and the trigger fix alone routes into the broken `abomination`.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Wire real `flatEdges`; fix `needsAbomination` (flat_out); rewrite `abomination` 0-based; align `flatNode`/`makeVnSlot` indexing | opus | `src/layout/dot/position.ts`, `src/layout/dot/flat.ts` | — | [ ] |

Gate after the task per [../README.md](../README.md). One commit.
Commit: `feat(T1): create flat label vnode (wire flatEdges + abomination rewrite)`.
