## Observation: newrank parity blocked by two defects outside removeFill
- **Context**: T4 — port removeFill + pin newrank rank-reconciliation parity.
- **Finding**: (1) `dotRank` (rank.ts) never sets `NEW_RANK` from the `newrank`
  attribute — C does `if (mapbool(agget(g,"newrank")))` (rank.c:521). So
  dot2Rank/fillRanks never run; removeFill is a correct no-op. (2) Forcing the
  flag on makes renderSvg hang; V8 --prof on an esbuild bundle pins 81.6% of
  ticks to `furthestNode` (mincross-utils.ts:161) — fill-node `order` indices
  make `neighborNode` never return undefined, so the order-walk never ends.
  Hang is in dotMincross, before removeFill runs.
- **Impact**: newrank parity is unreachable through the init.ts write-set.
  removeFill is faithful and ready. Next mission must fix rank.ts flag-set and
  the furthestNode/fillRanks ordering interaction, then flip the residual test.
- **Confidence**: High (oracle-verified, profiler-localized, reverted cleanly).
