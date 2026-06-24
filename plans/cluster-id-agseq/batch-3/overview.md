<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 3 — survey verify + regen

Run the corpus survey, confirm the 7 targets flip with 0 net regressions, and
regenerate the parity dashboard. T4 is **contingent** — execute it only if T3
identifies edge-endpoint-subgraph seq drift as the cause of a missed flip or a
guard regression.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Run survey + dashboard; verify 7 flips / 0 regressions; write decision-journal entry | sonnet | `test/corpus/PARITY.md`, `test/corpus/parity.json` (generated) | T2 | [x] |
| T4 | (CONTINGENT) seq-advance edge-endpoint subgraphs in `resolveEndpoint` | sonnet | `src/parser/builder.ts`, `src/parser/builder.test.ts` | T3 | [N/A] |

Gate after batch: survey shows the 7 named targets no longer in `diverged`;
`clust*`/`labelclust*` byte-match set unchanged; net byte+structural match count
does not decrease.
