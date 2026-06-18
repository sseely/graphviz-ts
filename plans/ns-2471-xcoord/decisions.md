# Architecture decisions

## ADR-1 — Faithful-only fix; no non-C anti-cycling caps
- **Context:** C's `ns.c` converges on the same aux graph; TS does not.
- **Decision:** Port the exact deviation from `ns.c` (Search_size rotating
  index, `leave_edge`/`enter_edge` selection, cut-value + low/lim maintenance).
- **Consequence:** A non-C iteration cap or tie-break heuristic is FORBIDDEN —
  it would produce wrong x-coords. Slower-but-correct beats fast-but-divergent.

## ADR-2 — Verify against native C, not WASM/approximation
- **Decision:** Oracle = spawned native C `dot` x-coordinates; compare TS
  x-order/coords to C on the repro and on 2471. Reuse the 3-dylib `/tmp/gvmine`
  recipe (`[[oracle-native-not-wasm]]`).
- **Consequence:** Exact comparison, no approximation.

## ADR-3 — Diagnose on 2471 with a pivot-trajectory probe; `maxphase=3` isolation
- **Context:** The hang is 2471-scale (synthetic graphs converged in the
  Layer-2 session).
- **Decision:** Instrument `rank2Loop` to record pivot count and whether
  `leaveEdge`/`enterEdge` cycle (re-selecting edges / non-decreasing weight).
  Attempt a minimal repro but expect 2471-structure-specific.
- **Consequence:** Mirrors the successful Layer-2 method.

## ADR-4 — Continue on feature/mincross-2471-faithful
- **Decision:** Land the NS fix as commits on the existing branch; mincross +
  position merge to main together once 2471 is end-to-end green.
- **Consequence:** The full 2471 story stays in one branch.

## ADR-5 — Faithful-but-slow ⇒ STOP and report
- **Context:** The deviation might be performance, not correctness.
- **Decision:** If diagnosis shows TS is faithful to `ns.c` but genuinely slow
  at 2471 scale, treat it as a STOP: document, do NOT add non-C optimizations.
- **Consequence:** Preserves spec fidelity; perf work becomes a separate,
  explicitly-authorized decision.

## Rollback
- **Reversible.** Branch unmerged; commits revert cleanly. No data migration.
  C source untouched.

## Stop conditions
- Classification = **faithful-but-slow** → STOP & report (ADR-5).
- **2 diagnostic rounds** without a localized C-vs-TS deviation → STOP, document,
  leave tree reverted.
- The only fix needs a **non-C heuristic/cap** → STOP (ADR-1).
- A fix **churns a golden** / makes any passing graph's x-coords diverge → STOP.
- A fix needs a file **outside the write-set** (`ns.ts`/`ns-core.ts`/tests) → STOP.
- **Same site changed 3×** without converging · **2 consecutive gate failures**.
- C instrumentation **cannot be reverted cleanly** → STOP.

## Push-forward (decide alone)
- Adding/removing temporary diagnostic probes (reverted before commit).
- Building the C x-coord oracle, choosing repro graphs, rebuilding `/tmp/gvmine`.
- Reverting C instrumentation.
- Minor mechanical refactors to satisfy the complexity hook (file/CCN caps).
