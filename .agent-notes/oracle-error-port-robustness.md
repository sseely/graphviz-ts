# Oracle-error corpus cases — port robustness backlog

Context: the dot parity survey marks 11 inputs `oracle-error` (native `dot`
fails to emit a complete SVG) and excludes them from scoring. Rendered all 11
through the port (2026-06-24) to check whether the port also fails when the
oracle does. Verdict: the survey treatment is correct (no reference SVG → no
parity to score), and the port produces NO falsely-successful divergent render.
But the failure *modes* on the degenerate inputs are a robustness backlog.

## Observation: parser parity holds on native-syntax-rejected inputs
- **Context**: 3 of the 11 are inputs native rejects as malformed syntax.
- **Finding**: `1411`, `imagepath_test-base` (imagepath_test/base.gv),
  `share-b545` (share/b545.gv) all make the port THROW a peggy parser error —
  same rejection as native. Good parity; keep them (passive guard), do not
  quarantine.
- **Impact**: confirms the port's parser strictness matches native on these.
- **Confidence**: High (rendered, observed `__RENDER_ERROR__` parser message).

## Observation: port is MORE robust than native on 1783 (overflow)
- **Finding**: native fails with "overflow when calculating virtual weight of
  edge"; the port RENDERS it (1246-byte SVG). Not a divergence — the port simply
  doesn't hit native's int-overflow limit. No reference exists to score it.
- **Confidence**: High.

## Observation: port fails UNGRACEFULLY on the 7 native-crash inputs
- **Context**: 7 inputs make native crash/abort ("oracle exit null"). The port
  also fails on all 7, but via worse failure modes than a clean error.
- **Finding**:
  - **Hangs (5)**: `1652`, `2064`, `2475_1`, `2593`, `2621` — port runs >40s
    (likely infinite loop / pathological blow-up). A hang is the worst mode for
    a browser library. Connects to the standing "remaining hangs" question.
  - **JS TypeError (1)**: `2723` — port throws `Cannot read properties of
    undefined` (a null-deref bug, the clearest single defect; should be a guarded
    clean error or handled).
  - **SIGABRT (1)**: `1864` — port aborts (exit 134; stack overflow / assertion).
- **Impact**: these are degenerate inputs native ALSO can't render, so low
  priority — but ideal behavior is a clean thrown error, never a hang/abort/
  null-deref. Backlog: make the port fail gracefully on these. Start with `2723`
  (concrete null-deref) and the 5 hangs (instrument to find the loop; reuse the
  `node --prof` / hang-bisect recipe from prior hang work).
- **Confidence**: High (rendered each via render-one subprocess, 40s timeout).

## Disposition
Do NOT quarantine any of the 11 — the survey's `oracle-error`/excluded bucket is
correct (no reference). The pass proved no hidden parity failure. The 5 hangs +
`2723` null-deref + `1864` abort are a separate "port should fail gracefully"
robustness backlog, gated behind higher-value work.
