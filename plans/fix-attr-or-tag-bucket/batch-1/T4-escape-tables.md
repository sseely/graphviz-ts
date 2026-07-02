<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — C escape tables per context

## Context
C emits `-` as `&#45;` in SVG text/titles; port emits raw `-`.
XML-equivalent (survey-invisible); byte-match-relevant.

## Task
Extract C's exact escaping per context from the SVG renderer
(~/git/graphviz/plugin/core/gvrender_core_svg.c + xml_string/xml_url
helpers in common/utils.c or util/): which characters, which contexts
(title text, label text, attr values, xlink:href). Map the port's emit
sites onto src/render/xml-escape.ts entry points; list any emit site
NOT routed through the choke point.

## Acceptance criteria
- Given the table, then per-context character lists are quoted with C
  refs, and a survey of port emit sites confirms coverage.

## Rollback / Observability
N/A. Reversible.

## Commit
folded into gate commit.
