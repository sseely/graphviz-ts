# Mission: x-coord network-simplex convergence on 2471 (Layer 3)

## Objective

Make `tests/2471.dot` render **end-to-end** in reasonable time with x-coords
**faithful to C**, by fixing the network simplex (`ns.ts`/`ns-core.ts`) that
**does not converge** on the now-correct mincross order. This unblocks the
committed mincross fixes (`b4e6afb`, `e6e2029`) so `feature/mincross-2471-faithful`
can finally merge.

## Carried-in facts (do NOT re-derive)

- **Mincross is solved** (this branch): `maxphase=2` renders 2471 in ~3.6s == C.
  Layers 1+2 were both `vStart`-window bugs, committed. See
  `../mincross-2471-faithful/batch-2/layer2-root-cause.md`.
- **Layer 3 (this mission):** `dotPosition` → `rank(g, 2, nsiter2(g))` (x-coord
  network simplex) hangs on the correct-order aux graph. `maxphase=2` completes,
  `maxphase=3` hangs → the hang is in position's NS, not mincross.
- `nsiter2` returns `INT_MAX`, **faithful to C** (C bounds only if `nslimit` set;
  2471 doesn't). **C's NS still terminates fast on the same graph** → a genuine
  TS network-simplex deviation, *exposed* (not caused) by the correct order. The
  pre-fix code "completed" only because its wrong order made a benign aux graph.
- NS loop: `rank2Loop` (ns.ts:416) pivots while `leaveEdge` returns a
  negative-cut tree edge; `enterEdge` picks the entering edge; `nsUpdate` pivots.
  Cut-value/low-lim maintenance in `ns-core.ts`.
- `maxphase` graph attribute (1/2/3) stops the pipeline after
  rank/mincross/position — the cleanest phase isolator.

## Branch

`feature/mincross-2471-faithful` (continue here; merge mincross + position
together once 2471 is end-to-end green).

## Constraints (faithful port; cardinal = parity + no churn)

- **Faithful-only fix** (ADR-1): port the exact deviation from `ns.c`. **No
  non-C iteration cap or tie-break heuristic** — that yields wrong x-coords.
- **Zero golden churn:** every other graph's x-coords stay byte-identical to C.
- **C source is sacred:** revert all C instrumentation;
  `git -C ~/git/graphviz status --porcelain lib/` clean before any commit
  (scope to `lib/` — root-level `.gitignore`/`.agent-notes/`/`.mcp.json` are
  pre-existing env artifacts, not source).
- **No existing NS test coverage:** `ns.test.ts`/`ns-core.test.ts` do not exist;
  T3's regression test is the first. Baseline suite (1876) is green.
- **Completion bar:** 2471 renders end-to-end < ~60s; x-order == C.
- Write-set pre-authorized: `{ ns.ts, ns-core.ts, +their tests }`.

## Quality gates

```
- command: npm run typecheck                          # pass: exit 0
- command: npm test                                   # pass: exit 0, >=1876 tests
- command: npm run build                              # pass: esbuild bundles
- command: git -C ~/git/graphviz status --porcelain lib/   # pass: empty (C source reverted; lib/ only — root env files don't count)
```

## Stop conditions

See [decisions.md](decisions.md#stop-conditions). Headline: classification =
faithful-but-slow → STOP & report (ADR-5) · 2 diagnostic rounds without a
localized deviation → STOP & document · non-C heuristic is the only fix → STOP ·
golden churn / any passing graph diverges → STOP/revert · file outside write-set
→ STOP · same site changed 3× → STOP.

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [1](batch-1/overview.md) | C x-coord oracle + pivot probe; reproduce; classify cycling vs slow | [x] |
| [2](batch-2/overview.md) | Localize the exact `ns.c` deviation (root-cause doc) | [x] — root cause found OUTSIDE NS write-set → STOP |
| [3](batch-3/overview.md) | Apply faithful fix + full 2471 end-to-end parity | [ ] — N/A (fix is not in NS; see STOP below) |

## OUTCOME — STOP (root cause is NOT in network simplex)

Batch 2 **falsified the brief's premise**. The TS network simplex
(`ns.ts`/`ns-core.ts`/`ns-range.ts`) is **faithful to `ns.c`**. The x-coord
**aux graph differs** from C: TS builds **333 fewer edges** (19695 vs 20028),
all from `keepout_othernodes`' **left scan**, which makes 0 edges (C makes 333)
because `keepoutLeft`/`keepoutRight` (`position-cluster.ts`) read the cluster
rank's first node as `.v[0]` **ignoring the `vStart` window offset** — the same
bug class as mincross Layers 1 & 2, now in the **position phase**. Those missing
cluster-containment constraints under-constrain the x-coord problem → the
(faithful) NS degenerate-cycles (≥500k pivots, ~42% degenerate) instead of
converging like C (24,543 pivots / 2.2 s).

**Fix is in `position-cluster.ts`, outside the write-set `{ns.ts, ns-core.ts}`
→ STOP for write-set authorization.** Full evidence + proposed fix:
[batch-2/ns-root-cause.md](batch-2/ns-root-cause.md). NS needs no change; Batch 3
(NS fix) does not apply. Tree left green + reverted (typecheck 0, 1876 tests,
build OK, C `lib/` clean).

## Index

- [decisions.md](decisions.md) — ADR-1..ADR-5, stop/push-forward
- [diagrams/data-flow.md](diagrams/data-flow.md) — position → NS pipeline + probes
- [diagrams/component-map.md](diagrams/component-map.md) — touched modules
- [decision-journal.md](decision-journal.md) — appended during execution
- **Prior art (read first):** `../mincross-2471-faithful/batch-2/layer2-root-cause.md`
  (Layer-3 localization + `maxphase` / oracle harness recipe) and
  `../mincross-2471-faithful/decision-journal.md`
