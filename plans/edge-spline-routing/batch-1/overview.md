<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — Localize the divergence (spike)

The mission's crux: pin WHERE the long-edge spline gains an extra piece. No
production-code change — instrumentation + analysis only. Output is the
`#d-fixsite` decision and the filled-in T2 task spec.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| S1 | Instrument C `routesplines`/`Proutespline` + the port on the reproducer's diverging edge; diff box corridor, input points, endpoint slopes; pin the site | (executor inline; no subagent) | `plans/.../decisions.md` (#d-fixsite), `plans/.../batch-2/T2-fix.md`, `decision-journal.md`, scratch under `.probes/` | — | [x] |

Gate after batch: the `#d-fixsite` decision is filled with the instrumented
C-vs-port diff; T2's write-set + approach + acceptance are concrete; no
production source changed (`git diff --name-only main` empty except the branch
chore). If the diff shows the fitter (`route.ts`) is implicated after all,
**stop** — the premise is wrong, re-scope with the user.
