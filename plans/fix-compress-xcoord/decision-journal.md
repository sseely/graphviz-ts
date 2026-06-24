# Decision journal — fix-compress-xcoord (autonomous execution)

## 2026-06-24 — Batch 1 T1: foundation established
- Branch `feature/fix-compress-xcoord` cut from `main`; cherry-picked `6ef3eeb`
  (compress activation) → commit `232e252`. parity.json conflict resolved
  `--theirs` per brief. PARITY.md auto-merged.
- Gates: `npm run typecheck` exit 0; `npm test` 2384 passed (181 files);
  baseline survey **byte 337 / structural 265 / diverged 173 / errored 5 /
  timeout 4 / oracle-error 11**. NaN family (graphs-NaN, share-NaN,
  windows-NaN) all `diverged`.

## 2026-06-24 — Batch 1 T2: divergence PINNED — root cause is OUT OF SCOPE

**One-paragraph root cause (the T2 deliverable).** NaN's compress x-coordinate
divergence (53/76 nodes off in X, −5..+1 pt, all dy=0) is **not** a bug in the
compress path. Every constraint input the compress path feeds the x-network-
simplex matches C: `compressGraph` flip/width value match exactly
(`flip=0 p=(1152,720) x=1152` in both — the width edge is non-binding since the
natural compressed width ~1907 > 1152, so compression comes from the weight-1000
term, identically in both); `containNodes` per-rank ln/rn minlens match C on
every rank but rank-0 rLen (100 vs 99, itself a 1 pt node-width diff); the aux-
edge **counts are identical** (LR=132, pairs=318, total=471, wt-sum=1612);
`lrBalance` is faithful (`>>1` == C `/2`; same tie-break). The **only** input
that differs is the **LR-constraint minlen sum: TS 11380 vs C 11368 (+12)**, and
that +12 is fully explained by **9 nodes whose half-widths are 0.5–1.03 pt wider
in the port than in C** (sum 5.65; ×2 edges/node ≈ +11.3 ≈ +12). Those widths
come from the **font-metric text measurer** — the documented, accepted **A2
divergence** (`docs/known-divergences.md:63`). Compress's weight-1000 packing
makes the otherwise-slack separation constraints binding, which is why the
sub-pixel width error (invisible without compress) surfaces as a −3..−5 pt
interior shift here. C line: `lib/dotgen/position.c:264`
`width = ND_rw(u) + ND_lw(v) + nodesep;`.

**Airtight proof (forcing experiment).** Temporarily overriding the 9 nodes'
`lw`/`rw` to C's values (`VaxFrame 49.3, VaxGCommonFrame 91.27, Wire 29.34,
UFileWr 43.67, AtomWr 44.19, WrClass 42.65, ProtectedWire 64.15, StreamWire
55.96, TextWr 39.58`) makes:
- node-x divergence **53/76 → 0/76** (all |dx| ≤ 0.5), and
- the `Target<->TThread` spline **7 pts → 4 pts** (== C, both directions).

So the compress x-NS path is fully faithful; the residual is 100% upstream font
metrics. Rank orders match C exactly (pure x-coord divergence, not mincross).

**Why this halts the mission.** The brief's premise — "the ≤5 pt defect is
downstream of `compressGraph`" in containNodes / size / x-NS — is **disproven**.
There is no compress-local fix. Reaching |dx| ≤ 1 requires changing the shared
font-metric measurer, which is **explicitly out of scope** (A2: shared primitive;
adjusting it to win these strings risks regressing the hundreds of graphs that
currently byte-match) — and the spline router (the other lever) is also out of
scope/forbidden. This matches two brief stop conditions: "fix would require
touching the general x-NS / [font metrics] → stop; re-scope" and "task was
mis-scoped." **Stopping after T2; no T3 fix exists in scope.** Escalated to human
with options (see README "Outcome").

All C and TS instrumentation reverted; C rebuilt clean; working tree pristine
(HEAD `232e252`).

## 2026-06-24 — Session end: characterized + merged (per human decision)

Human chose "characterize + merge compress." Tasks completed vs planned:
- **T1** done — compress cherry-picked, gates green.
- **T2** done — root cause pinned (out of scope: accepted A2 font metrics).
- **T3** N/A — no in-scope fix exists (premise disproven by T2).
- **T4** — stated goal (NaN -> structural-match) not reached, and proven
  unreachable in scope; instead NaN characterized as an A2 instance.

Outcome:
- NaN family characterized in `docs/known-divergences.md` A2 + comparison page
  `plans/fix-compress-xcoord/comparisons/nan-compress-xcoord.md`.
- `ratio=compress` activation merged to `main` on its own merits — faithful,
  **0 verdict regressions** (fresh main-vs-branch full-corpus survey: per-id
  diff = 0 changes; counts identical 337/265/172/5/5/11). Compress corrects
  geometry: NaN-family maxDelta **679 -> 21**, 1447_1 **3896 -> 3624**.
- Quality gates on merged main: typecheck exit 0; `npm test` 2384/2384 pass.
- Merge commit `de72ce1` (compress `232e252` + characterization `2a34a37`).
- Per-user additions (outside original write-set, explicitly requested mid-
  mission): removed `plans/` from `.gitignore` and committed the 146 previously-
  untracked mission files (`0521ae4`) plus a CLAUDE.md "Overrides" note, to keep
  plans/ as the archaeological record.

Known issue / follow-up: NaN remains `diverged` (the A2 font-metric x-shift tips
a spline segment count). The only path to structural-match is the separately-
scoped font-metric fidelity effort noted in `known-divergences.md` A2.
