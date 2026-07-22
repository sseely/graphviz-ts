// SPDX-License-Identifier: EPL-2.0
//
// Shared, pure helpers for linking corpus test ids to their upstream gitlab
// source and scrubbing the author's local machine paths out of generated
// dashboard tables (AD-4, plans/docs-overhaul/decisions.md#gitlab-links).
//
// `test/corpus/dashboard.ts` already gitlab-links the corpus ROOT
// (`CORPUS_GITLAB` / `corpusRootMd`), but per-id rows and embedded
// oracle/port error messages were emitted verbatim, leaking paths like
// `/Users/<name>/git/graphviz/...`. Every dashboard generator
// (dashboard.ts, parity-report.ts, json-dashboard.ts, map-dashboard.ts,
// xdot-dashboard.ts) renders its per-id id column and message cells through
// these helpers instead, so the committed PARITY-*.md never leaks a local
// absolute path. Node-only dev/test infra — never imported by src/index.ts.

import { homedir } from 'node:os';

/** Upstream source of individual corpus test files (graphviz's own repo). */
export const CORPUS_GITLAB_BLOB = 'https://gitlab.com/graphviz/graphviz/-/blob/main/tests';

/** Escape a string for literal (non-metacharacter) use inside a `RegExp`. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Join a corpus-relative path (e.g. `1447.dot`, `imagepath_test/base.gv`,
 * `graphs/b53.gv`) to the gitlab blob URL for graphviz's `tests/` tree.
 * Normalizes `\` separators to `/` and strips a leading `.../tests/` segment
 * (if the caller passed a path that still carries the corpus root's
 * trailing `tests/` folder name), so the same helper accepts either a bare
 * corpus-relative path or one rooted at `tests/`.
 */
export function gitlabTestUrl(corpusRelPath: string): string {
  const normalized = corpusRelPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const stripped = normalized.replace(/^.*?\btests\//, '');
  return `${CORPUS_GITLAB_BLOB}/${stripped}`;
}

/**
 * Render a test id for a dashboard table: a markdown link to its gitlab blob
 * when a corpus-relative path is known, else the id verbatim as inline code.
 */
export function testIdLink(id: string, corpusRelPath?: string): string {
  return corpusRelPath ? `[\`${id}\`](${gitlabTestUrl(corpusRelPath)})` : `\`${id}\``;
}

/**
 * The native oracle binary's build-tree path always ends in `cmd/dot/dot`
 * (the `dot` command's build output; see test/corpus/README.md's `DOT_BIN`
 * default) — collapse any such absolute invocation path to the bare command
 * name `dot`, independent of `roots`.
 */
const ORACLE_BIN_PATTERN = /\S*\/cmd\/dot\/dot\b/g;

/**
 * An absolute path segment naming the corpus root's `tests/` directory,
 * followed by the corpus-relative remainder — rewritten to its gitlab blob
 * URL so the reader lands on the upstream source instead of a dead local path.
 */
const TESTS_PATH_PATTERN = /\S*\/tests\/(\S+)/g;

/**
 * Derive the default local-path roots to scrub: the corpus root, the oracle
 * plugin dir, and the user's home directory (mirrors the env vars `survey.ts`
 * / `engine-walk.ts` / `json-walk.ts` / `xdot-walk.ts` / `map-walk.ts` read).
 * Impure (reads env + os) — only called when the caller omits `roots`.
 */
function defaultRoots(): string[] {
  return [process.env.CORPUS_ROOT, process.env.GVBINDIR, homedir()].filter(
    (r): r is string => Boolean(r),
  );
}

/**
 * Scrub the author's local machine paths out of an oracle/port error message
 * before it enters a generated dashboard table.
 *
 * - The native oracle binary's invocation path collapses to `dot`.
 * - A `.../tests/<rel>` occurrence rewrites to its gitlab blob URL.
 * - Any remaining occurrence of a known root (corpus root, GVBINDIR, or
 *   `$HOME`) is stripped, so a leftover local path becomes relative/anonymous
 *   rather than a local absolute path.
 *
 * Pure when `roots` is supplied explicitly (for testability) — reads
 * `process.env`/`os.homedir()` only to derive the default roots.
 */
export function scrubLocalPaths(msg: string, roots?: string[]): string {
  let out = msg.replace(ORACLE_BIN_PATTERN, 'dot');
  out = out.replace(TESTS_PATH_PATTERN, (_m, rel: string) => gitlabTestUrl(rel));
  for (const root of roots ?? defaultRoots()) {
    if (!root) continue;
    out = out.replace(new RegExp(`${escapeRegExp(root)}/?`, 'g'), '');
  }
  return out;
}
