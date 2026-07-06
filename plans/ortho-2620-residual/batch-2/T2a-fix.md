<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2a — Implement the localized 2620 ortho fix (dispatch only if T1 verdict=fix)

You are T2a in mission plans/ortho-2620-residual/ for graphviz-ts (faithful
TypeScript port of C graphviz; ~/git/graphviz is the spec). Worktree-isolated;
commit on the worktree branch — the orchestrator merges after the batch gate.

ALWAYS start Bash commands with:
`export PATH="/usr/bin:/bin:/Users/scottseely/.volta/bin"`

## Prior diagnosis (read FIRST; do not re-derive)
plans/ortho-2620-residual/analysis/2620-ortho-route.md — T1's root cause,
origin (file:line both sides), causal chain, and proposedWriteSet. Implement
exactly that fix, verifying every value against the C spec it cites, not
against the diagnosis prose.

## Task
Apply the fix at the origin T1 identified (one or two files in src/ortho/).
Preserve C order of operations exactly — this is a faithful port, not a
redesign. JSDoc `@see <C file:line>` on every changed function. If T1's
proposedWriteSet includes a file OUTSIDE src/ortho/, STOP and report — do not
write there without an approved expansion.

## Write-set
The src/ortho/*.ts file(s) named in T1's proposedWriteSet + colocated
*.test.ts. Nothing else.

## Validation (local; do NOT run the corpus survey — orchestrator runs the gate)
Recipes: port `GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts
~/git/graphviz/tests/<id>.dot dot`; oracle (cached) `GVBINDIR=/tmp/ghl
~/git/graphviz/build/cmd/dot/dot -Tsvg <file>`; compare via a tsx script
importing compareSvg from test/golden/compare.ts, 'deterministic'.
- **2620**: report exact diffs/maxΔ before → after (target: improvement toward
  conformant; if a residual remains, characterize it in one paragraph).
- **Ortho controls (must stay conformant/unchanged, byte A/B via git stash):**
  1447, 1447_1, 2361, 1856, 2183, 1880, 56, 144_ortho.
- **gvQsort is global** (ns.ts TB_balance, dot splines, pack): run full
  `npx vitest run` — green incl. the TB_balance qsort permutation pin.
- `npx tsc --noEmit` clean. Add a regression test pinning the fix.

## Boundaries
NEVER rebuild the dot binary; never touch /tmp/ghl or anything under
~/git/graphviz. Preserve C iteration/side-effect order.

## Commit
One commit: `fix(ortho): <mechanism> (<C file:line>)` — body explains the
mechanism and why the C behavior is load-bearing; end with:
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XaXBiyEwkYPxm6QtQscLAX

## Acceptance criteria
- **Given** the fix, **when** 2620 renders, **then** diffs/maxΔ improve
  (report before/after).
- **Given** the 8 ortho controls, **when** re-rendered, **then** all stay
  conformant/unchanged (byte A/B).
- **Given** gvQsort is global, **when** vitest runs, **then** green incl. the
  TB_balance pin; tsc clean.
- **Given** the change, **then** it is one commit touching only the declared
  write-set with a JSDoc @see to the C origin.

## Return
Final message: validation table (2620 before/after + all 8 controls), test
added, commit hash. Raw data, no preamble.

## Observability / Rollback
SLI = 2620 verdict + global conformant count (must not drop below 754).
Rollback: Reversible (revert the squash commit).
