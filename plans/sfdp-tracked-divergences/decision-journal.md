# Decision journal — sfdp tracked divergences

Append one row per non-trivial judgment call or completed task. Include the
mechanism for every fix (per `~/.claude/rules/diagnosis.md`) and reference every
accepted divergence with its evidence pointer.

| Date | Task | Decision / Mechanism | Files | Gate result |
|------|------|----------------------|-------|-------------|
| 2026-07-21 | setup | Created `feature/sfdp-tracked-divergences`; committed brief + autonomous perms (native dot / POS_DUMP / otool). | .claude/settings.autonomous.json, plans/ | n/a |
| 2026-07-21 | T0.1 | Regenerated attribution (--fresh, oracle 8fdd1294). Tracked collapsed **57→17 not-cleared**; drift-exonerated 184→217; **harness-error 3→0** (pgram resolved, confirms space-named-node parser fix). Both attribution-sfdp.jsonl + derived .json committed (one harness run writes both). | test/corpus/attribution-sfdp.{jsonl,json} | committed f038ab0 |
| 2026-07-21 | plan | Parallel-analysis dispatch (parallelism.md: read-only, disjoint findings). B1/B2/B4 touch 3 independent subsystems (edge-label render / edge-routing+CDT / set-aspect) → 3 debugger agents concurrent. B5 (RTree edge-label, accept-lean) DEFERRED until B1 resolves — a B1 multi-line-edge-label fix could clear B5 ids, so accepting them first would violate fix-aggressively. Fix+verify steps serialize after (src writes + sweeps must not overlap). | (dispatch only) | n/a |
| 2026-07-21 | T1.1(pre) | b106 (B1) narrowed BEFORE delegating: node positions FAITHFUL (identical ±(0,+931) y-translation, dx=0), node box sizes byte-identical → text-measure & node-sizing REFUTED. bb height +271.55 (port taller) traces to ONE edge Node1307->Node1300 carrying a 113-line label; port vs native render that giant edge label differently (bar_ count 139 port vs 278 native). Delegated exact mechanism + fixable verdict to debugger. | scratchpad | n/a |
| 2026-07-21 | B5 multi-comp fix DONE | 2470 (7 comps) + 2095_1 (44 comps) were multi-component; the single-comp B4 fix didn't touch them. `postprocess` else-branch did a premature `shiftOneGraph(-bb.ll)` BEFORE gvPostprocess→addXLabels → objplp2rect round()s the xlabel rects in the origin frame not C's packed frame → edge-label side flip (77.7pt / 7.6pt lp shift). Fix: drop the premature shift, `g.info.bb=computeSubgraphBB`, let translateDrawing shift after addXLabels (mirrors neato 1e7515d). Verify: 2470/2095_1 injected 56/32→**0**. Regression guard = corpus sweep (a clean synthetic unit test can't reproduce — needs a packed non-zero-ll frame + label at a round() boundary, i.e. a real graph; same as how neato 1e7515d was guarded). CONTENTION LESSON: the first mc-sweep showed a false pass→diverged on single-comp `neatosplines_neato` (opCount tie) because I ran competing B2/B5 analysis renders DURING the sweep; a CLEAN idle sweep = **0 regressions**, neatosplines_neato passes. Never run competing renders during a verification sweep. | src/layout/sfdp/index.ts, test/corpus/parity-sfdp.json, batch-1/5 findings | committed (this row) |
| 2026-07-21 | B2 analysis | 42/241_0/2095 remain not-cleared (single-comp, spline-geometry FP-ties, unaffected by frame fixes). Fix levers already applied+documented in-code: route.ts:198-199 (Apple libm hypot ~1-ULP, findMaxDev tie → 241_0 ptCount 14v8), triang.ts:15-27 (arm64 fmadd emulation, CDT incircle → 42 opCount/ptCount flip), robust-incircle. 2095 = sub-0.7pt arrowhead drift (same hypot/fma ULP). All → accept A9; registry entries + fresh otool evidence in Batch 6. | batch-2/findings.md | committed (this row) |
| 2026-07-21 | B4 RIPPLE (major) | The B4 postprocess fix runs BEFORE gvPostprocess→addXLabels, so correcting the single-component shift (routing-box ll incl. label/spline extent, not geometric node∪curve ll) also fixed the addXLabels frame ([[neato-addxlabels-pretranslate-frame]] class). Re-attributed the other 13 tracked ids injected with the fix: **7 more CLEARED** — b106 (B1, inj 4406→0), share-b106 (B1), **1652** (B5, inj 288→0 — the prior "RTree-lossy irreducible" repr; the floor-boundary crossing was itself the frame offset!), graphs-b29, linux.i386-b29, linux.i386-b106, linux.x86-root_twopi, linux.x86-root_circo (B5). So ONE fix resolves B1 entirely + 5 of 8 B5. Tracked 17→**5**: 42/241_0/2095 (B2 edge FP-tie), 2470/2095_1 (B5 edge-label, genuinely not cleared by the frame fix). Attribution regen deferred to end (avoid repeated 40-min runs). | (verified via reattr.mts) | n/a |
| 2026-07-21 | T4.1/T4.2 DONE | B4 = ONE bug (not 4). `src/layout/sfdp/index.ts` postprocess recomputed g.info.bb geometrically for single-component, clobbering the neatoSetAspect fill-scaled box (node half-sizes not scaled by f, so node∪curve union short by node_size·(f−1) on the stretched axis) AND shifting by the geometric ll instead of the scaled ll (→ all-coord offset = the 971 diffs). Fix: single-component keeps the routing box via `normalizeGraphBB` (C gv_postprocess never recomputes GD_bb; splines.ts:1000-1003 warns exactly this). Scale math proven faithful. Verify: injected 4/4 →0 diffs; FRESH sweep 0 regr, 4 diverged→pass (3 trapeziumlr + bonus linux.x86-neatosplines_neato1); 1855→drift (A1 on regen). Added deterministic regression test (pinned ratio=fill: height 446.3 post vs 418.4 pre). tsc 0, npm test 3221. | src/layout/sfdp/index.ts, src/layout/sfdp/sfdp.test.ts, test/corpus/parity-sfdp.json, batch-4/findings.md | committed (this row) |
| 2026-07-21 | T4.1(pre) | trapeziumlr (B4): injection DOES take effect (not a no-op — clears the space-named caveat). Residual = uniform y-scale: width EXACT (657.65), height port 876.66 vs native 892.52 (~1.78%). ratio=fill normalizes one axis to 1.0, stretches other; pre-scale bb.ur.y (edge-curve derived) is the variable. Delegated scale-math-vs-amplified-drift to debugger. | scratchpad | n/a |
| 2026-07-21 | T0.2 | Re-bucketed the 17. **B3 EMPTY** (rankdir_dot family all passing). **ADR-3 collapse does NOT apply** — the b106/b29/trapeziumlr/root stems are distinct inputs (proven by size+sha+injection behaviour), each its own representative. Buckets: B1=2 (graphs/share-b106, node-size/text-measure), B2=3 (42/241_0/2095, edge FP-tie), B4=4 (3×trapeziumlr+1855, ratio=fill scaling), B5=8 (RTree edge-label, accept-lean; 1652/2470 known). Discriminator = injection signature+inj/base, not firstDiff (which is the graph bg polygon for all). | batch-0/findings.md | committed (this row) |

## Mission summary (2026-07-21)

**Objective met: sfdp tracked divergences 50 → 0.**

- **Before:** 520 pass / 234 diverged (stale attribution: 184 A1 / 50 tracked).
- **After:** 524 pass / 230 diverged, **0 tracked** (227 A1-drift accepted + 3
  A9 evidence-backed accepts). Attribution regenerated (oracle 8fdd1294).

**Fixes landed (2 commits, both in `src/layout/sfdp/index.ts` postprocess — one
root cause, two component paths):**
- `fix(T4.2)` fa0240b — single-component: keep the routing box
  (`normalizeGraphBB`) instead of a geometric recompute that clobbered the
  ratio=fill scaled bb and shifted by the wrong `ll`. Resolved 11 ids:
  3 trapeziumlr (→pass), 1855 (→A1), b106+share-b106 (B1), 1652, graphs-b29,
  linux.i386-b29, linux.i386-b106, linux.x86-root_twopi, linux.x86-root_circo
  (B5) + bonus linux.x86-neatosplines_neato1. The single-comp shift ran before
  `addXLabels`, so fixing it also corrected the xlabel frame — the prior
  "RTree-lossy floor-boundary" (1652) was a symptom of that offset, not a root.
- `fix(T5.2)` dfaafcc — multi-component: drop the premature `shiftOneGraph`
  before `gvPostprocess`→`addXLabels` (objplp2rect round()s in C's packed
  frame), mirroring neato 1e7515d. Resolved 2470 (7 comps) + 2095_1 (44 comps).

**Accepts added (class A9, evidence-backed, ADR-2):** 42, 241_0, 2095 — CDT
cocircular incircle / findMaxDev hypot 1-ULP ties (segment-count flip /
sub-0.7pt drift). Fix levers already applied+documented in-code (triang.ts fma,
route.ts:198-199 hypot). Fresh controlled experiment: native-vs-V8 hypot ULP
probe (batch-2/hypot-ulp-probe.txt) shows 1-ULP disagreement on 2/6 flat-edge
inputs. Registry: `accepted-divergences-engines.json` sfdp.{42,241_0,2095},
ref known-divergences.md#a9-sfdp-fp-ties.

**Buckets:** B0 regen (57→17 not-cleared); B1 (repurposed from graphs-unix,
cleared by fix); B3 EMPTY (rankdir_dot passing); B4 fixed (4); B5 fixed (8, all
edge-label frame, not RTree-lossy after all); B2 accepted (3, A9).

**Verification:** tsc 0, npm test 3220 green, clean fresh sfdp sweep 0
pass→diverged, tracked=0. Cross-engine isolation: `git diff main` = only
`src/layout/sfdp/index.ts` (+ its test) — the shared functions it calls
(normalizeGraphBB/computeSubgraphBB/gvPostprocess) are unmodified, so
neato/fdp/circo/twopi/osage/patchwork are unaffected by construction; PARITY.md
shows their tracked counts unchanged (fdp's 20 is pre-existing).

**Lesson:** never run competing renders during a verification sweep — the first
multi-comp sweep showed a false pass→diverged on a single-comp opCount-tie graph
from CPU contention; a clean idle sweep = 0 regressions.
