# Batch 4 — cleanup + forward scoping (sequential)

T7 first (T8 reads the post-deletion state of the emit family).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T7 | emit-family reachability audit + deletion ([T7-emit-cleanup.md](T7-emit-cleanup.md)) | sonnet | src/common/emit.ts, emit-node.ts, emit-edge.ts, emit-cluster.ts, emit-xdot.ts, emit-style.ts, emit-bb.ts, emit-coord.ts, emit-shape.ts, emit.test.ts (deletions); fold targets if any (declare) | T6 | [ ] |
| T8 | html-labels mission scoping doc ([T8-html-scope.md](T8-html-scope.md)) | sonnet | plans/parity-html-labels/SCOPE.md (new) | T7 | [ ] |
