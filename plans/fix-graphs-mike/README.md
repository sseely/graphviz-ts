<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: fix graphs-mike (L→U edge-spline divergence)

## Objective
Root-cause and fix the `graphs-mike` edge-spline divergence so the port renders
edge **L→U** conformant with C. The port routes L→U as a longer, over-segmented
spline (14 points, start y=-504) where C uses one cubic (8 points, start
y=-434.5) — a **long-edge segmentation / chain-routing** divergence (maxΔ 72.12).
Fixing `graphs-mike` also fixes the identical `share-mike` and `windows-mike`.

## Pinned facts (do NOT re-derive)
- Counts + bbox MATCH (33 nodes, 39 edges, viewBox 384×576). Pure edge geometry.
- Worst edges: **K→L** maxΔ 72.1 (8 pts both) and **L→U** maxΔ 69.6 (C 8 / port
  14 pts). K→L shares node L → almost certainly downstream of L→U.
- L→U start point differs ~70px (C M387.79,-434.5 vs port M397.09,-504.12); the
  port adds bezier segments. Signature = long-edge spline piece-count + corridor.
- firstDiffPath `svg/g[1]/g[63]/path[1]/@d` = edge L→U.

## Write-set is pinned by Batch 0 (not pre-assigned)
This is a diagnose-then-fix mission. Batch 0 instruments C vs port and NAMES the
exact fix file before Batch 1 touches code. Likely surface (suspect order):
`edge-route-chain.ts` → `edge-route.ts` / `edge-route-boxes.ts` /
`edge-route-rank.ts` → `splines.ts` / `splines-route.ts`.

## Branch
- `feature/fix-graphs-mike` (merge-commit to main; per-task commits). Created at
  execution start; do not pre-create.

## Quality gates
- `npx tsc --noEmit` → exit 0 after every code change.
- `npx vitest run` for touched routing test files → all pass (Batch 1 adds an
  L→U oracle-pinned test).
- **Integration gate (Batch 2):** full headless parity survey, **0 regressions**
  vs `test/corpus/parity.json` (baseline conformant=**525**). Recipe in
  `batch-2/T2-survey-gate.md`.
- Repro: `~/git/graphviz/tests/graphs/mike.gv`, edge L→U → C path
  `M387.79,-434.5C377.94,-424.92 364.85,-412.19 353.68,-401.34` (8 pts).

## Batches (sequential — each needs the prior)
- [x] **Batch 0** — Diagnosed: root cause is `ns.ts:tbSortNodes` (qsort tie-order in TB_balance rank phase), NOT edge-spline routing. Scope expanded with user authorization. → `batch-0/overview.md`
- [x] **Batch 1** — Fixed via faithful BSD/libc qsort port (`bsd-qsort.ts`) in `tbSortNodes`; L→U + K→L byte-conformant on mike; +test → `batch-1/overview.md`
- [x] **Batch 2** — Survey gate PASSED (0 regressions, 18 improvements; conformant 525→533); baseline + PARITY.md refreshed → `batch-2/overview.md`

## Outcome (2026-06-29)
**Complete.** graphs-mike / share-mike / windows-mike: `diverged → conformant`.
Root cause was the network-simplex `TB_balance` rank phase (NOT edge-spline
routing): C sorts equal-rank nodes via unstable libc `qsort`; the port used a
stable sort, flipping the tie that put node L one rank too high (the L→U
over-segmentation was the symptom). Fix = faithful BSD/Bentley-McIlroy `qsort`
port (`src/layout/dot/bsd-qsort.ts`) wired into `ns.ts:tbSortNodes`. Scope was
expanded from the brief's edge-spline surface into `ns.ts` with user
authorization. Survey: **0 regressions, 18 improvements** (conformant 525→533,
structural 183→193, diverged 70→52). Commits: `0cda4fb` (fix+test), `14eb935`
(baseline). tsc clean; full vitest 2509 pass / 1 skip.

## Constraints
**Stop conditions:**
- Root cause falls OUTSIDE the edge-spline-routing surface (e.g. it's x-coord NS
  node placement, or mincross order) → stop, reassess scope.
- ANY survey regression → stop, do not merge.
- L→U not conformant after the pinned fix → diagnosis incomplete → stop.
- 3 consecutive failed attempts on the same locus → stop (architectural).

**Push-forward:** routing-instrumentation freely; small faithful fixes within the
Batch-0-named file that demonstrably match C's box corridor / piece count.

## Docs
- Decisions: `decisions.md` · Component map: `diagrams/component-map.md`
- Decision journal: `decision-journal.md`
- Conformance definition (the "match" bar): `../../docs/conformance.md`
