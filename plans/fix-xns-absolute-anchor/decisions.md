# Architecture decisions

## AD-1: Alignment approach = incremental bit-exact NS pivot replication

- **Context**: port x-NS is a uniform shift of C's (relative identical, absolute
  anchor differs by an emergent amount; can't be derived without running C's NS).
- **Decision**: instrument both NS pivot sequences, fix the first ordering
  divergence the trace shows, re-trace + survey, repeat (candidates T1–T5).
- **Consequences**: faithful to "C is the spec"; each step is small and
  surveyable; the relative solution stays identical so final coords don't move.
  Rejected: derived uniform pre-translate (shift not derivable) and a localized
  spline-less-label-only frame model (band-aid, doesn't generalize).

## AD-2: Batch-1 success is measured by the internal-coord trace, not the survey

- **Context**: a correct anchor change does NOT alter final coords, so the survey
  output is unchanged during Batch 1 (2368 stays diverged, 490 stay byte-match).
- **Decision**: Batch-1 done-criterion = port internal x-coords match C's
  (instrumented XORG/XNS probes converge) AND survey stays green (0 regressions).
- **Consequences**: the survey is a *regression guard* in Batch 1, not a progress
  signal. Progress is read from the trace diff.

## AD-3: Final coords are sacrosanct

- **Context**: 490 graphs byte-match on final coords; that is the value already
  banked.
- **Decision**: any change that moves a final coordinate (byte-match→worse) is a
  STOP — it means the relative solution changed, which the anchor fix must never do.

## stop-conditions

1. A pivot alignment changes the relative solution (any byte-match→worse). STOP.
2. A survey regression not resolved by the next candidate fix. STOP.
3. Trace doesn't converge after exhausting T1–T5 (source outside candidate set). STOP + document.
4. 2 consecutive gate failures on the same check, or 3 consecutive edits to the
   same site without resolving it. STOP.
5. A task needs to write outside its declared write-set. STOP.

## Key C references (read-only spec)

- `lib/common/ns.c`: `init_rank` (146), `feasible_tree` (623), `rank2` main loop
  + balance switch (~989–1018), `LR_balance` (un-normalized), `leave_edge`,
  `enter_edge`, `update`, `rerank`, `scan_and_normalize` (748, NOT called for
  balance=2).
- `lib/dotgen/position.c`: `dot_position` (`rank(g,2,nsiter2)` at 142),
  `set_xcoords` (`coord.x = ND_rank(v)`, no normalize), `create_aux_edges`,
  `make_LR_constraints`, `make_edge_pairs` (SLACKNODE ranks).
- `lib/common/postproc.c`: `translate_drawing`, `map_edge` (early-return on
  `ED_spl==NULL` — the untranslated-label quirk).
- `lib/common/emit.c`: `edge_in_box`, `lib/common/utils.c:overlap_label`.

## Ground-truth data (2368_1, x-aux NS internal ranks, C-instrumented)

C: 376=-119 196=-29 256=43 316=115 76=205 (uniform -146 vs port).
Port: 376=27 196=117 256=189 316=261 76=351, bb.LL.x=0.
C also has slack(type2) at -120,-120,-71,44 and virtual(type1) at -38,66.
`init_rank` byte-identical in both (non-negative); negative anchor from
simplex+LR_balance reranks → pivot order.
