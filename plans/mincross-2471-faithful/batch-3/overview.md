# Batch 3 — Apply the Layer-2 fix + full 2471 parity verify

Apply the C-faithful Layer-2 fix from `../batch-2/layer2-root-cause.md` and prove
full 2471 parity. Only runs if Batch 2 localized a root cause (not the STOP path).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Apply Layer-2 fix; verify 2471 order==C + completes + zero churn | sonnet/opus | mincross-cross.ts (likely), +test | T3 | [ ] |

Final gate (all must hold):
- 2471 final per-rank order **byte-identical to C** (fingerprinted name dump
  diff == 0).
- 2471 **completes < ~60s**.
- **Zero golden churn**; mc3 / chain_24 TB+RL / port_rl / Batch-1 windowed repros
  all byte-identical to C.
- `npm run typecheck` 0 · `npm test` green · `npm run build` OK.
- `git -C ~/git/graphviz status --porcelain lib/dotgen` empty (C reverted).
