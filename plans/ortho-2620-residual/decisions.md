<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (pre-made, user-approved 2026-07-05)

Inherits residual-cleanup/endgame decisions.md D1–D4 + amendments WHOLESALE.
Mission-specific additions:

**D5 — Diagnosis depth gate before acceptance.** Acceptance requires a
single-variable controlled experiment proving irreducibility (the 2646 bar:
port == strict-IEEE C, or a documented compiler/platform artifact). A tie
assertion is NOT sufficient — 2620 already survived two refuted tie-break
theories and three landed fixes.

**D6 — Localize before rooting.** First diagnosis step is a cheap bisection of
WHERE the 423 diffs live (which edges; bend-count vs coordinate; node-relative
vs absolute) before any C instrumentation. `maxDeltaPath` already names one
edge — characterize the full population first.

**D7 — Split diag→fix.** Locus unknown among ~7 ortho files. Fable diagnosis
agent (worktree, docs-only) → sonnet fix agent against the identified stage.

**D8 — Registry class discipline (if accept).** A6/A7/A8 are TAKEN. The
registry writer must verify a free class letter or justify a fold into an
existing class (R6 hit this exact collision last batch — never trust a class
letter from the brief).

**Standing amendment.** If the fix needs to write outside `src/ortho/` (e.g. a
shared primitive in src/common/ or src/pathplan/), the fix task STOPS and asks
to expand the write-set — it does not auto-expand.

Rollback: all Reversible (squash commits + removable registry entries).
