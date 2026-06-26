# Batch 1 — Capture C spline oracle for honda's 2 divergent edges

Single sequential task. No port changes. Output feeds Batch 2.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Map SVG edge index→tail/head/label; instrument C spline router; dump 4 stages for the 2 divergent edges (+1 control) | orchestrator (debugger) | C source (temp), `oracle/c-dump.txt` | — | [ ] |

Dependency summary: none (mission entry point).

## Step 0 — identify the divergent edges (ADR-4)
Render honda native + port, list `<path>` per-edge coord-pair counts, find the
2 with differing counts, and map each SVG index to its `tail->head` (+ multi
ordinal) via the preceding `<!-- t&#45;&gt;h -->` comment (native) / emit order.
```
F=~/git/graphviz/tests/graphs/honda-tokoro.gv
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg $F > /tmp/h-native.svg
tsx test/corpus/render-one.ts $F dot > /tmp/h-port.svg
# pairs() per edge path; the 2 mismatches are edge index 2 and 27.
```

## Step 1 — instrument C (GV_XDUMP-gated, reverted in T4)
In `lib/dotgen/dotsplines.c`, gated on `getenv("GV_XDUMP")`, for the targeted
edges (match by tail/head name), dump the 4 stages of ADR-2:
1. classification + label-node id/rank/coord (`setEdgeLabelPos`/`place_vnlabel`)
2. routing boxes handed to the fitter (the `path`/box sequence in
   `make_regular_edge` → `routesplines`)
3. pre-fit path points
4. final bezier segments (piece count + control points)

Build: `cmake --build ~/git/graphviz/build --target gvplugin_dot_layout dot`,
regen `/tmp/ghl`, render honda with `GV_XDUMP=$PWD/oracle/c-dump.txt`.

Exit criterion: `oracle/c-dump.txt` contains the 4 stages for the 2 divergent
edges (keyed by tail->head so the port is matchable). C instrumentation stays in
place until T4 (reverted there).
