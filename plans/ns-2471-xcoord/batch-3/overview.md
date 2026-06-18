# Batch 3 — Apply faithful fix + full 2471 end-to-end parity

Apply the C-faithful fix from `../batch-2/ns-root-cause.md` and prove full 2471
end-to-end parity. Only runs if Batch 2 localized a root cause (not the STOP
path).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Apply NS fix; verify 2471 end-to-end < 60s + x-order==C + zero churn | sonnet/opus | ns.ts and/or ns-core.ts, +test | T2 | [ ] |

Final gate (all must hold):
- 2471 renders **end-to-end < ~60s**.
- 2471 x-order per rank **identical to C** (native-oracle comparator).
- **Zero golden churn**; all existing graphs' x-coords byte-identical to C.
- `npm run typecheck` 0 · `npm test` green (>=1876) · `npm run build` OK.
- `git -C ~/git/graphviz status --porcelain lib/` empty (C source reverted).
- On green: `feature/mincross-2471-faithful` is merge-ready (mincross + position
  together) — note this in the journal; the human performs the merge.
