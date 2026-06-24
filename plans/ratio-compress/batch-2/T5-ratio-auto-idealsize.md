<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — ratio=auto / idealsize (UNPORTED) (DEFERRED)

## Dead-code state
Unlike fill/expand/value, `ratio=auto`'s `set_aspect` behavior is **not ported at
all**: `aspectScaleFactors` returns `null` for `'auto'`, and C's `idealsize` (the
function that decides whether auto should fill) has **no port**. Auto currently
"works by omission" — `b68` (`ratio=auto`) byte-matches because, for it,
`idealsize` would return false (no scaling needed) and the port's null-return
happens to produce the same result.

## C reference
`lib/dotgen/position.c:916` — `R_AUTO → filled = idealsize(g, .5)`; if true,
auto behaves like R_FILL. `idealsize(graph_t*, double)` (position.c) computes
whether the drawing should be scaled to ~half the page and is the missing piece.
`lib/common/input.c:578` (`setRatio` → R_AUTO).

## Corpus / risk
`b68` is the only `ratio=auto` graph and is **byte-match today**. **Primary risk:
porting `idealsize` and populating `drawing` for auto could change b68** if the
port's `idealsize` disagrees with C on the fill decision. New code (idealsize),
not just wiring.

## Why deferred
Real new logic (`idealsize`) plus a fragile byte-match (b68) to protect, for a
single corpus graph that already passes. Lowest priority; captured so the
unported `idealsize` / auto branch is on record.

## When taken up
Port `idealsize` faithfully; populate `drawing` for auto; require `b68` stays
byte-match and add an oracle-pinned auto-fills case (a graph where idealsize
returns true) to exercise the live path.
