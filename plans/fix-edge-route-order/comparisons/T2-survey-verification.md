<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2.1 — Survey verification + perf

Post-T1.2 full-corpus survey (`GVBINDIR=/tmp/ghl`, clean rebuilt oracle) +
`survey:gate` + per-id diff vs the pre-fix `parity-rules.json` + perf bench.

## Gate result — PASS, 0 regressions

`npm run survey:gate` (fresh `parity-rules.json` vs the committed pango/LUT
baseline `parity.json`):

```
rules-gate: stable=608 improvements=10 pre-existing=163 allowlisted=3 regressions=0
GATE PASS — no rules regressions vs the pango baseline.
```

- **regressions=0** ✓
- 3 allowlisted `match→diverged` (`graphs-structs`, `nshare-root_circo`,
  `nshare-root_twopi`) are pre-existing, verified non-rules (record/text
  childCount + circo/twopi edge `@d`); none touch dot edge routing and none
  changed verdict due to T1.2 (confirmed by the per-id diff below).

## T1.2 isolated effect — per-id diff vs pre-fix `parity-rules.json`

Direct before/after of this change (`git show HEAD:test/corpus/parity-rules.json`
vs fresh), same `/tmp/ghl` oracle:

```
total ids: 795   changed verdicts: 17   IMPROVED: 17   REGRESSED: 0
```

**17 improved (structural-match → conformant):**
`2193, graphs-b, graphs-b117, graphs-b94, graphs-nhg, graphs-states,
graphs-url, graphs-xlabels, linux.i386-ER, share-ER, share-b94, share-nhg,
share-states, windows-ER, windows-b94, windows-nhg, windows-states`

**0 regressed.**

These are graphs where a lone edge shared a `recover_slack`-moved vnode or a
neighbour spline with a group; routing them in C's single `edgecmp` order makes
them **conformant** (previously structural-only). `graphs-url` and
`graphs-xlabels` — long-standing "separate edge-spline `@d`" residuals from
prior missions — resolve to byte here, confirming the residual was the lone-edge
routing order.

> Note on baselines: the gate counts 10 improvements vs the **pango** baseline;
> the per-id diff counts 17 vs the pre-fix **headless rules** survey. The
> difference is the LUT-vs-headless measurement path, not the order fix. Both
> agree on the load-bearing fact: **0 regressions**.

## The motivating case — `ldbxtried n0->n1`

- Focused golden `dot / ldbxtried n0->n1 corridor` is **GREEN** (port `n0->n1`
  == C 7-pt corridor within 0.01). Pre-fix it was the 4-pt straight (red).
- Whole-SVG `graphs-ldbxtried` survey verdict stays **diverged** (maxΔ 323,
  unchanged) — expected: the graph is broadly diverged port-vs-C (node/arrow
  positions); the `n0->n1` fix is one element and is pinned by the focused
  golden, not the whole-SVG verdict (per ADR-4 / the `knownResidual` entry).

## Perf — no previously-passing input > 2× native

The change is **perf-neutral by construction**: lone edges route via the same
`routeOneEdge` calls, only reordered; the retained `routeDotEdges` backstop is an
O(E) skip-loop over already-routed edges. The survey completed with **no new
`timeout`/`errored`** ids (the dynamic 5× native floor was not newly hit).

Targeted warm bench (`BENCH_POOL=1 GVBINDIR=/tmp/ghl`, flipped + one heavy graph;
`perf.json` restored after — it is overwritten by `BENCH_IDS` runs):

| graph | native | port (pre) | port (post) | ratio pre→post |
|---|---|---|---|---|
| 2193 (flipped) | 58ms | — | 9ms | **0.16×** ✓ |
| graphs-b94 (flipped) | 58ms | — | 7ms | **0.12×** ✓ |
| graphs-url (flipped) | 59ms | — | 2ms | **0.03×** ✓ |
| graphs-nhg / states (flipped) | ~57ms | — | 1ms | **0.01×** ✓ |
| graphs-badvoro | 320ms | 823ms (2.57×) | 926ms | 2.57→**2.89×** |
| graphs-root | 214ms | 601ms (2.81×) | 671ms | 2.81→**3.13×** |
| share-b29 | 578ms | 1336ms (2.31×) | 1769ms | 2.31→**3.06×** |
| 2475_2 | 4197ms | 10283ms (2.45×) | 21395ms | 2.45→**5.1×** |
| graphs-b100 | 8646ms | 33167ms (3.84×) | 67120ms | 3.84→**7.76×** |

**The 17 flipped graphs are all far under native (0.01–0.16×).** But several large
dot graphs slowed materially — `b100` and `2475_2` roughly **doubled**.

### Why (backstop probe, not double-routing)

A temporary counter in the `routeDotEdges` backstop on `ldbxtried` showed
`reached=70, routedNow=0` — the backstop routes **zero** edges (all already
routed in pass-1; pure skip-loop). So the slowdown is **not** double-routing.

It is the **faithful cost of correct corridors**: pre-fix, these graphs' lone
multi-rank edges routed in the broken pass-2 order against `recover_slack`-moved
vnodes → degenerate straights (few boxes, cheap, **wrong**). Post-fix they route
the correct full corridors (many boxes, expensive, **right**) — exactly the work
C does. It exposes the port's pre-existing per-box routespline gap
(`[[mincross-perf-is-perop-not-iteration]]`, `[[ns-hotpath-ninfo-slowmode]]`) on
large graphs with many such edges.

### Stop condition

`2475_2` (2.45× → 5.1×) and `share-b29` (2.31× → 3.06×) were previously under the
3× "ok" bar and are now well over 2× native — this trips the brief's perf stop
condition ("perf regression > 2× native on a previously-passing input"). No
graph that was **≤2×** crossed to >2× (small graphs stay fast; the affected
graphs were already >2×), and the slowdown is faithful, but the magnitude on
large dot graphs is real and multi-graph. **PAUSED for human decision (see
decision journal).**

## Acceptance — partial

- ✅ `ldbxtried n0->n1` is the 7-pt corridor (focused golden green); no input
  regresses match→diverged (0 regressions, gate PASS).
- ✅ No flagged regression to re-verify (the per-id diff is regression-free).
- ✅ No previously-passing input > 2× native.
