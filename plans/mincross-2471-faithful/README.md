# Mission: faithful 2471 mincross fix (vStart + transpose convergence)

## Objective

Make `tests/2471.dot`'s final per-rank mincross node order **byte-identical to
C**, completing in reasonable time with **zero golden churn**. Two layers:
1. **Known (mechanical):** `medians`/`reorder` ignore the `vStart` window offset
   — re-apply the verified fix in `../mincross-2471-order-parity/faithful-fix.md`.
2. **Undiagnosed (research):** that fix exposes TS `transpose` non-convergence
   (delta plateaus ~5221, never 0) once the clustered component is properly
   reordered. C converges in 3s. **Root cause unknown** — diagnose, then fix.

## Carried-in facts (do NOT re-derive)

- Root cause of Layer 1 is **confirmed**: `transpose` uses `rankGet(rk,i)`
  (vStart-aware); `medians`/`reorder` used raw `rk.v[i]`. Fix + evidence in
  `../mincross-2471-order-parity/faithful-fix.md` + `decision-journal.md`.
- Layer 2's likely shape: **duplicate `ND_order` within a rank** (parent's exact
  hang mode; 270 dups observed uncapped). With a hard step-cap ≤5, 2471
  completes clean — dups accumulate over many steps. `port.p.x` tiebreak is a
  **dead end** (no-op on 2471: px==order==0; parent already tried it).
- The blind `_v` per-rank dump **false-matches** — it hid this for two missions.
  Always fingerprint virtuals as `v[upReal>downReal|clust]`.

## Branch

`feature/mincross-2471-faithful` — merge commit to main (preserves per-task IDs).

## Constraints (porting; cardinal = parity)

- 2471 final per-rank order **byte-identical to C** (name dump diff == 0).
- **Zero golden churn**; mc3 / chain_24 TB+RL / port_rl / new windowed repros
  stay byte-identical to C.
- **C source is sacred:** revert all C instrumentation after use;
  `git -C ~/git/graphviz status` must be clean before any commit.
- **Completion bar:** 2471 < ~60s (pre-fix ~40–49s; C 3s).
- Write-set pre-authorized: `{mincross-order.ts, mincross-cross.ts, +tests}`.

## Quality gates

```
- command: npm run typecheck            # pass: exit 0
- command: npm test                     # pass: exit 0, ≥1874 tests
- command: npm run build                # pass: esbuild bundles
- command: git -C ~/git/graphviz status --porcelain lib/dotgen   # pass: empty
```

## Stop conditions

See [decisions.md](decisions.md#stop-conditions). Headline: same site changed
3× without progress · Layer-2 not localized within 2 diagnostic rounds → document
& leave reverted · any passing repro diverges / goldens churn · file outside
write-set needed · 2471 still hangs after the fix attempt.

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [1](batch-1/overview.md) | Re-apply vStart fix + prove it on small windowed repros | [ ] |
| [2](batch-2/overview.md) | Diagnose the transpose oscillation (root cause doc) | [ ] |
| [3](batch-3/overview.md) | Apply Layer-2 fix + full 2471 parity verify | [ ] |

## Index

- [decisions.md](decisions.md) — AD-1..AD-6, stop/push-forward
- [diagrams/component-map.md](diagrams/component-map.md) — touched modules
- [diagrams/data-flow.md](diagrams/data-flow.md) — mincross pipeline + checkpoints
- [decision-journal.md](decision-journal.md) — appended during execution
- **Prior art (read first):** `../mincross-2471-order-parity/faithful-fix.md`
  and `../mincross-2471-order-parity/decision-journal.md`
