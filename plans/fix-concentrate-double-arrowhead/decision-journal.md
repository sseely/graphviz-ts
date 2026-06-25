<!-- SPDX-License-Identifier: EPL-2.0 -->

# Decision journal

Appended during execution. One row per non-trivial judgment call.

| Date | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-25 | batch-1 | Execute T1 then T2 directly (single-agent), not via dispatched sub-agents | Two sequential tasks, no parallel bottleneck; parallelism.md defaults to single-agent. Full C spec + context already loaded; the critical risk (headless-oracle golden generation) benefits from staying in the loop. |
| 2026-06-25 | T1 | Golden ids `concentrate-b135` / `concentrate-167`; refs from headless oracle (`GVBINDIR=/tmp/ghl`, present from today) | Matches ADR-4; descriptive ids independent of corpus survey ids. |
| 2026-06-25 | T1 | Bumped `suite.test.ts` count assertion 160→162 (file not in T1 write-set) — pushed forward, did not stop | The manifest-length assertion is mechanically coupled to adding manifest entries; the brief's write-set omitted it as an oversight. Change is trivial/obvious (push-forward: self-evident fix). Not in any other task's write-set. |
| 2026-06-25 | T1 | Skipped the optional `src/common/splines-clip.test.ts` unit test | `SplineClipHelper` is a non-exported class; a unit test would require exporting internals or going through render — the render path is exactly what the two byte-exact goldens already cover (both arrowhead emit AND spline clip). Brief says prefer golden / do not over-build. |
