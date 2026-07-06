<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2b — Register the 2620 divergence (dispatch only if T1 verdict=accept)

You are T2b, the single registry writer in mission plans/ortho-2620-residual/
for graphviz-ts (faithful TypeScript port of C graphviz). Worktree-isolated;
commit on the worktree branch — the orchestrator merges after the batch gate.

ALWAYS start Bash commands with:
`export PATH="/usr/bin:/bin:/Users/scottseely/.volta/bin"`

## Prior diagnosis (read FIRST)
plans/ortho-2620-residual/analysis/2620-ortho-route.md — T1's mechanism and,
critically, the single-variable irreducibility experiment (D5). The registry
reason text must summarize that experiment, not just assert a tie.

## Task
Record 2620 as an accepted divergence in the registry trio. Mirror the
structure of existing entries EXACTLY (grep an A3 or A8 entry for the shape).

**Class letter (D8 — DO NOT trust any letter from the brief):** grep the
registry for the highest existing class letter. A6 (1314 canvas overflow),
A7 (honda-tokoro round/box-wall), and A8 (fp-contract/FMA) are TAKEN. Either
choose the next free letter for a genuinely new mechanism, OR justify a fold
into an existing class if T1's mechanism is a sibling (e.g. another
hypot/FMA-family tie → A3/A8). State your choice + reason in the commit body.

## Write-set
- test/corpus/accepted-divergences.json (2620 entry)
- docs/known-divergences.md (class definition if new letter; + the 2620 entry)
- test/corpus/known-divergences-examples.test.ts (add '2620' to
  DOC_CLAIMS_DIVERGENT)

## Quality bar
- `npx vitest run test/corpus/known-divergences* test/corpus/accepted-divergences*`
  (or wherever those tests live) → pass. `npx tsc --noEmit` clean.
- Do NOT run the corpus survey. Do NOT touch ~/git/graphviz. Never rebuild the
  dot binary or touch /tmp/ghl.

## Commit
One commit: `docs(corpus): register 2620 (<class>) — <one-line mechanism>` —
body states the class-letter decision (free letter vs fold + why) and
summarizes the irreducibility experiment; end with:
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XaXBiyEwkYPxm6QtQscLAX

## Acceptance criteria
- **Given** A6/A7/A8 taken, **when** choosing a class, **then** a free letter
  or a justified fold is used (D8).
- **Given** the entry, **when** the registry test runs, **then** it asserts
  2620 diverges as documented; tsc clean.
- **Given** the reason text, **then** it summarizes the D5 experiment, not a
  bare tie assertion.

## Return
Final message: files changed, class letter + justification, class-definition
text as written, test result, commit hash. Raw data, no preamble.

## Observability / Rollback
SLI = 2620 stays structural-match; conformant count unchanged (754).
Rollback: Reversible (registry entries removable in one revert).
