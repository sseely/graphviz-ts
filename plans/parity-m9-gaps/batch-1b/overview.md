# Batch 1b — stop-resolution residuals (added 2026-06-11)

T3b + T1b run in parallel; T5b runs after both and owns test/golden/.
Created from Scott's stop-resolution rulings (see decision journal).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3b | twopi self-loop bb: C-faithful update_bb_bz in clipAndInstall ([T3b-twopi-bb-clip.md](T3b-twopi-bb-clip.md)) | sonnet | src/common/splines-clip.ts, caller threading (src/layout/neato/splines.ts), co-located test, .probes/* | — | [x] |
| T1b | dot-minlen 4.32pt offset: debug + fix ([T1b-dot-minlen-offset.md](T1b-dot-minlen-offset.md)) | sonnet | as root cause dictates, EXCEPT T3b's files and test/golden/; co-located test; .probes/* | — | [x] |
| T5b | promote dot-minlen + twopi-self-loop ([T5b-promote-goldens.md](T5b-promote-goldens.md)) | orchestrator (inline) | test/golden/manifest.json, test/golden/suite.test.ts, test/golden/inputs/*, test/golden/refs/*, test/golden/quarantine/* | T3b, T1b | [x] |

Closed 2026-06-11: both goldens PASS maxDelta=0 and promoted (manifest
60→62); suite 1098/0. Commits: T3b, T1b, T5b (see journal).

Conflict control: T1b is forbidden from touching T3b's two files; if its
root cause lands there, it stops and reports instead (orchestrator
serializes a follow-up).
