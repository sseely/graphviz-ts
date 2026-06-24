<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture decisions

All decisions below are **locked** for this mission. A conflicting constraint
discovered during execution → stop and log to `decision-journal.md`.

## AD-1 — dfsRange flat stack representation

**Context:** `dfsRange`/`dfsRangeInit` push a `{v,par,lim,toI,tiI}` object per
node visit (`ns-range.ts`). 2471 does 384M such pushes → dominant 40% hotspot.
C uses `LIST(dfs_state_t)` — a flat growable array of value structs, zero
per-element heap allocation (`lib/common/ns.c:1242`).

**Decision:** Replace the object stack with **parallel arrays** (SoA): one
`Node[]` (or `(Node|undefined)[]`), and `Int32Array`/plain number arrays for
`lim`, `toI`, `tiI`, plus a parallel `Edge[]` for `par`, indexed by a stack
pointer `sp`. Preallocate to the node count and reuse across calls (grow only if
needed). Same treatment for `dfsRangeInit` and `dfsCutval`.

**Consequences:** Eliminates ~384M allocations on 2471; matches C's value-struct
array. Traversal order and all `low`/`lim`/`par` writes stay bit-identical.
Slightly more verbose than the object version — acceptable, it mirrors C.

## AD-2 — de-guard hot accessors

**Context:** `nodeLim/nodeLow/nodeRank` etc. wrap `n.info.X ?? 0` (`ns.ts:15-26`).
In a 384M-iteration loop the `??` branch and call indirection add up.

**Decision:** Inside the NS DFS/enter-edge hot loops **only**, read
`n.info.lim` / `.low` / `.rank` / `.par` directly as numbers. These fields are
provably initialized before the DFS runs (`initRank` sets `rank`;
`dfsRangeInit` sets `low`/`lim`/`par`). Leave the public accessor functions and
all non-hot call sites unchanged.

**Consequences:** Removes branches in the hottest path. Risk: an un-initialized
read would read `undefined` instead of `0`. Mitigation: only inline where an
invariant guarantees initialization; keep accessors elsewhere. If unsure for a
given field, keep the accessor.

## AD-3 — recursion → iterative

**Context:** `rerank` (`ns.ts:217`) recurses over the tight-tree subtree to
depth O(V). 2108 overflows V8's ~1MB stack; `--stack-size=2000` fixes it. C
recurses too but has an ~8MB native stack. The library must run in a browser
where stack size is fixed and small.

**Decision:** Convert `rerank` to an explicit todo-stack. Then re-run 2108 at
**default** stack. For each further overflow, convert the next offender in the
dot critical path (candidates: `acyclic.ts dfs`, `straight-edges.ts dfs`,
`ns-subtree.ts treeAdjust`). Iterate until 2108 renders at default stack.
Preserve pre-order/visit order exactly so cut-value and rank results are
unchanged.

**Consequences:** Browser-safe on arbitrarily deep graphs. Precedent:
`dfs_range`/`dfs_cutval` are already iterative in the port. Allowed by CLAUDE.md
("unless TypeScript forces a structural change" — V8's small stack forces it).

## AD-4 — validation: byte-identical, zero regressions

**Context:** This is a refactor. Output must not change. The 7 timeout cases
were never compared (they timed out), so they have no prior verdict.

**Decision:** The gate is: full vitest green, `tsc` clean, and a fresh survey
where **no byte-match or structural-match case regresses**. Capture
`test/corpus/parity.json` (byte/structural counts + per-id verdicts) **before**
starting; diff after. The 7 rescued cases get a **new baseline** verdict
(expected: `diverged` or `structural-match` — whatever they are once they finish
in time). Any rescued case that lands in `diverged` needs a comparison page
(project CLAUDE.md completion rule) — handled in T5.

**Consequences:** Hard, objective gate. A single regression = stop.

## AD-5 — parser crashes scope

**Context:** The 5 `errored` cases (`1308_1`, `1474`, `1489`, `1494`, `1676`)
are fuzzer-corrupted (mojibake, stray bytes). Native's error-recovering yacc
parser limps through and emits (garbage) SVG; peggy rejects at first bad token.

**Decision:** Investigate each. If a **single clean, low-risk recovery pattern**
in `src/parser/dot.pegjs` resolves multiple cases without weakening the grammar
for valid input, apply it (regen with `npm run parser:regen`, add a parser unit
test). Otherwise document each as **won't-fix** in the decision journal with the
reason and the native output, and leave the survey verdict as `errored`. Tight
time-box: do not chase one-off byte corruptions. **Never** loosen the grammar in
a way that changes parsing of any currently-passing corpus input — verify with
the survey gate.

**Consequences:** Likely low yield; honest documentation is an acceptable
outcome for this batch. The grammar's integrity for valid DOT is non-negotiable.
