<!-- SPDX-License-Identifier: EPL-2.0 -->

# Triage: the 34 "estimate-path @d divergences" → oracle-cache artifact (not bugs)

## Question
Refreshing `parity-rules.json` after the concentrate fix surfaced 34
`match → diverged` inputs (all firstDiff `path/@d`, several maxΔ in the
thousands). Are any real port-vs-C layout bugs?

## Answer: none. All 34 were a survey-harness oracle-cache artifact.

### Root cause (harness bug, now fixed)
`survey.ts` cached the native `dot` oracle SVG under `${CACHE}/${id}.svg` with a
cache dir **not namespaced by oracle**. Two consequences:

1. **Cross-contamination.** The headless rules survey (`GVBINDIR=/tmp/ghl`) and
   the pango baseline (`GVBINDIR=/tmp/gvplugins`) shared one cache keyed only by
   `id`. Whichever ran first populated it; the other read the **wrong oracle's**
   SVGs. The committed `parity-rules.json` had conformant **65** because the
   estimate port was being diffed against **pango** oracle output.
2. **Staleness on rebuild.** Entries are only written when absent, so a rebuilt
   `dot` (binary Jun-24 vs cache Jun-23) was never refreshed.

### Proof
Re-ran both surveys with **isolated** caches (`ORACLE_CACHE` per oracle) on a
**fresh** Jun-24 oracle:

| Survey | committed (contaminated) | fresh isolated |
|---|---|---|
| rules (`parity-rules.json`) | byte 65 / div 165 | **byte 392 / div 161** |
| baseline (`parity.json`) | byte 338 / div 171 | byte 344 / div 168 (== committed refresh, **0 diff**) |

- **All 34** flagged inputs are `conformant`/`structural-match` in the fresh rules
  survey (`now-match=34, still-diverged=0`).
- Spot-check vs fresh C (`badvoro`, `b94`, `xlabels`, `dpd`/`overlap`, the
  `*_neato`/`*_overlap_neato` family): **0 node-geometry mismatches, conformant
  `@d`** — they match fresh C exactly. The survey's huge maxΔ (1153, 324, …) was
  the delta against the stale cached oracle, not against current C.
- **`rules-gate` PASS** on the fresh files: `stable=603 improvements=10
  pre-existing=168 allowlisted=3 regressions=0`.
- The committed `parity.json` (chore `31f6ea5`) is **validated** — identical to the
  fresh isolated pango run (0 verdict diffs).

## Disposition
| Bucket | Count | Disposition |
|---|---|---|
| Stale/cross-contaminated cache false positive | 34 | **Not a bug.** Resolved by the cache-key fix + correct `parity-rules.json`. |
| Real new layout/spline bug | 0 | — |

No allowlist entries needed; no real bugs to track. (`graphs-NaN` compress and
the A2 text-measurement residuals remain accepted deltas where genuinely present,
but none of the 34 are real regressions vs a correct oracle.)

## Changes landed
- `test/corpus/survey.ts` — default oracle cache namespaced by
  `sha1(binary, GVBINDIR, binary-mtime)`; explicit `ORACLE_CACHE` still wins.
- `test/corpus/parity-rules.json` — regenerated against the correct headless
  oracle (conformant 65 → 392; gate green).
- `test/corpus/rules-known-divergences.md` — gate figures refreshed (603/168/3).
