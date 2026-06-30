<!-- SPDX-License-Identifier: EPL-2.0 -->

# Future: per-engine conformance harnesses + qsort tie-order audit

## Idea (one line)
Bring every non-`dot` layout engine up to the same conformance rigor `dot` has
(a headless native oracle + differential survey + per-id verdict baseline), and
— as part of standing up each harness — finish the **stable-sort vs libc
`qsort` tie-order audit** for that engine's sort sites.

## Background: the qsort tie-order class of bug
C graphviz sorts via libc `qsort` (and `gv_sort`, a `qsort_r` wrapper) — both
**unstable**. Where a comparator can return `0` for two *distinct* elements
**and** downstream logic depends on their order, JS's **stable**
`Array.prototype.sort` diverges from the native oracle. This was the root cause
of the `graphs-mike` divergence: in `dot`'s network-simplex `TB_balance`, the
stable sort flipped an equal-rank tie and placed a node one rank too high
(commit `0cda4fb`; conformant 525→533, 18 graphs fixed).

The fix is `src/util/bsd-qsort.ts::gvQsort` — a faithful port of the
Bentley-McIlroy/BSD `qsort` (median-of-3 pivot, pseudo-median of 9 above 40,
three-way partition, insertion sort below 7), verified to reproduce the macOS
oracle's permutation byte-for-byte. Convert a `.sort()` to `gvQsort` **only**
where the comparator can tie distinct elements AND the C site uses `qsort`;
elsewhere stable sort is correct and preferred.

### Status of the audit
- **dot + dot-reachable (pack, ortho): DONE.** `ns.ts:tbSortNodes` (the mike
  fix), `pack` (poly-pack / array-pack / poly-place), `splines-flat-labeled`,
  and `ortho/index.ts:edgeCmp` are converted and survey-verified (0 regressions).
  The remaining dot/pack/ortho sorts use unique keys (`id`/`seq`/AGSEQ/`ND_order`/
  `(i,j)`/loop-index) or integer values (tied elements identical) → tie-safe.
- **All other engines: PENDING — gated on building their harness.** Converting
  these now would be faithful but **unverifiable** (no oracle to diff against),
  so each is deferred to its engine's harness so the change can be proven against
  the native oracle the same way the dot ones were.

## The dot harness, as the template to replicate
Each engine needs the same five pieces `dot` already has:
1. **Headless native oracle.** `test/corpus/gen-headless-gvbindir.sh` builds a
   GVBINDIR with only `core` + the layout plugin (no pango/gd/quartz) so native
   graphviz falls back to `estimate_textspan_size` — the deterministic,
   font-independent text metric the port's `EstimateTextMeasurer` reproduces.
   Per engine: run native with `-K<engine>` (neato/fdp/sfdp/circo/twopi/osage/
   patchwork) against the same headless GVBINDIR.
2. **Corpus subset that exercises the engine.** `test/corpus/` enumeration filters
   to `applicable` inputs; add an engine dimension (graphs that target / make
   sense under `-K<engine>`).
3. **Differential survey.** `test/corpus/survey.ts` renders each input through the
   oracle and the port subprocess and diffs with `test/golden/compare.ts`
   (`deterministic` tolerance ±0.01). Parameterize by engine.
4. **Per-id baseline + verdict.** A `parity-<engine>.json` baseline + the per-id
   regression diff (rank conformant>structural>diverged); refresh via
   `dashboard.ts` → `PARITY.md`.
5. **The qsort audit, verified.** With the oracle in place, convert the engine's
   tie-capable sort sites (below) to `gvQsort` and confirm 0 regressions —
   exactly the loop used for the dot/pack/ortho sites.

> Note: engines that lean on iterative force/stress solvers (sfdp, neato SGD/
> majorization) may need a tolerance/seed strategy beyond `dot`'s ±0.01 (matched
> PRNG + `fma`; see `[[sfdp-oracle-and-fp-stability]]`). Scope that per engine.

## Per-engine qsort-tie sites to convert + verify (when each harness lands)

### fdp (`-Kfdp`) — 1 site
- `src/layout/fdp/ports.ts:83` `erecs.sort(ecmp)` — `ecmp` returns 0 on equal
  `(alpha, dist2)`. C `lib/fdpgen/layout.c:573 qsort(erecs, ecmp)`. **Convert.**
- Tie-safe (skip): `fdp/grid.ts` (`(i,j)` unique per cell — C `ijcmpf`),
  `fdp/comp.ts` (`id` unique).

### neato / fdp shared — vpsc (`-Kneato`, IPSEP/overlap removal) — 2 sites
- `src/vpsc/SweepLine.ts:173` and `:200` `events.sort(compareEvents)` — verify
  whether `compareEvents` ties distinct sweep events; if so, match the C vpsc
  `qsort`. **Verify + likely convert.**

### neato (`-Kneato`) — C sites to port-audit
The neato port currently has no `.sort()` on these paths; when the relevant
neatogen passes are exercised/ported, audit these C `qsort` sites for tie-capable
comparators and matching port sorts:
- `lib/neatogen/adjust.c:193 qsort(scomp)` (Voronoi site y/x).
- `lib/neatogen/constraint.c:710 qsort(sortf)` (x/y).
- `lib/neatogen/legal.c:273 qsort(gt)` (pos x/y).
- `lib/neatogen/overlap.c:128 qsort(comp_scan_points)` (scan x/node).
Each has a multi-key tiebreak, so ties are narrower but possible on coincident
coordinates.

### patchwork (`-Kpatchwork`) — 1 site (needs C confirmation)
- `src/layout/patchwork/index.ts:191` `nodes.sort((a,b)=>b.area-a.area)` — ties
  on equal area. **C `lib/patchwork/patchwork.c` has no `qsort`** — confirm what
  C actually does there (stable sort? insertion? `gv_sort`?) before converting;
  if C is stable, the port is already correct and must be left alone.

### sfdp / osage / twopi (`-Ksfdp` / `-Kosage` / `-Ktwopi`)
- No tie-capable `.sort()` in the port today. Re-run the audit when each harness
  lands (and as their code paths get fleshed out), since C uses `qsort` in
  `sfdpgen`/related.

### circo (`-Kcirco`) — none
- All circo sorts key on a unique `orig.id` (or a 2-element name key) → tie-safe.
  No conversion needed even once a circo harness exists.

## Suggested order
fdp first (one clean site, `-Kfdp` oracle is straightforward), then neato/vpsc
(shared, higher reach), then patchwork (after the C-source check), then
sfdp/osage/twopi as those engines mature. circo needs a harness for general
conformance but **no** qsort work.

## Reusable assets
- `src/util/bsd-qsort.ts::gvQsort` — the sort; its header documents the rule.
- `src/util/bsd-qsort.test.ts` — pattern for an oracle-pinned permutation lock.
- `test/corpus/{gen-headless-gvbindir.sh, survey.ts, dashboard.ts}` — the dot
  harness to parameterize per engine.
- Decision record for the dot/pack/ortho pass: `plans/fix-graphs-mike/`.
