# T9 portlabel: two mechanisms (2026-07-04)

## Observation: "verified faithful" formula hid a size-vs-length indexing bug
- **Context**: T9 fix task; prior session verified place_portlabel formula + pe/pf
  extraction as faithful, pointing diagnosis at the splines. Splines were
  byte-identical; the labels still diverged.
- **Finding**: headEndpoints read `bez.list[bez.list.length-1]`; C reads
  `bez->list[bez->size-1]`. Arrow clipping (copyToBezier in splines-clip.ts)
  shrinks `size` but keeps the backing array, so trailing slots are stale.
  Same class as the known "Bezier emit uses bz.size" memory — any consumer of
  bezier points must index by `size`, never `list.length`.
- **Impact**: grep any new bezier consumer for `.list.length` before trusting it.
- **Confidence**: High (arrowsize.gv byte-identical after fix; red/green test).

## Observation: C ortho branch places port labels via `goto finish`
- **Context**: 144_ortho head/tail labels off by up to 34.6 with identical spline
  geometry; whole layout shifted by the divergent label bbox.
- **Finding**: dotsplines.c ORTHO branch `goto finish` (line 258) lands at
  `finish:` (436) — immediately BEFORE the port-label placement block, so ortho
  runs place_portlabel. The port's orthoDispatch returned early; unset labels
  fell through to the xlabels pass (different distance/angle model).
- **Impact**: when mirroring C `goto` shortcuts, check exactly which blocks the
  label skips INTO, not just which it skips OVER.
- **Confidence**: High (144_ortho byte-identical after adding placePortLabels
  to orthoDispatch; red/green test).
