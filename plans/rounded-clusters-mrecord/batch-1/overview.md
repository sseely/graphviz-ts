<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — rounded-path rendering

One task. The shared helper extraction (AD-1) and its two call sites (cluster,
record) are a tightly-coupled unit: the helper's signature is defined by what
the cluster and record sites need, and the golden cannot conformant until both
wirings land. Splitting cluster vs record across tasks would force a frozen
helper interface mid-mission for no benefit. Kept whole, committed working.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Extract shared rounded-box path helper (`poly-shapes.ts`); wire cluster boundary (`device.ts`) and Mrecord/record box (`record.ts`); unit tests | implementation | `src/common/poly-shapes.ts`, `src/gvc/device.ts`, `src/common/record.ts`, and the modules' existing `*.test.ts` (check first) | — | [x] |

Execute solo (delicate faithful render port; default single-agent).

Gate after batch: `npx vitest run` (all pass), `npx tsc --noEmit` clean,
complexity hook clean; the three minimal repros (rounded cluster, Mrecord,
control box) conformant with the oracle — rounded cluster + Mrecord emit `<path>`,
the control box stays `<path>`, and a plain (non-rounded) cluster/record stays
`<polygon>`; node/cluster coordinates unchanged.

- [T1](T1-rounded-render.md)
