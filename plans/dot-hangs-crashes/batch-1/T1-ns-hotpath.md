<!-- SPDX-License-Identifier: EPL-2.0 -->

# T1 — Network-simplex hot-path

## Context

`graphviz-ts` is a faithful pure-TS port of Graphviz; the C source at
`~/git/graphviz` is the spec. The dot parity survey renders every corpus input
with engine `dot` under a 20s timeout. Seven inputs currently `timeout`; the
dominant cause is the network-simplex re-ranging DFS `dfsRange`, which is **40%
of total / 67% of non-library** runtime on 2471 and runs **384M frame-steps**.
C executes the identical step count in 0.5s using a flat value-struct stack; the
port heap-allocates one object per frame (~55× per-frame overhead). Separately,
`rerank` recurses to depth O(V) and overflows V8's ~1MB stack on 2108
(`--stack-size=2000` confirms it is pure depth).

This is a **conformant refactor**: representation and per-op cost change,
algorithm and iteration count do **not**. Read `decisions.md` AD-1, AD-2, AD-3,
AD-4 in full before starting.

## Task

In the network-simplex subsystem, all preserving exact behavior and output:

1. **Flat dfsRange stack (AD-1).** Rewrite `dfsRange`, `dfsRangeInit`, and
   `dfsCutval` in `ns-range.ts` to use reusable parallel arrays (structure-of-
   arrays) indexed by a stack pointer, instead of pushing
   `{v,par,lim,toI,tiI}` / `{v,par,toI,tiI}` objects. Preallocate to node count
   and reuse across calls; grow only when needed. Keep the exact visit order,
   pruning checks (`ND_par(n)==e && ND_low(n)==lim`), and `low`/`lim` writes.
   Mirror `lib/common/ns.c:dfs_range` (1242) / `dfs_range_init` (1176).
2. **Iterative rerank (AD-3).** Convert `rerank` (`ns.ts:217`) from recursion to
   an explicit todo-stack. Preserve the pre-order rank updates and the
   tree-edge / `par` skip logic exactly. Mirror `lib/common/ns.c:rerank` (691).
3. **De-guard hot reads (AD-2).** In the dfsRange/dfsRangeInit/dfsCutval and
   `enterEdge`/`dfsEnterInedge`/`dfsEnterOutedge` hot loops, read
   `info.lim/low/rank/par` directly (they are initialized before the DFS).
   Do **not** change the public accessors or non-hot call sites.

Do **not** change `nsUpdate`, `enterEdge`'s algorithm, the main `rank2Loop`, or
iteration counts. Do **not** "improve" the simplex. Representation only.

## Write-set

- `src/layout/dot/ns-range.ts` — dfsRange, dfsRangeInit, dfsCutval flat-stack
- `src/layout/dot/ns.ts` — iterative rerank; inline hot reads in enter-edge
  helpers
- `src/layout/dot/ns-core.ts` — only if a hot accessor needs a non-guarded
  variant (optional)
- `src/layout/dot/ns-range.test.ts` (or existing ns test) — add/extend tests

## Read-set

- `decisions.md#ad-1`, `#ad-2`, `#ad-3`, `#ad-4`
- `src/layout/dot/ns-range.ts:101-170` (current dfsRange/Init), `:58-95` (cutval)
- `src/layout/dot/ns.ts:15-26` (accessors), `:108-197` (enter-edge), `:204-253`
  (treeupdate/rerank/update)
- C spec: `~/git/graphviz/lib/common/ns.c:1242` (dfs_range), `:1176`
  (dfs_range_init), `:691` (rerank), `:1161` (dfs_state_t struct)

## Interface contracts

No public API change. `dfsRange(v, par, low)`, `dfsRangeInit(v)`,
`dfsCutval(v, par?)`, `rerank(v, delta)` keep their signatures and return values.
Reusable scratch buffers must be **module-private** and **reset per call** (see
the multi-diagram global-state safety rule: any new module-level `let` must reset
on entry). Register any new module global in the `module-globals.fitness`
allowlist if the repo's fitness check requires it.

## Acceptance criteria

- **Given** the pre-mission vitest suite, **when** T1 lands, **then** `npm test`
  and `npm run typecheck` pass with zero changes to expected outputs.
- **Given** 2471 rendered before and after, **when** SVGs are diffed, **then**
  they are **conformant** (representation change only).
- **Given** 2108 at **default** V8 stack, **when** rendered via the port, **then**
  it completes without "Maximum call stack size exceeded".
- **Given** 2471, **when** timed (port vs `dot -Tsvg`), **then** it is within ~3×
  native (target ≤ ~1.5s; hard floor < 20s). Log the number; if not met, note it
  for T3 — do not force it by altering the algorithm.
- **Given** a unit test, **when** `dfsRange`/`rerank` run on a small fixed tree,
  **then** asserted `low`/`lim`/`rank` values match the recursive/object version
  exactly (lock the conformant equivalence).

## Verify byte-identity (recipe)

```bash
git stash   # baseline
npm run build:js && node -e 'import("./dist/index.js").then(m=>{ \
  const fs=require("fs"); \
  fs.writeFileSync("/tmp/before.svg", m.renderSvg(fs.readFileSync(process.argv[1],"utf8"),"dot")); \
})' /Users/scottseely/git/graphviz/tests/2471.dot
git stash pop   # your change
npm run build:js && node -e '...same, write /tmp/after.svg...' .../2471.dot
diff /tmp/before.svg /tmp/after.svg && echo BYTE-IDENTICAL
```

Do this for 2471, 1718, 2475_2, and a handful of currently conformant with cases
(`graphs-abstract`, `graphs-b7`) to prove no collateral change.

## Observability

N/A — pure library refactor, no observable runtime operations.

## Rollback

Reversible — revert the commit. No API/data/output change.

## Quality bar

`npm run typecheck` + `npm test` + `npm run build:js` all exit 0 before finishing.
Keep functions under the repo complexity caps (file 500 / CCN 10 / params 5); the
flat-stack code can push CCN — extract helpers (e.g. a `pushFrame` / `popFrame`)
to stay under. One commit: `perf(ns): flat dfsRange stack + iterative rerank`.
