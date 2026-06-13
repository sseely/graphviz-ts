# T5 — end-to-end C-oracle verification + dotsplines/addLabelBB gap-fill

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec;
installed `dot` binary is 15.0.0. Hook rule: smallest fix, ≤2 attempts
per file, then move on.

T1/T2/T3 landed creation; the dormant machinery (edgelabelRanks,
classify.ts labelVnode, placeVnlabel, addXLabels) is now active for
the first time. Known UNVERIFIED areas (recon 2026-06-12):
- dotsplines.c EDGE_LABEL-gated branches at lines 243, 253, 1552,
  1650, 1776 — port coverage in src/layout/dot/splines*.ts unconfirmed
- addLabelBB (utils.c:650-685: ND_xlabel/ED_label/ED_xlabel/head/tail
  contributions to graph bb) — port's bb computation unconfirmed

## Task

1. Probe each label kind end-to-end at full precision vs the C binary
   (probes under .probes/, untracked; .probes/render-all.ts and the
   M10 compareSvg probe pattern are reusable):
   - `digraph G { A [xlabel="nx"]; A -> B; }`
   - `digraph G { A -> B [label="el"]; }`
   - `digraph G { A -> B [xlabel="ex"]; }`
   - `digraph G { label="gl"; A -> B; }`
   - a combined graph (all kinds + headlabel/taillabel)
   Compare with test/golden/compare.ts compareSvg at 'deterministic'.
2. For each divergence, localize: if it traces to the enumerated
   dotsplines branches or addLabelBB being unported, port them
   faithfully (@see cites, journal entry each — this is your declared
   conditional write-set). If it traces to OTHER pre-M11 code, STOP
   and report per the mission stop conditions.
3. Mind the M9 lesson: cgraph out-edge iteration is head-seq ordered
   (.agent-notes/fdp-fma-oracle-2026-06.md, third observation) — SVG
   element ORDER matters in comparison.
4. FMA rule: numeric divergence with an FMA signature requires
   disassembly evidence before applying src/common/fma.ts; otherwise
   STOP (M7 precedent).

## Write-set (conditional — only what divergences require)

src/layout/dot/splines.ts, src/layout/dot/splines-label.ts,
src/layout/dot/edge-route*.ts (EDGE_LABEL branches only), the bb
computation module that owns the addLabelBB equivalent (locate it;
likely src/common — declare in your report), co-located tests for
whatever you port, .probes/* (untracked). If a fix belongs anywhere
else: STOP and report.

## Read-set

~/git/graphviz/lib/dotgen/dotsplines.c:230-260, 1540-1560, 1640-1660,
1770-1790; ~/git/graphviz/lib/common/utils.c:640-690 (addLabelBB +
callers); src/layout/dot/splines.ts, splines-label.ts;
test/golden/compare.ts

## Interface contract

None — verification + gap-fill. Output: per-kind PASS/divergence
report consumed by the orchestrator for T6 golden minting.

## Acceptance criteria

- Given the 4 single-kind probes + combined, when rendered, then text
  content and positions match dot 15.0.0 at deterministic tolerance
  (report per-kind PASS/FAIL with first-diff detail)
- Given a ported gap, then it carries @see cites and its own tests
- Given the existing suite + 67 goldens, then 0 failed /
  byte-identical

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit; commit
only if code changed — a pure-verification PASS outcome produces a
report, no commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed. Commit (orchestrator,
only if files changed): `fix(T5): port EDGE_LABEL dotsplines/bb gaps`
