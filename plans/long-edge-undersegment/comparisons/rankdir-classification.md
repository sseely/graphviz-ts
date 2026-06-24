<!-- SPDX-License-Identifier: EPL-2.0 -->

# D5 — rankdir_dot row classification

Per [decisions.md#d5](../decisions.md#d5): decide, per row, whether the residual
is the SAME under-segmentation class as p3 (a fitter piece-count flip driven by
the non-integer x-frame) or a SEPARATE divergence.

## Method

Render each row through the port and the oracle
(`GVBINDIR=/tmp/gvplugins …/dot -Tsvg`); compare node text positions (layout
frame) and per-`<path>` cubic-piece counts; then re-test after the
`normalizeXcoords` x-frame fix (D-fixsite).

## Findings

| Row | nodes byte-match | diverging edges | piece-count delta | x-frame fix resolves? |
|-----|------------------|-----------------|-------------------|------------------------|
| `linux.x86-rankdir_dot`  | yes | 1 (path[18]) | port 2 / oracle 1 | **no** |
| `linux.x86-rankdir_dot2` | yes | 1            | off-by-one        | **no** |
| `nshare-rankdir_dot`     | yes | 1            | off-by-one        | **no** |
| `nshare-rankdir_dot2`    | yes | 1            | off-by-one        | **no** |

- **Nodes byte-match** the oracle on all four rows, so the residual is NOT the
  ~7.5pt label-height LAYOUT residual recorded in memory `size-attr-scaling-done`
  (that would move node positions). The text/ellipse coordinates are identical.
- Each row has **exactly one** diverging edge: a single long edge where the port
  emits one *extra* cubic (port 2 / oracle 1) — note this is the *opposite*
  direction from p3 (port *under*-segments 3/4). Both are single-piece flips,
  the signature of a fitter knife-edge.
- **The x-frame fix (D-fixsite) fully resolves p3 but does NOT flip these rows.**
  These are `rankdir=LR` graphs: dot lays out internally TB and rotates 90° in
  postprocess. The `normalizeXcoords` fix corrects the internal-x (cross-rank)
  frame — which is sufficient for p3 (TB) but leaves the rankdir rows diverged,
  so their piece-count flip is driven by a **separate** residual in the
  rotation / other-axis frame, not the x-normalize class that p3 belonged to.

## Verdict (D5)

The four `*-rankdir_dot`/`dot2` rows are a **SEPARATE residual class**: the
canonical x-frame under-segmentation fix does not resolve them. Per **D3** (do
not chase an unrelated layout bug) and **D5** (flip required ONLY if same class),
they are documented here and **not** chased in this mission. The hard floor —
flip `graphs-p3` + 0 regressions — is unaffected.

See [graphs-p3-residual.md](./graphs-p3-residual.md) for the resolved p3 case.
