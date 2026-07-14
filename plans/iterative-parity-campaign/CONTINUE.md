# Resumption prompt (written 2026-07-14, session cleared at ~768k tokens)

Paste the block below into a fresh session.

---

Continue the graphviz-ts parity/conformance work on branch
`feature/xdot-conformance` (repo `/Users/scottseely/git/graphviz-ts`,
HEAD should be `a8c7e41` "merge(review): alias the cluster rank window in
conc.ts").

## Read these first (they are the source of truth, not my summary)

- `CLAUDE.md` — the C source at `~/git/graphviz` is the canonical spec; oracle is
  the native build `~/git/graphviz/build/cmd/dot/dot` with `GVBINDIR=/tmp/ghl`
  (never homebrew, never WASM).
- `plans/iterative-parity-campaign/decision-journal.md` — **tail it**; the last
  ~10 rows are this session's work and explain every mechanism.
- `plans/iterative-parity-campaign/README.md` — gates, stop conditions, ADRs D1-D6.
- Project memory (auto-loaded) — especially `corpus-silence-is-not-coverage`,
  `engine-init-defect-class`, `verify-agent-base-not-just-claims`.

## IMMEDIATE TASK — an interrupted sweep must be redone

A full corpus sweep was running to gate the `conc.ts` fix when the session was
cleared. It is dead, and it left **half-written parity files** in the working
tree. Resume-style/partial sweeps hide regressions (this is a documented
campaign rule), so:

1. `git status --short test/corpus/` — expect modified `parity-*.json` /
   `parity-*.jsonl`. **Discard them**: `git checkout -- test/corpus/`.
2. Run a **fresh** full sweep (dot survey FIRST — `engine-walk` derives its id
   universe from `parity.json`, so the survey must be fresh before the engines):

   ```bash
   GVBINDIR=/tmp/ghl npx tsx test/corpus/survey.ts          # dot: 788 ids
   for eng in neato fdp sfdp circo twopi osage patchwork; do
     rm -f test/corpus/parity-$eng.jsonl                    # FRESH, never resume
     GVBINDIR=/tmp/ghl npx tsx test/corpus/engine-walk.ts $eng
   done
   ```
   Run it with `run_in_background: true`; it takes hours. **Never edit `src/`
   while a sweep runs** — sweeps read live source.

3. **Gate**: 0 `pass -> diverged` regressions on all 7 engines, and 0
   `conformant -> other` on dot, versus the committed baselines at HEAD.
   Compare by **id**, never by row count (the universe size legitimately shifts
   when a dot timeout flakes). Comparator:

   ```js
   // node -e with this: load HEAD's parity-<eng>.json vs the working copy,
   // key by r.id -> r.status (engines) or r.verdict (dot: 'conformant').
   // FAIL only on pass->diverged / conformant->other.
   ```

4. If clean, commit the sweep results:
   `test(corpus): sweep gating the conc.ts alias fix — 0 regressions`

**Expected committed baselines at HEAD** (what the sweep must not regress):

| engine | pass | diverged |
|---|---|---|
| dot | 761 conformant | 2 |
| patchwork | 756 | 0 |
| osage | 750 | 6 |
| circo | 745 | 3 |
| twopi | 739 | 14 |
| fdp | 600 | 145 |
| sfdp | 510 | 243 |
| neato | 409 | 345 |

Suite: `npx tsc --noEmit` clean, `npx vitest run` = **3166 passing**.

## WHAT WAS JUST DONE (two fixes awaiting only that sweep)

Both are merged and pass tsc + vitest; only the corpus gate is outstanding.

1. **`place_portlabel` gate** (`src/layout/dot/splines-label.ts`) — already
   swept clean (0 regressions, +2 ids). C gates on the attribute DECLARATIONS
   (`E_headlabel` = `agfindedgeattr`, root-scoped), not `GD_has_labels`. Under
   `pack` a projected component's `has_labels` is 0, so head/tail labels were
   never placed.
2. **`conc.ts` alias** (`src/layout/dot/conc.ts`) — `fillRankVlist` now aliases
   the cluster rank window into the root array (`v = rootRank.v`,
   `vStart = order(lead)`) instead of `.slice()`ing a copy, matching C's live
   pointer (`conc.c:168`). `computeMaxi` moved to `rankGet` with it (it is the
   only conc.ts site reached with a cluster). Byte-identical on all 14
   concentrate corpus graphs; `fillRankVlist` runs 70x, 31 at non-zero vStart,
   so the zero-diff is real coverage. **This is what the pending sweep gates.**

## THEN: the next real piece of work

**Risk-weighted triples.** All 231 pairwise feature "dark cells" are now closed
(72 -> 1; see `test/corpus/blind-spots.ts`, run it). But **every real bug this
session was a 3- or 4-way conjunction**, so pairwise coverage is a floor, not a
ceiling:

- xusuxe crash: `cluster x minlen0 x edgelabel x edge-less cluster member`
- pack/has_labels: `pack x multi-component x flat-edge x edgelabel`

Exhaustive triples (1540) are infeasible. Choose by **subsystem**: every defect
found lived in the same danger zone — **rank x cluster x component-projection**.
`pack` is the switch that makes `g !== g.root`, which is exactly what hid the
whole family, and it appears in only 8 of 805 upstream corpus graphs.

Author risk-weighted triple fixtures in that zone, **probe each against the
native oracle BEFORE locking it in** (a fixture's job is to find bugs, not to
decorate), and add passing ones as goldens under `test/golden/` (input +
manifest entry + SVG/xdot refs generated from the oracle; bump the count guard
in `test/golden/suite.test.ts`).

The one permanently-dark cell is `pack x newrank`: **native graphviz SIGSEGVs**
on it (both our build and released 15.1.0). The port renders it *correctly* —
proven via a proxy oracle (newrank is layout-neutral for that shape, so native's
own no-newrank output is the reference, and we match it exactly). See
`test/corpus/oracle-segfault-pack-newrank.test.ts`. Do not try to close it.

## HARD-WON HAZARDS (all cost me real time this session)

- **Never edit `src/` while a sweep runs.** Diagnosis agents that instrument
  port code MUST run in a worktree (`isolation: "worktree"`).
- **Verify a subagent's BASE, not just its PASS claims**:
  `git merge-base --is-ancestor <tip> <agent-branch>`. Two agents this session
  branched from a ~20-commit-stale base and produced confident, wrong archaeology.
- **zsh does not word-split an unquoted `$var`.** `for f in $files` runs ONCE on
  a concatenated blob and reports a vacuous result. Use `while IFS= read -r`.
- **Don't symlink `node_modules` into a worktree and `git add -A`** — `.gitignore`
  had `node_modules/` (directory pattern), which does not match a symlink; the
  merge replaced the real dir with a self-referential link. (Now hardened to
  `node_modules`.)
- **A probe that satisfies none of C's preconditions proves nothing.** I once
  "refuted" the `place_portlabel` bug by testing headlabel without
  `labelangle`/`labeldistance` — C's outer gate was false, so C skipped too and
  both sides agreed *vacuously*. The bug was real.
- **Instrument before narrating.** My hypothesis was refuted 4x this session,
  each time by evidence I had not gathered.
