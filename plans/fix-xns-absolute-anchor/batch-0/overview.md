# Batch 0 — x-NS pivot-trace harness

Build the diagnostic that drives all of Batch 1: a side-by-side trace of C's and
the port's x-coord network-simplex pivot sequence, so the *first* ordering
divergence is identifiable.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0 | x-NS pivot trace (C + port, env-gated) + diff script; capture baseline divergence on 2368_1 | debugger | `test/diagnostic/xns-trace.md`, `test/diagnostic/xns-diff.mjs` | — | [ ] |

Notes:
- C instrumentation in `~/git/graphviz/lib/common/ns.c` is **temporary**: gate
  every print by `NSDBG`, rebuild `gvplugin_dot_layout`, capture, then
  `git -C ~/git/graphviz checkout -- lib/common/ns.c` and rebuild clean.
- Port instrumentation in `src/layout/dot/ns.ts` is also env-gated (`NSDBG`) and
  must be **removed** before Batch 0 closes — the only committed artifacts are the
  trace recipe + diff script under `test/diagnostic/`.
- Output of T0 = a documented divergence point (which pivot first differs) that
  Batch 1 consumes.
