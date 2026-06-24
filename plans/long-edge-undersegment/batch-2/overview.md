<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — Fix the localized divergence

Apply the S1-localized fix, pinned to instrumented C. Single task; write-set is
filled in by S1 (the file is unknown until then).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | The localized change (smode segmentation / box corridor / splinefits) pinned to instrumented C, + TDD test + golden capturing a long edge that now matches the oracle piece count | (executor inline; no subagent) | `<src file S1 names>` + `<same>.test.ts` + `test/golden/inputs|refs/dot-long-edge-undersegment.*` + `test/golden/manifest.json` + `test/golden/suite.test.ts` (count) | S1 | [ ] |

Gate after batch: `tsc` clean; `vitest` green incl. the new test/golden; the
reproducer `sleep--runmem` matches the oracle's 4-cubic piece count; ≥2
currently-matching edges verified byte-unchanged.
