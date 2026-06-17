# Batch 1 — Deep C control-flow trace (gates the fix)

Single task, investigation-only (one new doc, no logic change). Produces the
line-cited C-vs-TS trace that AD-1 requires before any fix. This batch's output
DEFINES T3's write-set and the exact faithful change.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Trace how C routes a cluster node in a cross-cluster `rank=same` set; pinpoint the TS divergence | opus | `docs/newrank-c-trace.md` | T0 | [ ] |

Commit: `docs(T1): trace C newrank cross-cluster rank=same routing`.
