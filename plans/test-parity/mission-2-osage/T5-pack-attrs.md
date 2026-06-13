# T5 — pack/packmode attribute parsing in lib/pack port

## Context
getPackModeInfo reads `g.info.packMode` (never set by anything) and
getPack reads `g.info.pack`; C reads the GRAPH ATTRS "packmode"/"pack"
via agget. parsePackModeInfo also lacks C's full syntax:
`array(_<flags>)(<int>)` where flags ∈ c,i,u,t,b,l,r (PK_COL_MAJOR,
PK_INPUT_ORDER, PK_USER_VALS, aligns) and trailing int = pinfo.sz;
`aspect<float>` sets pinfo.aspect (default 1). getPack semantics:
attr unset → not_def; numeric ≥ 0 → value; 't'/'T' → dflt.

## Task
Port parsePackModeInfo + chkFlags + getPackModeInfo + getPack
faithfully in src/layout/pack/index.ts. Graph attr lookup: g.attrs
falling back to root (agget semantics).

## Read-set
~/git/graphviz/lib/pack/pack.c:1143-1290 (chkFlags through getPack).

## Acceptance criteria
- Given packmode="array_u2", parsePackModeInfo sets mode=Array,
  flags=PK_USER_VALS, sz=2 (unit-test in pack tests if a test file
  exists; otherwise assert via osage behavior)
- osage-array-mode golden still PASSES
- Full suite: no previously passing test fails (pack attrs become
  live for neato/fdp component packing — gates are the canary)

## Write-set
src/layout/pack/index.ts (+ src/layout/pack/*.test.ts if present) —
journal entry (src/layout/pack/* is the allowed exception).

## Commit
`fix(pack): read pack/packmode graph attrs with full C syntax`
