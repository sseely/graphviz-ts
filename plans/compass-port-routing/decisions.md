# Architecture decisions — compass-port-routing

## AD-1 — Match C exactly
Context: this is a faithful TS port; `~/git/graphviz` (tag 15.1.0) is the spec.
Decision: port the exact C branch (side-effect order, edge cases, `file:line`
JSDoc); no optimization, simplification, or reordering.
Consequences: byte/structural parity with the oracle; oddities preserved.

## AD-2 — Diagnose before fixing
Context: prior missions proved divergences are usually "my port differs from C
here," found in minutes by dumping C's actual intermediate values (memory
`instrument-c-before-quarantine`).
Decision: Batch 1 instruments native C dot (rebuild `gvplugin_dot_layout` →
`/tmp/gvplugins`) and dumps `ED_head/tail_port.p`, the begin/endpath box, and
the routed spline for #2168 and #241_0, plus the port's, BEFORE editing `src/`.
Consequences: T3/T4 fix exactly the named branch; no speculative edits.

## AD-3 — Oracle-pinned, curated gate untouched
Context: 128 curated goldens are the byte-exactness backstop; bucket counts
re-bucket misleadingly (memory `bucket-fix-rebucketing`).
Decision: verify per-input vs the native oracle SVG; judge by per-id verdict
deltas (0 regressions); never modify `suite.test.ts`/`manifest.json` or
regenerate refs.
Consequences: a fix that regresses any id or changes any golden is rejected.

## AD-4 — Scope discipline (STOP guard)
Context: the routing-position bucket is ~149 genuinely-hard cases; the last
mission's Batch 2 correctly STOPPED rather than start a routing rewrite.
Decision: if T1/T2 show the divergence is NOT an isolated compass-port
endpoint/box branch (compassPort offset, begin/endpath, or the flat-edge box)
but a deep multi-cause routing rewrite, STOP and report as a follow-on. Do NOT
expand into a general spline-routing rewrite.
Consequences: bounded mission; honest partial delivery is acceptable.
