# compress x-coord divergence (NaN) = accepted A2 font metrics, not a compress bug

## Observation: ratio=compress x-NS path is faithful; residual is node widths
- **Context**: Mission plans/fix-compress-xcoord — pin NaN's compress x-coord
  divergence (53/76 nodes off in X, −5..+1 pt) and fix to |dx| ≤ 1.
- **Finding**: The compress path is faithful. Verified via oracle
  (GVBINDIR=/tmp/gvplugins, instrumented C + TS):
  - rank ORDERS match C exactly → pure x-coord divergence, not mincross.
  - `compressGraph`: `flip=0 p=(1152,720) x=1152` in BOTH. Width edge is
    NON-BINDING (natural compressed width ~1907 > 1152); compression is driven by
    the weight-1000 term identically. So size/flip is NOT the cause.
  - `containNodes` minlens match C every rank except rank-0 rLen (100 vs 99 = a
    1 pt node-width diff).
  - aux-edge counts identical (LR=132, pairs=318, total=471, wt 1612). Only the
    LR minlen SUM differs: TS 11380 vs C 11368 (**+12**).
  - That +12 = **9 nodes measured 0.5–1.03 pt wider than C** (VaxFrame,
    VaxGCommonFrame, Wire, UFileWr, AtomWr, WrClass, ProtectedWire, StreamWire,
    TextWr; sum 5.65 half-width × ~2 edges ≈ +11.3). Font-metric text measurer =
    accepted **A2 divergence** (docs/known-divergences.md:63).
  - **Forcing proof**: override those 9 widths to C's values → node-x 53/76 → 0/76
    AND `Target<->TThread` spline 7 pts → 4 pts (== C). `lrBalance` is faithful.
- **Impact**: NaN cannot reach |dx| ≤ 1 or structural-match without changing the
  shared font-metric measurer (out of scope — would regress hundreds of byte-
  match graphs) or the spline router (forbidden). NaN is the same class as
  proc3d/b69 except its x-shift happens to tip a spline segment count, pushing it
  to `diverged` rather than `structural-match`. Compress amplifies sub-pixel
  width error into pt-level x-shifts because weight-1000 makes separations bind.
- **Confidence**: High (oracle-instrumented both sides + forcing experiment).

## Oracle recipe used (reusable)
- C width/aux dump: instrument `make_aux_edge` (counter) + `contain_nodes` /
  `compress_graph` (per-rank fprintf) in lib/dotgen/position.c; rebuild
  `cmake --build . --target common_obj common && ... dot gvplugin_dot_layout`;
  refresh /tmp/gvplugins symlink; run `GVBINDIR=/tmp/gvplugins dot -Tsvg`.
- TS side: gate on `globalThis.COMPRESS_DEBUG`; force widths via
  `globalThis.FORCE_CWIDTH={name:halfwidth}` in nodeinit.ts storeNodeSize.
- node-x compare: ellipse cx by <title>; per-rank order by cy then cx.
- ALL instrumentation reverted; C rebuilt clean.
