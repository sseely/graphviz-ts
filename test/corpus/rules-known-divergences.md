# Rules-survey known divergences (font-independent, pre-existing)

The **rules survey** compares the port (`EstimateTextMeasurer`) against native
`dot` run **headless** (no textlayout plugin → `estimate_textspan_size`). It
validates that the layout *rules* are faithful, with font metrics removed as a
variable (mission: text-measurement architecture, T0.2).

## Gate
`test/corpus/rules-gate.ts` compares the rules survey (`parity-rules.json`)
against the pango baseline (`parity.json`) **per graph**:

- **regression** — match in baseline → diverged/errored in rules → **GATE FAIL**
  (the estimate path made it worse; a real rules bug).
- **improvement** — diverged in baseline → match in rules (the kerning/hinting
  cases the decoupling fixes).
- **pre-existing** — diverged in **both** → font-independent (cluster/ranking/
  charset bugs unrelated to measurement). Listed below; **out of scope** for this
  mission (tracked elsewhere).
- **stable** — match in both.

The gate passes iff **regressions == 0**. Pre-existing divergences are documented
here, not chased.

## Full-corpus gate result (2026-06-25)
```
rules-gate: stable=603 improvements=10 pre-existing=168 allowlisted=3 regressions=0
GATE PASS
```
> The prior (2026-06-24) `599/171/4` figures were computed from a `parity-rules.json`
> generated against a **stale/cross-contaminated oracle cache** (the cache key was
> not namespaced by GVBINDIR, so the headless rules survey read the pango baseline's
> cached SVGs). Fixed in `survey.ts` (cache namespaced by binary+GVBINDIR+mtime); the
> regenerated rules survey is byte-match 392 (was a spurious 65). `pre-existing` drops
> to 168 because the concentrate fix flipped `graphs-b135/167/2087` in the pango
> baseline too.
- **improvements (10)** — diverged in pango, MATCH in rules = the font-measurement
  cases the decoupling fixes: `2193, graphs-NaN, graphs-b102, graphs-b143,
  graphs-xx, linux.i386-b102, share-NaN, share-b102, windows-NaN, windows-b102`.
- **pre-existing (171)** — diverged in BOTH; equals the pango baseline's 171
  diverged exactly (every baseline divergence is font-independent). Clusters
  (`1332`,`1323`,`clust5`), ports/arrows/weight, `Petersen`, etc. Out of scope.

## Allowlisted match→diverged (verified NOT a rules regression)
Encoded in `accepted-divergences.json` (scope `rules`), joined by `rules-gate.ts`
via `accepted.ts`. Each verified by direct node-position comparison (port
EstimateTextMeasurer vs headless dot):

| id | node-pos Δ | reason |
|----|-----------|--------|
| `graphs-structs` | **0.00** | the **dev-build oracle** (`/tmp/ghl`, `15.1.0~dev.20260610`, 82 commits past `15.0.0`) **loses** the `struct1:f2->struct3:here` edge — a `Pshortestpath` **regression** ("destination point not in any triangle") on the nested record head-port. **Stable graphviz 15.0.0 AND the port both render it** (edge1 is byte-identical to graphviz.org online). **Oracle-build regression, not a port bug.** childCount diff = the correct edge the dev oracle dropped; node geometry exact |
| `nshare-root_circo` | **0.00** (1054/1054) | full-SVG childCount + one edge `@d`; geometry exact |
| `nshare-root_twopi` | **0.00** (1054/1054) | full-SVG childCount + one edge `@d`; geometry exact |
| `2168_2` | 1.0 (node2 x) | node **widths match headless** (rx 34.64); residual 1pt is node2's x under a `:sw` compass-port edge — a pre-existing x-NS/compass-port gap the LUT's slightly-narrow widths masked, NOT a measurement regression |

The measurement deliverable is correct in every case (widths match headless); the
residuals are full-SVG emit artifacts or a font-independent x-NS edge case.

## Notes
- These graphs diverge for reasons independent of text measurement (e.g. cluster
  layout `1332`/`1323`, issue-test edge cases). They diverge under the current
  default (pango) survey too, so this mission neither fixes nor regresses them.
- Charset cases (`Latin1`, `Symbol`) are font-measurement and are covered by the
  Batch-2 bundled-font tests, not the rules corpus.
