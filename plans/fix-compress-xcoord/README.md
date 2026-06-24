# Mission: fix the `ratio=compress` x-coordinate divergence (NaN → structural-match)

Status: **BLOCKED after T2 — premise disproven, awaiting human decision**

## Outcome (2026-06-24)

T2 pinned the divergence conclusively: **there is no compress-local bug.** The
compress x-NS path (`compressGraph`, `containNodes`, width constraint, network
simplex, `lrBalance`) is faithful — every constraint input matches C except the
half-widths of 9 nodes, which the port measures 0.5–1.03 pt wider due to the
**accepted A2 font-metric divergence** (`docs/known-divergences.md:63`).
Compress's weight-1000 packing makes the normally-slack separation constraints
binding, surfacing that sub-pixel width error as a −3..−5 pt interior x-shift,
which in turn tips the `Target<->TThread` straight spline 0.55 px past a box wall
→ the 7-vs-4 over-segmentation. Forcing the 9 widths to C's values drops node-x
divergence 53/76 → 0/76 and resolves the spline 7 → 4 pts (proof in
`decision-journal.md`). The mission's premise ("defect is downstream of
`compressGraph`") is therefore false; no in-scope fix exists (font metrics and
the spline router are both out of scope).

**Decision needed (see chat):** (a) characterize NaN as an A2 divergence in
`known-divergences.md` and merge compress activation on its own merits
(0-regression, fixes dims/ranks for the 4 compress graphs), (b) leave compress
unmerged, or (c) re-scope toward font-metric fidelity (large, separate effort).

The original plan below is retained for reference.

---


## Mission

Under `ratio=compress`, the dot port assigns node **x-coordinates** that diverge
from native graphviz by up to ~5pt across most nodes. This is NaN.gv's last
blocker to structural-match. Bring the compress x-coordinate assignment to parity
with C so NaN reaches **structural-match** (ideally byte-match) with **0 corpus
regressions**.

## Why this exists / how we got here

NaN's visible symptom was the `Target<->TThread` 2-cycle spline rendering with an
extra bezier segment (7 pts vs native 4). A multi-day investigation chased the
spline router, then "offset ports" — **both disproven**. The decisive probe
(instrumented C `beginpath`): `tail_port.p=[0,0]` — no port offset; the apparent
+8 was `ND_coord(Target).x` itself. A full node-by-node compare (TS+compress vs
native, oracle) shows the real defect:

> **53 of 76 NaN nodes are mispositioned in X only (every `dy=0`), by −5..+1pt.**

The over-segmented spline is a *symptom*: TThread sits −3pt off; ×0.24
(corridor-entry interpolation fraction) = 0.73pt, exactly enough to flip the
straight tail→head line from 0.2px **inside** the tail-box wall to 0.55px
**outside** → `shortestPath` bends the polyline → `Proutespline` emits the extra
segment. **Fix the x-positions and the spline resolves on its own** — do NOT touch
the spline router (`routeRegularEdgeFaithful`, `routespl`, `route.ts`).

Full analysis: `.agent-notes/opposing-edge-spline-divergence.md` (top "SUPERSEDED"
block) and memory `backedge-bbox-clip-fix-done.md`.

## What C does (the spec)

`ratio=compress` (input.c:584 → `GD_drawing(g)->ratio_kind = R_COMPRESS`). During
x-coordinate assignment, `create_aux_edges` (position.c:530) calls
`compress_graph` (position.c:501) **before** the x-network-simplex `rank(g,2,...)`:

```c
static void compress_graph(graph_t *g) {
  if (GD_drawing(g)->ratio_kind != R_COMPRESS) return;
  p = GD_drawing(g)->size;
  if (p.x * p.y <= 1) return;
  contain_nodes(g);                              // per-rank ln/rn containment
  x = GD_flip(g) ? p.y : p.x;                     // landscape → p.y
  x = MIN(x, USHRT_MAX);
  make_aux_edge(GD_ln(g), GD_rn(g), x, 1000);     // width<=size constraint, wt 1000
}
```

The width-constraint aux edge squeezes node x-positions to fit `size.x`; the
x-NS redistributes to satisfy it (with the LR/edge-pair/cluster constraints).

## Where the port already is (faithful pieces — do not "rewrite")

- `compressGraph` (`src/layout/dot/position-cluster.ts:265`) is a faithful port of
  `compress_graph` — same `containNodes` + `makeAuxEdge(ln, rn, x, 1000)`,
  `x = min(flip ? p.y : p.x, 65535)`. **Confirm, don't rewrite.**
- `makeAuxEdge`, `containNodes`/`containNodesRank`, `makeLrvn` (ln/rn), the x-NS
  (`rank` balance mode 2) all exist.

So the ≤5pt defect is **downstream of `compressGraph`**, in one of:
1. `size` value fed to the width constraint (`g.info.drawing.size` under
   compress+landscape — is it `{16,10}` in points, flip-swapped correctly?).
2. `containNodes` / `containNodesRank` per-rank margins or the ln/rn windowing
   (cf. the known `rk.v[0]` vs `rankGet(rk, ...)` window bugs —
   memory `contain-nodes-vstart-window`, `hang-2475-2-xcoord-ns`).
3. The x-NS solve under the extra compress aux edge (balance/tie-break /
   `flat_edges` / `LR_balance` interaction with the width constraint).

## Compress is a prerequisite (currently unmerged)

`ratio=compress` activation lives on `feature/ratio-compress` (commit **6ef3eeb**),
**not on main**. It was intentionally held back pending this fix. This mission
lands them together: Batch 1 establishes compress on the mission branch, Batch 2–3
fix the x-coordinate residual and verify, then the whole thing merges.

## Batches

### Batch 1 — Foundation + de-risk (pin the exact divergence locus)
- **T1** Branch `feature/fix-compress-xcoord` from `main`; bring in compress
  (cherry-pick 6ef3eeb; resolve the `test/corpus/parity.json` conflict with
  `--theirs`). Typecheck + full test green. Establish the baseline survey.
- **T2** Pin the divergence. Using the oracle (recipe below), dump per-rank, for
  NaN under compress: each node's x, the rank `ln`/`rn` aux-edge minlens, the
  width-constraint value `x`, and the x-NS result — **port vs C side by side**.
  Identify the FIRST rank/edge where the constraint inputs diverge. Classify as
  (1) size value, (2) containNodes margin/window, or (3) x-NS solve. **Deliver a
  one-paragraph root-cause with the C line + the diverging numbers** before any
  fix. (No code change in this task.)

### Batch 2 — Fix
- **T3** Apply the minimal faithful fix at the locus T2 identifies (e.g. a
  margin/window correction in `containNodesRank`, or the `size` flip handling).
  Scope strictly to the compress x-coordinate path. No spline-router changes.

### Batch 3 — Verify
- **T4** Oracle goldens: NaN node-x compare → all `|dx| ≤ 1` (target 0); confirm
  `Target<->TThread` spline now 4 pts; NaN verdict → **structural-match** (byte if
  reachable). Run the full survey: **0 regressions** mandatory. If verdicts
  legitimately improve, regen parity.json/PARITY.md. Merge to main (merge commit).

## Quality gates (run between every batch)
- `npm run typecheck` — exit 0. on_fail: fix_and_rerun
- `npm test` — all green. on_fail: fix_and_rerun
- lizard on any edited file: `~/.claude/hooks/.venv/bin/lizard <file> -C 10 -w` —
  clean. on_fail: fix_and_rerun
- Survey: `cp test/corpus/parity.json /tmp/parity.before.json` then
  `npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts`; diff
  verdicts. **0 regressions.** on_fail: stop
- `git diff --name-only` ⊆ declared write-set. on_fail: stop

## Oracle / investigation recipe
- Build dot (instrumentable): `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg ...`
- TS+compress render: on the mission branch, `GVBINDIR=/tmp/gvplugins npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/NaN.gv dot`
- Node-x compare script: see `decisions.md` (the 76-node dx/dy diff used to find
  this defect — reuse verbatim).
- Instrumenting `lib/common/*.c` or `lib/dotgen/*.c`: edit, then
  `cmake --build . --target common_obj common && cmake --build . --target dot gvplugin_dot_layout`
  (the plugin embeds its own objects — a plugin-only relink uses stale code).
  **Revert all C instrumentation and rebuild clean before finishing.** The
  complexity hook false-positives on the C repo — ignore it there.

## Stop conditions
- Same x-NS location changed 3× without converging on NaN's node-x → stop (signals
  the constraint model, not a local tweak — document in decision journal).
- Any fix that improves NaN but regresses ≥1 corpus verdict that cannot be
  explained as a move toward C → stop.
- The fix would require touching the spline router or the general (non-compress)
  x-NS → stop (out of scope; re-scope).

## Out of scope
- The spline router (`routeRegularEdgeFaithful`, `splines-routespl`, `route.ts`) —
  it is faithful; the input positions are the defect.
- General (non-compress) x-coordinate assignment — NaN's x matches C without
  compress (per prior analysis); do not perturb it.
- `orientation=landscape` rotation (already shipped, byte-match).

## Risk
**Medium.** The compress path is exercised by only ~4 corpus graphs (NaN×3,
1447_1), so blast radius is small — but the x-NS constraint model is shared, so a
careless change to `containNodes`/`makeAuxEdge` could move non-compress graphs.
Keep the fix gated on `ratio_kind === 'compress'` where possible; full survey is
the backstop.
