# Mission: fdp tracked divergences → solve or accept

## Objective

Drive the fdp **tracked** divergence count to zero — every remaining tracked id
ends as either a landed fix (with 0-regression proof) or a documented,
evidence-backed accept-registry entry. Current PARITY.md shows fdp at **600 pass
/ 20 tracked / 126 A1-drift accepted** (762 surveyed, 16 errors). BUT the fdp
attribution is **stale and untrustworthy**: it is dated 2026-07-17 against the
OLD oracle (sha1 `5caf7a36`), and the native `GVTS_POS_DUMP` no longer fires for
`-Kfdp` (the patch sits in `spline_edges`; fdp routes through `spline_edges1`).
So Mission 0 must **restore working fdp injection first**, then the real tracked
set is re-derived.

Policy (user-confirmed): **fix aggressively** — attempt a fix in every non-drift
bucket; accept only when a controlled experiment proves a platform-FP floor the
port cannot reproduce (A9 = otool/ULP probe; A1 = injection clears the diff).

## Prediction (to be confirmed by Batch 0, NOT assumed)

- unix genealogy family (unix, lsunix1-3, size, unix2/2k, weight, crazy) is
  likely force-drift → A1 accept once re-attributed against a working oracle.
- 241_0, 2095 carry over as **A9** (same CDT-incircle / hypot FP-ties already
  accepted for sfdp — see the sfdp mission).
- graphs-cairo, 2193 (carry `lp`/`_ldraw_` edge labels) are the only plausible
  frame-bug candidates. fdp's postprocess differs from sfdp's (it calls
  `gvPostprocess(g, false)` with `finalCC` pre-normalizing), so the sfdp fix is
  NOT expected to transfer directly.

## Branch

`feature/fdp-tracked-divergences` (merge-commit to main per commits.md; one
commit per task, referencing the task id).

## Quality gates (run between batches; see per-task specs)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm test
  pass: exit 0
  on_fail: fix_and_rerun
- command: fresh fdp engine-walk to a SCRATCH jsonl, diff verdicts vs baseline
  pass: 0 pass->diverged regressions (on fdp AND any engine a shared-primitive fix touches)
  on_fail: stop
```

## Sweep discipline (learned this session — do not repeat)

- Never edit `src/` while a sweep runs; always FRESH scratch-jsonl (resume hides
  regressions); `pgrep` before trusting any handoff.
- **Never run competing renders during a verification sweep** — CPU contention
  produced a FALSE `pass->diverged` on a borderline FP-tie graph in the sfdp
  mission. Idle the machine of renders while a verification sweep runs.
  ([[sfdp-postprocess-addxlabels-frame]] HAZARD note.)

## Oracle rebuild (Batch 0)

The native `GVTS_POS_DUMP` must be re-added at the fdp dump site
(`~/git/graphviz/lib/fdpgen/layout.c` fdp_layout, between `fdpLayout()` and
`neato_set_aspect()` — the port comment at `src/layout/fdp/index.ts:84-90`
documents this exact site). Rebuild: `cmake --build ~/git/graphviz/build
--target dot`. The dump is env-gated (stderr only) so the RENDER is unchanged —
parity/conformance and the committed sfdp/neato attributions stay valid; only
the oracle sha1 changes (attribution-fdp is regenerated fresh against it).

## Constraints

**Stop and wait** when: the native patch does not make `GVTS_POS` fire for
`-Kfdp`; a fix touches files outside the task write-set with no owner; 2
consecutive gate failures on the same check; the same site is changed 3× without
resolving the check ([[bucket-fix-rebucketing]]); an accept is proposed without
controlled-experiment evidence (diagnosis.md forbids "good enough").

**Push forward** when: the fix is obvious and self-contained; a bucket empties
after Batch 0's fresh attribution (skip it, log why); an id is confirmed the
same A9 FP-tie already accepted for sfdp.

## Key facts already established (do not re-derive)

- Port inject hook for fdp is CORRECT: `src/layout/fdp/index.ts:91`
  `injectOraclePositions(g)` runs before `neatoSetAspect`/routing. The gap is
  the NATIVE dump only.
- fdp postprocess: `gvPostprocess(g, false)` (translation suppressed, `finalCC`
  pre-normalizes) — structurally different from the sfdp bug.
- The sfdp mission fixed the sfdp postprocess frame bug (50→0 tracked); its
  root-cause + the addXLabels-frame class are in
  [[sfdp-postprocess-addxlabels-frame]] and [[neato-addxlabels-pretranslate-frame]].

## Batches

| Batch | Focus | Depends | Done |
|-------|-------|---------|------|
| [0](batch-0/overview.md) | Restore fdp injection, regen attribution, re-bucket | — | [x] |
| [1](batch-1/overview.md) | B1 cluster-name collision (graphs-fdp, graphs-b145) FIXED | 0 | [x] |
| [2](batch-2/overview.md) | Force-drift → A1 accept (unix family etc.) | 0 | [ ] |
| [3](batch-3/overview.md) | FP-ties → A9 accept (241_0, 2095) | 0 | [ ] |
| [final](batch-final/overview.md) | Registry, docs, full sweep | 1-3 | [ ] |

Links: [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md) ·
[diagrams/data-flow.md](diagrams/data-flow.md) ·
[diagrams/component-map.md](diagrams/component-map.md)

## Reading order for the executor

Read this file, then `decisions.md`, then `decision-journal.md`. Start Batch 0.
Do NOT read Batches 1-3 up front — they are provisional and refined by Batch 0's
`findings.md`; read each batch's `overview.md` only when you reach it, and SKIP
any bucket Batch 0 marks empty.
