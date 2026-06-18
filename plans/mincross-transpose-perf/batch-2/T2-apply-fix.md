# T2 — apply the routed parity-preserving fix

## Context

graphviz-ts (faithful TS port of C graphviz; `~/git/graphviz` is the spec).
Batch 1 (T1) measured the transpose perf gap and routed this fix. Read the T1
journal row first — it names the dominant cause (AD-4: a/b/c) and the exact
target site. The cardinal rule (AD-1): **output node order must stay
byte-identical to C.** A faster result with a changed order is a failure.

## Task

Apply the parity-preserving fix to the routed cause (AD-5 — mirror C, do not
improve on C):
- **(a)** align `transpose`/`transposeStep` candidate + `delta` logic with C so
  the loop converges in C's pass-count.
- **(b)** correct the non-convergence (delta oscillation) to mirror C's
  termination — **without changing swap legality/order** (else STOP, re-plan).
- **(c)** reuse buffers mirroring C's `TI_list`/`Count`, remove the per-pair
  `[0,0]` allocation in `transposeCounts`, hoist repeated `info.*` into locals.

Add unit tests locking the equivalence the fix relies on.

## Read-set

- `decision-journal.md` (T1 routing row — the target) — read first
- `src/layout/dot/mincross-cross.ts:transpose,transposeStep,transposeCounts,accumCross,rcross,exchange`
- `src/layout/dot/mincross-order.ts:mincrossStep,mincrossIter` (if cause a/b)
- C anchors: `mincross.c:632-688` (transpose/transpose_step),
  `mincross.c:583-630` (in_cross/out_cross), `mincross.c` init buffers
- `decisions.md#ad-5` (match-C principle)

## Write-set

Only the routed file(s) of: `mincross-cross.ts`, `mincross-order.ts`,
`mincross-utils.ts`, `fastgr.ts` + their `*.test.ts`. Nothing else without
re-planning (STOP condition).

## Architecture decisions (locked)

AD-1 parity invariant; AD-5 match-C; AD-2 write-set. Locked — log conflicts to
the journal, do not silently override.

## Interface contracts

No external interface change. Internal: any new reused buffer lives on the
`MincrossContext` (or a module-scope reused array, mirroring C's file-statics);
its per-call semantics must equal the prior fresh-allocation semantics.

## Acceptance criteria

- **Given** the routed cause, **when** the fix is applied, **then** the
  benchmark transpose time drops materially vs the pre-fix bundle (record the
  factor in the journal).
- **Given** mc3 and the mid-size benchmark, **when** rendered, **then** per-rank
  order is **byte-identical to C** (oracle order-probe diff, reverted after).
- **Given** the full suite, **when** `npx vitest run`, **then** all pass with
  **zero golden churn** (any churn whose new value ≠ C → STOP).
- **Given** the fix relies on an equivalence (reused buffer, pass-count), **when**
  a unit test exercises it, **then** the test asserts the equal value/decision
  and was verified RED against the un-optimized form.

## Observability

N/A — library-internal.

## Rollback

Reversible — revert the commit; no data/API/schema/output change.

## Quality bar

`npx tsc --noEmit` → 0; full suite green, zero golden churn; hook limits (30
lines/fn, CCN 10, 500/file); order-probe == C. Probes reverted.

## Commit

`perf(T2): <one-line fix> — transpose <Nx> faster, order unchanged`.
Body: cause, mechanism, measured factor, parity evidence.
