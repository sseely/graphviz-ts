# The C-faithful fix (medians/reorder vStart) — correct but blocked on Layer 2

This is the verified root-cause fix for the 2471 mincross within-rank order
divergence. It is **correct** (all 41 mincross unit tests pass, tsc clean) but
**reverted** because it exposes a deeper transpose non-convergence (Layer 2,
see decision-journal.md) that hangs 2471. Re-apply this together with the
Layer-2 transpose-convergence fix.

## Root cause

`transpose` reads the rank window correctly via `rankGet(rk, i)`
(`= rk.v[(rk.vStart ?? 0) + i]`), but `medians` and `reorder` indexed
`rk.v[i]` from 0, ignoring `vStart`. C reads `GD_rank(g)[r].v` — the
already-offset window pointer (advanced by `init_mccomp`, aliased by
`merge_ranks`). For windowed graphs (multi-component comp≥2, all clusters)
they processed the wrong nodes — comp1's region instead of comp2's, missing
the tail, leaving stale `mval = -1` on the unreached tail nodes.

Evidence: comp2 r1 had `vStart=2`; medians read `rk.v[0..n-1]` (comp1's nodes
at 0,1; missed comp2's last 2). Per-component fingerprinted dumps: `build<c>`
(initial install) all matched C; comp2's first `mincross_step` diverged from a
matched input; `step_preTr` (pre-transpose) already differed → medians/reorder,
not transpose; r1 mvals were C+256 with spurious `-1`.

## Fix — src/layout/dot/mincross-order.ts

### medians (import `rankGet` from `./mincross-utils.js`)
```ts
export function medians(_ctx: MincrossContext, g: Graph, r: number, d: number): boolean {
  const gRank = g.info.rank;
  if (!gRank) return false;
  const rk = gRank[r];
  let hasfixed = false;
  for (let i = 0; i < rk.n; i++) {
    const v = rankGet(rk, i);            // was: rk.v[i]
    if (!v) continue;
    if (mediansProcessNode(v, d)) hasfixed = true;
  }
  return hasfixed;
}
```

### reorder + reorderInner (iterate the absolute window [vStart, vStart+n))
```ts
export function reorderInner(ctx, g, vlist, win: {start:number; ep:number}, reverse): boolean {
  let changed = false;
  const ep = win.ep;
  let lp = win.start;                     // was: 0
  while (lp < ep) { /* body unchanged: reorderFindLp/Rp/exchange use absolute idx */ }
  return changed;
}

export function reorder(ctx, g, r, reverse, hasfixed): void {
  const rootRank = ctx.root.info.rank;
  if (!rootRank) return;
  const rk = g.info.rank;
  if (!rk) return;
  const vlist = rk[r].v;
  const start = rk[r].vStart ?? 0;        // NEW
  let ep = start + rk[r].n;               // was: rk[r].n
  let changed = false;
  for (let nelt = rk[r].n - 1; nelt >= 0; nelt--) {
    if (reorderInner(ctx, g, vlist, { start, ep }, reverse)) changed = true;
    if (!hasfixed && !reverse) ep--;
  }
  if (changed) { rootRank[r].valid = false; if (r > 0) rootRank[r - 1].valid = false; }
}
```
Update the two `reorderInner(...)` call sites in `mincross-order.test.ts` to
pass `{ start: 0, ep: 2 }` instead of `2`.

## Why it's blocked (Layer 2)

Once comp2 (the big clustered component, ~3.2M crossings) is *properly*
reordered, TS `transpose`'s `while (delta >= 1)` oscillates (delta plateaus
~5221, never 0) — C converges in ~3s. Step-cap bisection: ≤5 mincross_steps
complete clean (no corruption); the dup-`ND_order` corruption seen uncapped is
a downstream symptom of the hung transpose, not a reorder bug. The likely
Layer-2 culprit is the crossing tiebreak the brief flagged: C `in_cross`/
`out_cross` (mincross.c:581-614) tiebreak on `port.p.x`; TS `transposeCounts`/
`accumCross` uses `val()`/`port.order`. The parent mission noted swapping to
`port.p.x` "changed the divergence without fixing it" — Layer 2 needs a
dedicated transpose-convergence investigation (likely the full `in_cross`/
`out_cross` port-x model, not just the tiebreak field).

## Harness (all temporary, reverted)

C: `cdump_ranks(g,label)` in `dot_mincross` (mincross.c) at checkpoints
merge2/clust/final + per-cluster (CDUMPC) + per-component build (CBUILD) +
per-iteration (CITER) + per-step pre/postTr; virtuals fingerprinted by
`v[upReal>downReal|clust]` (critical — plain `_v` is blind to virtual/leader
order and falsely "matches"). Build the repo's OWN `dot`
(`~/git/graphviz/build/cmd/dot/dot`) + self-consistent `/tmp/gvmine` plugin dir
(`dot -c`); homebrew `dot` ABI-mismatches a fresh plugin → segfault. Copy all
three dylib name variants. TS: matching `cdumpRanks` gated on globals, driven
by an esbuild-bundle node harness; `2471.dot` lives at
`~/git/graphviz/tests/2471.dot`.
