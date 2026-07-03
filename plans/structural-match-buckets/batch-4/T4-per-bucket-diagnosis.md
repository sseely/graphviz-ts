<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 (template) — diagnose one structural-match bucket

Instantiate once per element-kind bucket (`{{KIND}}`). Each agent owns exactly
one output file `analysis/bucket-{{KIND}}.md` — no shared writes.

## Prior observations (inject verbatim; do not re-derive)

Known residual families for the corpus (evidence in `.agent-notes/` + auto-memory):
- **LR_balance degeneracy** over feasible-tree state → node/edge **x** drift
  (1447, 2239, 2475_2). The AGSEQ-iteration + ufUnion substrate fixes already
  landed; this is the *next* layer, not "NS pivot order".
- **ltail/lhead pre-clip splines** — edge `@d` drift near an endpoint clip (1879).
- **ortho maze equal-cost tie-break** — `splines=ortho` edge `@d`; maze
  CONSTRUCTION order already ruled out; candidates = routing-order × updateWts or
  cost divergence (2361, 2620).
- **per-rank spacing** — a uniform offset per rank (1718); virtualNode-id
  disproven.
- **hypot ULP (Apple libm)** — ≤~10pt on one flat-edge arc (2368, accepted A3).
- **xcoord-NS int-truncation** of resolved ranks (honda; done — watch for residue).

## Context

`graphviz-ts` is a faithful TS port of Graphviz; the C source at `~/git/graphviz`
is the spec. This is **diagnosis, not fixing** — attribute each case to a
mechanism; do not change port source. The 163 structural-match cases have an
identical SVG element tree vs the native oracle and differ only in numeric
coordinates above ±0.01. `parity.json` now carries `maxDeltaPath` (worst-diff
XPath) and `maxDelta` per case.

## Task

For the `{{KIND}}` bucket, produce `analysis/bucket-{{KIND}}.md` that:

1. **Lists every case** in the bucket: `id · maxΔ · maxDeltaPath`, worst-first.
   Get the set from `parity.json` (`verdict==='structural-match'` and
   `structuralKind(maxDeltaPath)==='{{KIND}}'` — same mapping as dashboard.ts).
2. **Sub-clusters** by shared DOT-source features + magnitude — inspect each
   input's `.dot` (under `~/git/graphviz/tests/`) and its cached oracle SVG
   (`$TMPDIR/dot-corpus-oracle/<sig>/<id>.svg`) for the discriminating features:
   clusters? flat edges? records/ports? `rankdir`? `splines=ortho`? concentrate?
   Note the enclosing SVG element `class` (edge/node/cluster/arrowhead) at
   `maxDeltaPath` — this is the semantic attribution the coarse auto-bucket lacks.
3. **Attributes** each sub-cluster to a known family (list above / README seed
   catalog / `.agent-notes/`) **or** flags it `NOVEL` — but only after naming
   which known families were ruled out and why (one line each). Cite the
   `.agent-notes/` file or memory slug for every family claim (decisions.md#ad-5).
4. **Rates tractability** per sub-cluster: `known-mechanism` (a prior note names
   the fix locus) / `needs-C-instrumentation` / `accepted-portability` (libm/ULP).
5. Ends with a **bucket summary line**: `{{KIND}}: N cases → M sub-clusters;
   K attributed, J novel; top candidate = <family> (n cases)`.

Use Serena symbol tools for any port-code navigation; `sg` for structural
searches. Read only the case inputs/SVGs you need — do not bulk-load the corpus.

## Write-set

- `analysis/bucket-{{KIND}}.md` (this agent's only writable file).

## Read-set

- `test/corpus/parity.json` (the bucket's rows), `test/corpus/dashboard.ts`
  (`structuralKind` mapping to match the auto-bucket exactly).
- Per case: `~/git/graphviz/tests/<id>.dot` and the cached oracle SVG.
- `.agent-notes/*.md` relevant to the family (grep by feature keyword).
- `README.md#known-mechanism-families`, `decisions.md#ad-5`.

## Interface contract (consumed by T5)

Each `bucket-{{KIND}}.md` must contain, in a fenced block near the top, a machine-
greppable summary table:

```
| sub-cluster | ids | count | family | tractability | ref |
|---|---|---:|---|---|---|
```

`family` ∈ {LR_balance, ltail-preclip, ortho-tiebreak, per-rank-spacing,
hypot-ulp, xcoord-ns, NOVEL, other-named}. `tractability` ∈ {known-mechanism,
needs-C-instrumentation, accepted-portability}. `ref` = `.agent-notes/` file or
memory slug (or `—` for NOVEL).

## Acceptance criteria

- **Given** the `{{KIND}}` bucket, **when** the file is written, **then** every
  structural-match id of that kind in `parity.json` appears exactly once.
- **Given** a family attribution, **when** reviewed, **then** it cites a concrete
  `.agent-notes/` file or memory slug, **or** is marked `NOVEL` with ≥1 ruled-out
  family and its evidence.
- **Given** the summary table, **when** parsed, **then** its `count` column sums
  to the bucket's case count.

## Boundaries

- **Never** edit port source, `parity.json`, or another agent's `bucket-*.md`.
- **Never** propose a fix diff — attribution only (this mission does not fix).
- **Ask first** only if a case's oracle SVG is missing from cache (needs a survey
  re-run) — do not silently skip it.

## Quality bar

Return only the structured result. One commit per agent:
`docs(T4-{{KIND}}): diagnose structural-match {{KIND}} bucket`.
