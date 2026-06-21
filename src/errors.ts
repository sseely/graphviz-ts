// SPDX-License-Identifier: EPL-2.0

/**
 * Public structured-error contract for graphviz-ts.
 *
 * Consumers branch on the stable `code` / `type` fields; the
 * `code -> friendlyMessage` map is the single seam a future i18n library
 * replaces. This module is a runtime leaf: the only project import is the
 * type-only `Expectation`, which is erased at compile time.
 *
 * @see plans/structured-errors/decisions.md
 */

import type { Expectation } from './parser/dot.js';

/** Stable public alias of peggy's expectation union (SYNTAX_* errors only). */
export type GvExpectation = Expectation;

/** Coarse classification of where an error originated. */
export type GvErrorType = 'syntax' | 'semantic' | 'render';

/** Closed union of stable error codes — each is an i18n key. */
export type GvErrorCode =
  | 'SYNTAX_ERROR' // peggy parse failure (token found)
  | 'SYNTAX_UNEXPECTED_EOF' // peggy parse failure, found === null
  | 'EDGE_OP_DIRECTED_IN_UNDIRECTED' // '->' used in an undirected graph
  | 'EDGE_OP_UNDIRECTED_IN_DIRECTED' // '--' used in a digraph
  | 'HTML_PARSE_ERROR' // HTML-like label parse failure
  | 'RENDER_ERROR' // known layout/render-stage failure
  | 'GENERIC_ERROR'; // catch-all fallback

/** Structured error contract shared by every error source. */
export interface GvError {
  type: GvErrorType;
  /** Stable i18n key. */
  code: GvErrorCode;
  /** Concise technical text we own (may diverge from C). */
  message: string;
  /** Approachable, non-localized English (delivery). */
  friendlyMessage: string;
  /** Real error position; the highest-value field. */
  location?: { line: number; column: number; offset?: number };
  /** Peggy's discriminated union, passed through unmapped; SYNTAX_* only. */
  expected?: GvExpectation[];
}

/** Result of a result-style render: `svg` XOR `errors` for v1. */
export interface RenderResult {
  /** Present on success. */
  svg?: string;
  /** Present on failure; length <= 1 (first failure only) for v1. */
  errors?: GvError[];
}

/**
 * Central `code -> friendlyMessage` map. Non-localized, approachable English.
 * This is the seam a future i18n library replaces.
 */
export const FRIENDLY_MESSAGES: Record<GvErrorCode, string> = {
  SYNTAX_ERROR: 'There is a syntax error in the DOT source.',
  SYNTAX_UNEXPECTED_EOF:
    'The DOT source ended unexpectedly — a bracket or statement may be unclosed.',
  EDGE_OP_DIRECTED_IN_UNDIRECTED:
    "A directed edge '->' was used in an undirected graph; use '--' instead.",
  EDGE_OP_UNDIRECTED_IN_DIRECTED:
    "An undirected edge '--' was used in a directed graph; use '->' instead.",
  HTML_PARSE_ERROR: 'An HTML-like label could not be parsed.',
  RENDER_ERROR: 'The graph could not be laid out or rendered.',
  GENERIC_ERROR: 'An unexpected error occurred while rendering the graph.',
};

/**
 * Look up the approachable English message for a code. The single seam a
 * future i18n library replaces.
 */
export function friendlyMessageFor(code: GvErrorCode): string {
  return FRIENDLY_MESSAGES[code];
}

/**
 * Error thrown for known layout/render-stage failures. Only `RENDER_ERROR`
 * and `GENERIC_ERROR` are valid render-stage codes.
 */
export class RenderError extends Error implements GvError {
  readonly type = 'render';
  readonly code: GvErrorCode;
  readonly friendlyMessage: string;

  constructor(message: string, code: GvErrorCode = 'RENDER_ERROR') {
    super(message);
    this.name = 'RenderError';
    this.code = code;
    this.friendlyMessage = friendlyMessageFor(code);
  }
}
