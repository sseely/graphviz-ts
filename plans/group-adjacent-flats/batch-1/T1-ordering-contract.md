# T1 — Pin the C ordering contract + write the red test

## Context
graphviz-ts is a faithful TS port of C graphviz (`~/git/graphviz` = spec). The
`#241_0` flat-curl residual is fully diagnosed (`plans/flat-aux-curl-diagnosis/`,
merged `7490f43`): C groups all adjacent flat edges between a node pair into ONE
`make_flat_adj_edges` call; the port routes each in an isolated `cnt=1` aux
graph, so the reversed `3:sw->2:se` clones FORWARD (straight, size 4) instead of
as a BACK edge (curl, size 7). The fix is caller-side grouping (next task, T2).

This task locks the **one detail that can silently reproduce the bug**: the group
ORDER. `buildFlatAux`/`copyFlatSplines` (`src/layout/dot/splines-flat.ts:149-166,
244-257`) key the aux frame off `edges[0].tail`. The curl requires
`edges[0]` = the FORWARD edge (`auxt=clone(node2)`). The diagnosis dump was
internally inconsistent (`make_flat_adj_edges: tail=2 head=3` vs `edge[0]:
3->2`), so this MUST be pinned by C, not assumed (AD-1).

## Task
1. **Instrument C `make_flat_adj_edges`** (ephemeral, AD-5) to print, for the
   `#241_0` 2↔3 adjacent-flat group:
   - `cnt` and `e0` (`agnameof(agtail(e0))`/`aghead(e0)`),
   - the ordered `edges[]`: for each `i`, `agtail`/`aghead` names + `ED_tail_port
     .defined`/`ED_head_port.defined` + `AGSEQ(getmainedge(edges[i]))`,
   - which clone becomes `auxt` vs `auxh` (print the node each is cloned from),
   - after `dot_splines_`: each aux edge `(tail->head)` + spline `size`.
   Rebuild `gvplugin_dot_layout` → `/tmp/gvplugins`; run
   `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg
   ~/git/graphviz/tests/241_0.dot >/dev/null`. Capture the 2↔3 group lines.
   **Restore** clean dotsplines.c + clean plugin; verify `git -C ~/git/graphviz
   status` clean (AD-5).
2. **Confirm `edges[0]` = the forward edge** (tn=node2). If `edges[0]` is the
   back edge (`3->2`, tn=node3), STOP and report — the curl mechanism would be
   contradicted and the diagnosis must be re-opened (do NOT force a fix).
3. **Derive the port's in-group sort comparator** that reproduces C's `edges[0]`:
   state it concretely (e.g., "sort by: forward direction first — the edge whose
   `tail===pairLowerNode`; tiebreak by edge creation index / `AGSEQ`-equivalent").
   Identify the port's available analog of `AGSEQ` (edge insertion order — check
   `Graph.edges` push order / any `seq`/`id` on `Edge`).
4. **Write the RED test** `src/layout/dot/splines-flat-group.test.ts`:
   - Asserts the port routes `#241_0`'s `3:sw->2:se` to match the C oracle —
     prefer the FINAL SVG path geometry (per memory `flat-edge-241-is-y-only`:
     compare final SVG coords, not internal box coords), falling back to the aux
     `size===7` via the diagnosis harness if a direct SVG assertion is awkward.
   - Adds a guard asserting the forward `2:ne->3:nw` stays correct (size 7 /
     matching SVG) so T2 cannot fix one by breaking the other.
   - The test is RED now (documents expected-fail), structured so T2 flips it
     green with the grouping change only.

## Write-set
- `src/layout/dot/splines-flat-group.test.ts` (Create) — the red oracle test
- `plans/group-adjacent-flats/findings-ordering-contract.md` (Create) — the C
  dump + the pinned `edges[]` order + `auxt` assignment + the port sort comparator

Do NOT edit any `src/` NON-test file (the implementation is T2). Adding a `.test`
file is allowed and expected (TDD red).

## Read-set
- `decisions.md` (AD-1, AD-5)
- `plans/flat-aux-curl-diagnosis/findings-structural-dump.md` (the proven mechanism)
- `src/layout/dot/splines-flat.ts:139-166, 244-257` (cloneFlatEdge, buildFlatAux,
  copyFlatSplines — the `edges[0]` dependence)
- `src/layout/dot/edge-route.ts:292-303` (routeFaithfulSidePort — current cnt=1 call)
- `~/git/graphviz/lib/dotgen/dotsplines.c:344-411` (dot_splines_ collection loop),
  `:535-610` (edgecmp), `:1122-1213` (make_flat_adj_edges)
- memory `recover-slack-and-c-harness` (C instrumentation recipe),
  `oracle-native-not-wasm`, `flat-edge-241-is-y-only`
- `test/diagnostic/flat-aux-dump.ts` (reusable harness; do not modify its entry)

## Interface contract (consumed by T2)
```
{ pair: "2-3",
  cnt: number,
  edgesOrdered: [{ tail: string, head: string, portsDefined: bool, seq: number,
                   auxRole: "auxt-source"|"auxh-source"|"-", auxDir: "fwd"|"back",
                   auxSize: number }],
  edges0IsForward: boolean,            // MUST be true (else STOP)
  portSortComparator: string }         // the rule T2 implements verbatim
```

## Acceptance criteria
- The findings file pins cnt, ordered `edges[]`, `auxt`/`auxh` source nodes, and
  per-clone aux dir+size for `#241_0`'s 2↔3 group, from native C instrumentation.
- `edges0IsForward === true` is explicitly confirmed (or STOP logged).
- `splines-flat-group.test.ts` exists, is RED (the `3:sw->2:se` assertion fails
  on current `main`), and includes the forward-edge guard.
- `npx tsc --noEmit` exit 0; `git diff --name-only main` shows only the test file
  + the findings file; C source restored clean (`git -C ~/git/graphviz status`).
- `lizard src/layout/dot/splines-flat-group.test.ts -C 10 -L 30 -a 5` clean.

## Boundaries
- ZERO edits to `src/` non-test files. C instrumentation ephemeral — restore +
  verify before finishing.
- If a build/hook blocks you for 2 attempts, STOP and report exactly where —
  do not thrash (the prior missions' failure mode was over-iterating C).
- Use `npx tsc --noEmit` as the typecheck gate; Serena MCP for symbol nav.

## Quality bar / commit
One commit: `test(flat-group): red #241_0 adjacent-flat oracle + C order contract`.
Return to the orchestrator: the pinned `edges[]` order, `edges0IsForward`, the
port sort comparator, the red-test path, and C-restore confirmation. Do NOT touch
`decision-journal.md` (orchestrator writes it).
