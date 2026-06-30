<!-- SPDX-License-Identifier: EPL-2.0 -->

# x-NS frame trace harness

Diagnostic for the **x-coordinate network-simplex** (`rank(g, 2, …)` =
`balance=2`/`LR_balance`, un-normalized) absolute-anchor question: does the
port's x-NS solution land on the same internal pre-`gvPostprocess` frame as
Graphviz C? The answer pins where the degenerate spline-less edge labels of
`2368`/`2368_1` get drawn (a label whose edge has `ED_spl==NULL` is never
translated, so it stays at its un-normalized internal x — see
`plans/fix-xns-absolute-anchor` and
`.agent-notes/2368-degenerate-labeled-flat-edge_in_box.md`).

All instrumentation below is **temporary** and **env-gated**. The only
committed artifacts are this file and `xns-diff.mjs`. Revert the C source and
remove the port probe before closing the batch.

## What set_xcoords dumps

`set_xcoords` (C `lib/dotgen/position.c`, port
`src/layout/dot/position.ts:setXcoords`) copies `ND_rank` (holding the x-coord
produced by x-NS) into `ND_coord.x` for every node in `GD_rank[]` — the layout
nodes (`NORMAL` + virtual). It does **not** touch the aux-only `SLACKNODE`s,
which never enter the rank arrays. So a `set_xcoords`-time dump enumerates
exactly the nodes whose x-frame matters, in a `(rank, order)` sweep that is
identical on both sides. The rank-index *base* differs harmlessly (C numbers
the abomination flat-label rank as `-1`, the port as `0`); the diff script
normalizes that out and compares the x **values**.

## C side (temporary)

In `~/git/graphviz/lib/dotgen/position.c`, inside `set_xcoords`, after
`ND_coord(v).x = ND_rank(v);` and before `ND_rank(v) = i;`:

```c
if (getenv("XNSDBG")) {
    char *nm = agnameof(v);
    fprintf(stderr, "XNS C-setx r=%d o=%d ty=%d x=%d name=%s\n",
            i, j, ND_node_type(v), (int)ND_coord(v).x,
            (nm && nm[0]) ? nm : "__v");
}
```

Build, regen the headless gvbindir, capture, then **revert + rebuild clean**:

```sh
make -C ~/git/graphviz/build gvplugin_dot_layout
sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl
XNSDBG=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot \
    -Tsvg ~/git/graphviz/tests/2368_1.dot -o /dev/null 2>/tmp/xns-c.txt
grep -i 'C-setx' /tmp/xns-c.txt > /tmp/xns-c.dump   # (or filter as needed)

git -C ~/git/graphviz checkout -- lib/dotgen/position.c
make -C ~/git/graphviz/build gvplugin_dot_layout
sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl
```

## Port side (temporary, env-gated, removed before batch close)

`src/layout/dot/position.ts` carries an `XNSDBG`-gated `xnsdbgDump(g, tag)`
called right **after** `setXcoords` (tag `PRE-normalize`) and right **after**
`normalizeXcoords` (tag `POST-normalize`), plus an `XNS_NONORM` gate that skips
`normalizeXcoords`. Capture:

```sh
XNSDBG=1 GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts \
    ~/git/graphviz/tests/2368_1.dot dot 2>/tmp/xns-port.txt >/dev/null
grep 'PRE-normalize' /tmp/xns-port.txt > /tmp/xns-ts.dump
```

## Diff

```sh
node test/diagnostic/xns-diff.mjs /tmp/xns-c.dump /tmp/xns-ts.dump
```

Prints the first `(rank,order)` cell whose x differs, or confirms a full match.

## Captured baseline (2368_1) — THE FINDING

`set_xcoords`-time x-coords, C vs port `PRE-normalize`:

| node (ty, order)     | C x  | port x | match |
| -------------------- | ---: | -----: | :---: |
| virtual `%0` (ty1 o0)| -38  | -38    | ✓ |
| virtual `%0` (ty1 o1)|  66  |  66    | ✓ |
| `376` (ty0 o0)       | -119 | -119   | ✓ |
| `196` (ty0 o1)       | -29  | -29    | ✓ |
| `256` (ty0 o2)       |  43  |  43    | ✓ |
| `316` (ty0 o3)       | 115  | 115    | ✓ |
| `76`  (ty0 o4)       | 205  | 205    | ✓ |

`xns-diff.mjs` reports **MATCH** on all 7 cells.

**Conclusion.** The port's x-NS pivot sequence is already **bit-exact** with C:
the internal x-frame at `set_xcoords` is conformant, virtual nodes included.
There is **no** NS pivot-order divergence to chase. The entire internal-frame
divergence observed downstream (the uniform +146 shift recorded in the agent
notes; node `376` landing at +27 instead of -119) is introduced by the
**port-only** `normalizeXcoords(g)` call in `dotPosition` — a step C does not
have. C leaves the x-frame un-normalized (leftmost real node negative); the port
shifts it so the leftmost `NORMAL` node sits at x≈0.

This re-scopes the mission: the fix lives in `normalizeXcoords`, not in `ns.ts`.
The `XNS_NONORM=1` survey (normalize disabled) measures whether the step is
load-bearing for the conformant corpus. See the mission decision journal.

## Deeper pivot trace (optional)

If a future change ever does perturb the x-NS solution, a pivot-by-pivot trace
can be added in `lib/common/ns.c` (C) / `src/layout/dot/ns.ts` (port), both
gated by `NSDBG`, at: after `init_rank` (node/type/rank), after `feasible_tree`
(tree edges + ranks), each `leave_edge`/`enter_edge` pivot (tail→head + cutvalue
/ slack), and before/after `LR_balance`. Gate the prints on the x-coord call
only (`balance==2`). For `2368_1` the `set_xcoords` frame already matches, so
this deeper trace was unnecessary; the recipe is recorded for reuse.
