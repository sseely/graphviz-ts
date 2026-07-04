# Architecture decisions (locked)

## D1 — Diagnosis-first batches
Context: 5 of 8 root causes unknown; parallel fixes need non-overlapping
write-sets that can't be pinned until mechanisms are known.
Decision: Batch 1 is diagnosis-only (mechanism notes, instrumentation reverted
before task end). Batch 2 fix tasks are authored from those notes; fixes
touching the same file collapse into one task.
Consequences: no write conflicts; no fix-before-mechanism; slightly longer
wall-clock.

## D2 — NS-core change gating
Context: fixes for 1447 / graphs-b51 / 2475_2 may touch `ns.ts` / `position.ts`
aux-graph code shared by every dot graph — highest regression surface in the
port.
Decision: NS-core/position fixes are allowed, but each lands as its OWN commit
followed immediately by a full corpus survey (`npm run survey && npm run
survey:gate`). Any verdict regression → revert that commit before proceeding.
Consequences: more survey runs; individually revertible NS changes.

## D3 — 2620 bounded to ordering conformance
Context: 2620/2361 root cause already pinned (equal-cost maze corridor
tie-break; Dijkstra exploration order via snode index / `adjEdgeList`
insertion order from maze cell construction).
Decision: F1 may change only maze/sgraph BUILD/INSERTION ORDER to match C's
(`ortho.c`/`sgraph.c` construction sequence). No cost-model, relax, or fPQ
algorithm changes (those are verified faithful). If ordering conformance
demands more, STOP and document tracked-deep with evidence.
Consequences: bounded blast radius (src/ortho/ only); may end as a documented
non-fix.

## D4 — No new accepted-divergence entries without proof
Context: byte-match is the bar (memory: byte-match-is-the-bar); accepted
entries require proven irreducibility.
Decision: deep-class outcomes stay TRACKED (notes + PARITY backlog), not
accepted — unless diagnosis proves an upstream oracle bug (A4-style), in which
case write the `accepted-divergences.json` entry + `docs/known-divergences.md`
prose pair (the guard test enforces pairing).
Consequences: bucket count may not reach 0 this mission; honesty over optics.

## D5 — Baseline refresh cadence
Decision: refresh `parity.json`/`PARITY.md` via the Estimate + `/tmp/ghl`
recipe once per fix batch and once at mission end. Judge every refresh by
PER-ID verdict deltas (memory: bucket-fix-rebucketing) — zero regressions —
not by bucket counts.
