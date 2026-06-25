#!/usr/bin/env sh
# SPDX-License-Identifier: EPL-2.0
#
# Build a HEADLESS GVBINDIR for the native `dot` oracle: core + dot_layout
# plugins ONLY (no gd / pango / quartz). With no text-layout plugin loaded,
# graphviz falls back to estimate_textspan_size — the deterministic,
# font-stack-independent measurement that the port's EstimateTextMeasurer
# reproduces. This is the oracle the rules survey (npm run survey) diffs against.
#
# Usage:  sh test/corpus/gen-headless-gvbindir.sh [outDir]
# Env:    GRAPHVIZ_BUILD (default ~/git/graphviz/build), DOT_BIN
#
# @see plans/fix-xcoord-position/DESIGN.md (headless oracle)
# @see plans/fix-xcoord-position/batch-0/T0.2-headless-corpus.md
set -eu

BUILD="${GRAPHVIZ_BUILD:-$HOME/git/graphviz/build}"
OUT="${1:-/tmp/ghl}"
DOT="${DOT_BIN:-$BUILD/cmd/dot/dot}"

[ -x "$DOT" ] || { echo "dot binary not found/executable: $DOT" >&2; exit 1; }

mkdir -p "$OUT"
# Symlink only the two headless-safe plugins. Omitting gd/pango/quartz leaves
# the text-layout slot empty, which is what forces the estimate path.
for plugin in core dot_layout; do
  found=0
  for lib in "$BUILD/plugin/$plugin/"libgvplugin_"$plugin".*; do
    [ -e "$lib" ] || continue
    ln -sf "$lib" "$OUT/"
    found=1
  done
  [ "$found" = 1 ] || { echo "no libgvplugin_$plugin under $BUILD/plugin/$plugin" >&2; exit 1; }
done

# Regenerate config for exactly these plugins (textlayout ends up empty).
GVBINDIR="$OUT" "$DOT" -c
echo "headless GVBINDIR ready at $OUT (estimate path)"
