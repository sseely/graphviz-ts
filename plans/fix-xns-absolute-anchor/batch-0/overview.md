# Batch 0 — x-NS pivot-trace harness

Build the diagnostic that drives all of Batch 1: a side-by-side trace of C's and
the port's x-coord network-simplex pivot sequence, so the *first* ordering
divergence is identifiable.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T0 | x-NS pivot trace (C + port, env-gated) + diff script; capture baseline divergence on 2368_1 | orchestrator | `test/diagnostic/xns-trace.md`, `test/diagnostic/xns-diff.mjs` | — | [x] |

**T0 result (re-scopes the mission):** the port's x-NS frame at `set_xcoords` is
**byte-identical to C** (2368_1: virtual −38/66, 376=−119, 196=−29, 256=43,
316=115, 76=205; `xns-diff.mjs` reports MATCH). No NS pivot-order divergence
exists. The internal-frame divergence is the **port-only** `normalizeXcoords`
(`position.ts`), which C lacks. See `decision-journal.md` and `xns-trace.md`.

Notes:
- C instrumentation in `~/git/graphviz/lib/common/ns.c` is **temporary**: gate
  every print by `NSDBG`, rebuild `gvplugin_dot_layout`, capture, then
  `git -C ~/git/graphviz checkout -- lib/common/ns.c` and rebuild clean.
- Port instrumentation in `src/layout/dot/ns.ts` is also env-gated (`NSDBG`) and
  must be **removed** before Batch 0 closes — the only committed artifacts are the
  trace recipe + diff script under `test/diagnostic/`.
- Output of T0 = a documented divergence point (which pivot first differs) that
  Batch 1 consumes.
