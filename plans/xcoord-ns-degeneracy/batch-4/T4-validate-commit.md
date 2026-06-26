# T4 — Revert instrument, validate, commit

## Context
T3 landed the fix; honda-tokoro matches against the (still-instrumented) oracle.
Now restore a clean oracle, prove zero regressions across the whole corpus, and
commit. See [README quality gates](../README.md) and ADR-5.

## Task
1. **Revert ALL C instrumentation** from T1:
   `git -C ~/git/graphviz checkout lib/dotgen/position.c lib/common/ns.c`
   (confirm `git -C ~/git/graphviz diff --stat` is empty for those files).
2. **Rebuild the oracle clean** + regen gvbindirs:
   ```
   cmake --build ~/git/graphviz/build --target gvplugin_dot_layout dot
   sh test/corpus/gen-headless-gvbindir.sh         # /tmp/ghl
   ```
   Sanity: honda-tokoro native SVG still byte-matches the port from T3.
3. **Headless survey + gate** (require 0 regressions):
   ```
   npm run survey
   npm run survey:gate          # must print GATE PASS
   ```
4. **Refresh pango baseline**:
   ```
   GV_TEXT_MEASURER=lut GVBINDIR=/tmp/gvplugins ORACLE_CACHE=$TMPDIR/oracle-pango-$(date +%s) \
     PARITY_OUT=parity.json tsx test/corpus/survey.ts
   ```
5. **Honest transition check** (committed baselines vs new): compute improved /
   regressed for BOTH `parity-rules.json` and `parity.json` (same script used in
   prior fixes). REQUIRE regressed == 0 in both; honda-tokoro in improved.
6. **Regenerate dashboard**: `npm run survey:dashboard` (writes
   `test/corpus/PARITY.md`).
7. **Write** `.agent-notes/xcoord-ns-degeneracy-done.md` (root cause + fix +
   transition counts).
8. **Commit** on `fix/xcoord-ns-degeneracy`:
   - `fix(...)`: the code fix + unit test + done-note.
   - `chore(corpus)`: `parity-rules.json` + `parity.json` + `PARITY.md`.
   - `--no-ff` merge to `main` (local). **Do NOT push** — the user pushes.

## Write-set
- Revert: `~/git/graphviz/lib/dotgen/position.c`, `lib/common/ns.c`
- `test/corpus/parity-rules.json`, `test/corpus/parity.json`,
  `test/corpus/PARITY.md`
- `.agent-notes/xcoord-ns-degeneracy-done.md`
- git branch/commits/merge

## Read-set
- [README.md](../README.md) (gate commands), `decision-journal.md`

## Acceptance criteria
- Given the reverted C source, when `git -C ~/git/graphviz diff --stat` runs,
  then it is empty (oracle is clean).
- Given the clean oracle, when honda-tokoro renders native vs port, then cy +
  edge paths still byte-match.
- Given the headless survey, when `survey:gate` runs, then "GATE PASS" with 0
  regressions.
- Given the honest transition check, when run on both baselines, then
  regressed == 0 and honda-tokoro ∈ improved.
- Given the commits, when `git log` is inspected, then exactly two commits
  (`fix` + `chore(corpus)`) + the merge, message format per
  `~/.claude/rules/commits.md`, and `origin/main..main` shows them unpushed.

## Observability
The survey gate IS the verification. Record final transition counts in the
done-note.

## Rollback
Reversible — revert the merge. If the survey shows a regression with no
C-faithful resolution → STOP (stop-condition 3), revert the fix, report.

## Boundaries
- Never do: push to origin; weaken/allowlist a real regression to force the gate.
- Always: revert C instrumentation BEFORE running the validation survey.
