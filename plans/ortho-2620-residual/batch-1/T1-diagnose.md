<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Diagnose the 2620 pure-ortho edge-routing residual

You are T1 in mission plans/ortho-2620-residual/ for graphviz-ts (faithful
TypeScript port of C graphviz; ~/git/graphviz is the canonical spec).
DIAGNOSIS ONLY — worktree-isolated; your writes DO NOT persist. Your final
message IS the deliverable (a markdown analysis doc); the orchestrator writes
it to plans/ortho-2620-residual/analysis/2620-ortho-route.md.

ALWAYS start Bash commands with:
`export PATH="/usr/bin:/bin:/Users/scottseely/.volta/bin"`

## Context
2620 is structural-match, ~423 diffs, maxΔ585, maxDeltaPath
`svg/g[1]/g[428]/path[1]/@d[4]` (one edge coordinate). ALL node-order/position
diffs are GONE — F2/F5's mincross transpose-gate fix made the ortho MAZE INPUT
match C, so this is a PURE edge-routing residual in the corridor/track pipeline.
It is DISTINCT from the three landed ortho fixes (do not re-derive or re-touch):
- M1 Apple-libc qsort semantics + heapsort — src/util/bsd-qsort.ts
- M2 addPEdges parallel-segment precedence — src/ortho/ortho-parallel.ts
- M3 gcell bb from ND_coord/ND_xsize + CHANSZ exact — src/ortho/maze.ts
All three are on main and 2620 STILL diverges → a fourth mechanism.

## Read-set (build on evidence; do not re-derive)
- plans/followup-residuals/analysis/2620-transpose-gates.md (node census +
  the bisect proving mincross was upstream of this residual)
- plans/residual-cleanup/analysis/ortho-r4-family.md (M1–M3; the "C-side
  protocol compliance" section = the ortho C-instrumentation recipe)
- .agent-notes/2361-ortho-maze-corridor-tiebreak.md (gvmine route-dump recipe)
- src/ortho/: index.ts, maze.ts, maze-channels.ts, sgraph.ts, fpq.ts,
  partition.ts, ortho-route.ts, ortho-parallel.ts (read on demand)

## Method (diagnosis discipline — instrument before hypothesizing)
1. **Localize (D6, do this FIRST, cheap):** render 2620 both sides
   (`GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts
   ~/git/graphviz/tests/2620.dot dot` vs cached oracle
   `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg <file>`; compare
   via a tsx script importing compareSvg from test/golden/compare.ts,
   'deterministic'). Characterize the 423-diff population: how many edges;
   bend-count mismatch vs pure coordinate; node-relative or absolute; do the
   diverging edges share a container/rank/cluster? Start from maxDeltaPath's
   edge.
2. **Bisect the pipeline:** with paired dumps, find the first ortho stage whose
   output differs — maze cells/partition boundaries → sgraph nodes/edges +
   weights → shortPath relax trace → updateWts → assignTracks/top_sort order →
   route conversion. Port side = env-gated prints in your worktree; C side =
   env-gated fprintf in ~/git/graphviz/lib/ortho/*.c via the gvmine/gvplugins
   recipe. First divergent VALUE wins.
3. **Check recurring ortho classes FIRST (cheap greps before deep dives):**
   per-relax int truncation (Math.trunc; C sgraph.c `int d`), fPQ sentinel
   domain, dict numeric-key ordering (dtmatch/dtnext), over-allocated-list
   reads (respect size not length), gvQsort/gather order.
4. **Verdict:** fix (locus + mechanism in src/ortho/), accept (irreducible —
   MUST show a single-variable controlled experiment per D5, e.g. port ==
   strict-IEEE C or a documented platform artifact; a tie assertion is NOT
   enough), or split (two mechanisms / partly upstream — report both).
5. If the fix locus is OUTSIDE src/ortho/ (shared bezier/geom in src/common/ or
   src/pathplan/), report the mechanism and the required expanded write-set —
   do NOT assume you may write there.

## Boundaries
- NEVER rebuild the dot binary (oracle-cache signature). Instrument ONLY the
  lib/ortho files you need; leave any sibling instrumentation elsewhere intact;
  at the end `git -C ~/git/graphviz checkout` your files, rebuild the ortho
  plugin, and byte-verify a clean 2620 oracle render vs the cached oracle.
  Never touch /tmp/ghl.
- Render budget: ≤4 port renders of 2620 (it is ~30k elements, minutes each);
  reuse the cached oracle.
- Experimental fix validation in your worktree is encouraged if cheap — report
  the result; the real fix lands in Batch 2.

## Acceptance criteria
- **Given** the 423-diff population, **when** characterized, **then** the doc
  states edge count / bend-vs-coord / node-relative-vs-absolute / shared
  container (D6).
- **Given** a candidate mechanism, **when** proposed, **then** it is proven by
  paired C-vs-port instrumentation at the FIRST divergent value — not asserted.
- **Given** verdict=accept, **then** irreducibility is shown by a
  single-variable controlled experiment (D5).
- **Given** C instrumentation was used, **then** C tree reverted + plugin
  rebuilt + clean 2620 oracle render byte-verified vs cache (state this).
- **Given** the fix locus, **then** writeSet ⊆ src/ortho/; if wider, report the
  verdict + name the expanded set and DEFER the fix.

## Return (final message = the analysis document; markdown, SPDX EPL-2.0 header)
Sections: mechanism · origin (file:line both sides) · causalChain · ruledOut
(evidence each) · verdict (fix/accept/split) · proposedWriteSet · (if accept)
irreducibilityExperiment · evidence (key paired dumps inline) · C-cleanup
verification statement. Raw data, no preamble.

## Observability / Rollback
N/A — diagnosis only; no persisted change. Rollback: Reversible (nothing lands).
