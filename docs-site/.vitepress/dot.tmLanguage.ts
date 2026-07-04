// SPDX-License-Identifier: EPL-2.0
//
// Minimal TextMate grammar for the Graphviz DOT language, registered with
// VitePress/Shiki via markdown.languages so ```dot fences are syntax-highlighted
// (Shiki bundles no `dot` grammar, so it otherwise warns and falls back to txt).
// We highlight the source rather than render it: one corpus example in the docs
// is a documented infinite-loop repro, so rendering ```dot at build time is
// unsafe. @see docs-site/.vitepress/config.ts

import type { LanguageRegistration } from 'shiki';

export const dotLang: LanguageRegistration = {
  name: 'dot',
  scopeName: 'source.dot',
  aliases: ['graphviz', 'gv'],
  patterns: [
    { include: '#comment' },
    { include: '#keyword' },
    { include: '#string' },
    { include: '#operator' },
    { include: '#number' },
    { include: '#attribute' },
  ],
  repository: {
    comment: {
      patterns: [
        { name: 'comment.block.dot', begin: '/\\*', end: '\\*/' },
        { name: 'comment.line.double-slash.dot', match: '//.*$' },
        { name: 'comment.line.number-sign.dot', match: '^\\s*#.*$' },
      ],
    },
    // DOT keywords are case-insensitive (graph/Graph/GRAPH all valid).
    keyword: {
      patterns: [
        {
          name: 'keyword.control.dot',
          match: '(?i)\\b(strict|graph|digraph|subgraph|node|edge)\\b',
        },
      ],
    },
    string: {
      patterns: [
        {
          name: 'string.quoted.double.dot',
          begin: '"',
          end: '"',
          patterns: [{ name: 'constant.character.escape.dot', match: '\\\\.' }],
        },
      ],
    },
    operator: {
      patterns: [
        { name: 'keyword.operator.edge.dot', match: '->|--' },
        { name: 'keyword.operator.assignment.dot', match: '=' },
      ],
    },
    number: {
      patterns: [{ name: 'constant.numeric.dot', match: '\\b-?\\d+(\\.\\d+)?\\b' }],
    },
    attribute: {
      patterns: [{ name: 'variable.other.dot', match: '\\b[A-Za-z_][A-Za-z0-9_]*\\b' }],
    },
  },
};
