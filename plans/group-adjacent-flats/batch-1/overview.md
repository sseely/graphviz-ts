# Batch 1 — Pin the C ordering contract + red test

One derisk task. Before any `src/` edit, lock the exact group membership +
ordering + `auxt`/`auxh` assignment from C (AD-1), and write the failing oracle
test that the implementation must turn green.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Instrument C to pin `#241_0` 2↔3 group membership/order/auxt; write the red `3:sw->2:se` aux-size-7 oracle test | debugger | `src/layout/dot/splines-flat-group.test.ts` (red), `plans/group-adjacent-flats/findings-ordering-contract.md` | — | [ ] |

The journal row is written by the orchestrator after the batch (one writer).

Exit criteria:
- The C dump pins, for `#241_0`'s 2↔3 adjacent-flat group: cnt, the ordered
  `edges[]`, `e0` (tn/hn), which clone is `auxt`/`auxh`, each clone's aux
  direction (fwd/back) and size. **`edges[0]` is confirmed = the forward edge**
  (else STOP per AD-1).
- A new failing test asserts the port routes `3:sw->2:se` with aux size 7 (or
  the equivalent final-SVG geometry the fix must produce). It is RED now and
  named so T2 turns it green. Forward `2:ne->3:nw` (size 7) is asserted as a
  guard (must stay green).
- Note for T2: the in-group sort comparator that reproduces C's `edges[0]`
  (forward/min-AGSEQ first), stated explicitly.
