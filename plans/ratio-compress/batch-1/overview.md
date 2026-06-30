<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — ratio=compress activation (in scope)

Wire `g.info.drawing` for `ratio=compress` so the already-ported `compressGraph`
machinery runs. Compress-only scope (ADR-1): no change to fill/expand/value/auto.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | `parseRatioKind` + populate `g.info.drawing` for compress in `dotGraphInit`; activate `compressGraph` | single (sonnet) | `src/layout/dot/init.ts`, `src/layout/dot/dot.test.ts`, `src/model/layoutParams.ts` (makeDrawing) | — | [x] commit `6ef3eeb` |

**Gate after batch:** typecheck + tests green; lizard clean; full survey diff vs
`/tmp/parity.before.json` → **0 regressions; NaN → conformant or maxDelta ≪ 1907;
b68/b22/polypoly/jsort/pgram/trapeziumlr unchanged**.
