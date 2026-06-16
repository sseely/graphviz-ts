# Decision Journal — dot-flat-labels (G4)

Appended during execution (per ~/.claude/rules/autonomous-execution.md).

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| T1 | 2026-06-16 | Single-agent inline (no parallel fan-out) | T1 is one logical unit on 2 files (flat.ts, position.ts); per parallelism.md, no bottleneck justifies multi-agent. | No |
| T1 | 2026-06-16 | Updated `flat.test.ts` abomination block (AC4) to AD-2 contract | The 2 abomination unit tests asserted the old negative-index behavior (`minrank=-1`) that AD-2 deliberately replaces. Test co-locates with the rewritten fn; TDD requires it track the new contract. Not a source file outside write-set; not an oracle/golden. | No |
| T1 | 2026-06-16 | Faithfully ported full `flat_node` (ypos, dims, ports, ht1/ht2, coord, ND_alg→posAlg) | Prior TS `flatNode` was missing `ND_alg(vn)=e` (the T2 interface contract) and set lw/rw/ht wrong (used nodesep instead of dimen.x/2). Ported flat.c:flat_node 137-184 exactly; split into helpers (flatLabelYpos/flatNodeDims/flatNodeEdges) to satisfy the 30-line/CCN-10 hook. | No |
| T1 | 2026-06-16 | Kept simplified `flatLimits` (not full C bounds[4]) | T1 scope = vnode creation; the simplified placement returns a valid in-range slot and AC passes. Full `flat_limits` (setbounds/HLB-SRB) deferred to T2 if oracle pins need exact x-placement. | Review in T2 |
| T1 | 2026-06-16 | Lizard "length" counts inter-fn comments toward the preceding fn | The TS parser attributes comments between fn N and N+1 to fn N's length. Moved AD-2 rationale into `abomination`'s body as inline comments + trimmed JSDocs so `flatNode` measures ≤30. | No |
