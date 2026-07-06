<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Diagnosis (bounded)

One worktree-isolated fable agent localizes and root-causes the 2620 ortho
edge-routing residual, returning an analysis doc as its final message. No
persisted src/ writes — the orchestrator writes analysis/2620-ortho-route.md
from the returned text.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Localize + root-cause 2620 ortho residual; verdict fix/accept/split | fable (worktree) | analysis doc (returned) | — | [ ] |

Gate: the returned doc must satisfy T1's acceptance criteria (see
[T1-diagnose.md](T1-diagnose.md)) before Batch 2 dispatches. If verdict=split
or writeSet ⊄ src/ortho/, the orchestrator surfaces it to the user.

Output interface consumed by Batch 2:
`{ verdict: 'fix'|'accept'|'split', origin, writeSet: string[] (⊆ src/ortho/),
mechanism, causalChain, ruledOut[], (if accept) irreducibilityExperiment }`
