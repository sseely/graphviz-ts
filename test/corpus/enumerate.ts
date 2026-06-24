// SPDX-License-Identifier: EPL-2.0
//
// Corpus enumerator for the dot parity survey (mission: dot-corpus-harness, T1).
//
// Walks the graphviz C test corpus, collects every `*.gv` / `*.dot` input, and
// classifies each as `applicable` (a default-engine DOT graph the survey will
// render) or `quarantined` with an explicit reason from the taxonomy in
// plans/mission-dot-corpus-harness/decisions.md. Output is a committed
// `corpus-manifest.json` consumed by T2 (survey.ts).
//
// This is dev/test infra: Node-only, never imported by src/index.ts. It does
// NOT render or lay out — only cheap structural (regex/scan) classification.
// Full-render parse failures are discovered later by T2 (parse-unsupported).

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';

/** A single classified corpus entry (interface contract consumed by T2). */
export interface CorpusEntry {
  id: string;
  path: string; // relative to the corpus root
  engine: 'dot';
  status: 'applicable' | 'quarantined';
  reason?: QuarantineReason;
}

/** Quarantine reasons — the locked taxonomy (decisions.md). */
export type QuarantineReason =
  | 'engine-deferred'
  | 'gvpr'
  | 'multi-graph'
  | 'include'
  | 'non-graph'
  | 'raster-only-ref'
  | 'parse-unsupported'
  | 'malformed';

/** Non-dot engines: an explicit `layout=` to one of these defers the input. */
const FORCE_ENGINES = ['neato', 'fdp', 'sfdp', 'circo', 'twopi', 'osage', 'patchwork'];

// Brace literals built from char codes so no `{`/`}` appears inside a regex
// literal or comparison — lizard's TS tokenizer loses brace balance otherwise
// and falsely merges adjacent functions (a known false positive).
const LBRACE = String.fromCharCode(123); // {
const RBRACE = String.fromCharCode(125); // }
const DQUOTE = String.fromCharCode(34); // "

/** `graph`/`digraph` header (case-insensitive) OR a single brace. */
const GRAPH_OR_BRACE = new RegExp(
  '\\b(?:di)?graph\\b|[' + LBRACE + RBRACE + ']',
  'gi',
);
/** A double-quoted DOT string (with escapes). */
const DQ_STRING = new RegExp(
  DQUOTE + '(?:\\\\.|[^' + DQUOTE + '\\\\])*' + DQUOTE,
  'g',
);
/** `layout=<engine>` with an optional opening quote; captures the engine name. */
const LAYOUT_ATTR = new RegExp('\\blayout\\s*=\\s*' + DQUOTE + '?([a-z]+)', 'i');

// Slash/star built from char codes so the comment regexes below contain no
// literal `//`, `/*`, or `*/` — which lizard's tokenizer would read as actual
// comments and run past a function's closing brace (false-merge artifact).
const SLASH = String.fromCharCode(47); // /
const STAR = String.fromCharCode(42); // *
/** A C-style block comment. */
const BLOCK_COMMENT = new RegExp(SLASH + '\\' + STAR + '[\\s\\S]*?\\' + STAR + SLASH, 'g');
/** A line comment (`#` or `//`) including leading whitespace, keeping the newline. */
const LINE_COMMENT = new RegExp('(^|\\n)\\s*(#|' + SLASH + SLASH + ')[^\\n]*', 'g');

/** Default corpus root; overridable via argv[2] or CORPUS_ROOT. */
export function corpusRoot(): string {
  return process.argv[2] ?? process.env.CORPUS_ROOT ?? join(homedir(), 'git/graphviz/tests');
}

/** Recursively collect `*.gv` and `*.dot` files under `dir`. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(gv|dot)$/i.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip C/C++-style comments and quoted strings so structural scans (graph
 * keyword counting, brace depth) don't trip on graph text inside labels.
 * Replaces string/comment bodies with spaces to preserve offsets loosely.
 */
function stripComments(src: string): string {
  return src.replace(BLOCK_COMMENT, ' ').replace(LINE_COMMENT, '$1');
}

/** Additionally blank double-quoted string bodies (for keyword/brace scans). */
function stripCommentsAndStrings(src: string): string {
  return stripComments(src).replace(DQ_STRING, DQUOTE + DQUOTE);
}

/**
 * Count top-level (brace-depth 0) graph headers. The pattern `\b(?:di)?graph\b`
 * matches `graph` and `digraph` but NOT `subgraph` (no word boundary precedes
 * the inner `graph` and the optional `di` is absent), so subgraphs are skipped
 * without a separate guard.
 */
function topLevelGraphCount(stripped: string): number {
  let depth = 0;
  let count = 0;
  GRAPH_OR_BRACE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GRAPH_OR_BRACE.exec(stripped)) !== null) {
    const tok = m[0];
    if (tok === LBRACE) depth++;
    else if (tok === RBRACE) depth = Math.max(0, depth - 1);
    else if (depth === 0) count++;
  }
  return count;
}

/** Detect an explicit `layout=<engine>` selecting a non-dot engine. */
function forcedEngine(stripped: string): string | null {
  const m = stripped.match(LAYOUT_ATTR);
  const engine = m?.[1]?.toLowerCase();
  return engine && FORCE_ENGINES.includes(engine) ? engine : null;
}

/** Classify one input's source text. Cheap structural checks only (T1). */
export function classify(src: string): { status: CorpusEntry['status']; reason?: QuarantineReason } {
  if (/^\s*#include\b/m.test(src)) return { status: 'quarantined', reason: 'include' };
  const graphs = topLevelGraphCount(stripCommentsAndStrings(src));
  if (graphs === 0) return { status: 'quarantined', reason: 'non-graph' };
  if (graphs > 1) return { status: 'quarantined', reason: 'multi-graph' };
  if (forcedEngine(stripComments(src))) return { status: 'quarantined', reason: 'engine-deferred' };
  return { status: 'applicable' };
}

/** Stable slug from a relative path: drop extension, `/` → `-`. */
function slug(relPath: string): string {
  return relPath.replace(/\.(gv|dot)$/i, '').replace(/[/\\]/g, '-');
}

/**
 * Manually-triaged quarantines, keyed by corpus-relative path. These inputs
 * pass structural classification AND parse + render, so `classify()` (cheap
 * structural scan only) cannot catch them — they are force-quarantined here
 * after a human triage decision recorded in
 * plans/mission-dot-corpus-harness/decision-journal.md.
 *
 * - `2782.dot` — `malformed`: fuzzer input. Native dot itself emits HTML parse
 *   errors on its broken labels and produces a degenerate ~106302 × 10495018 pt
 *   canvas from a nonsense `minlen=283647`; the survey reports maxDelta 5572860,
 *   a single offset element at that astronomical scale. Sub-pixel parity is
 *   meaningless, so it is left as poorly-formed rather than chased.
 */
const MANUAL_QUARANTINE: Record<string, QuarantineReason> = {
  '2782.dot': 'malformed',
};

/** Build the manifest from the corpus root, ensuring unique ids. */
export function buildManifest(root: string): CorpusEntry[] {
  const files = walk(root).sort();
  const seen = new Map<string, number>();
  const entries: CorpusEntry[] = [];
  for (const full of files) {
    const relPath = relative(root, full).replace(/\\/g, '/');
    let id = slug(relPath);
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    const manual = MANUAL_QUARANTINE[relPath];
    const { status, reason } = manual
      ? { status: 'quarantined' as const, reason: manual }
      : classify(readFileSync(full, 'utf8'));
    entries.push({ id, path: relPath, engine: 'dot', status, ...(reason ? { reason } : {}) });
  }
  return entries;
}

/** Summarise counts for README / logging. */
export function summarise(entries: CorpusEntry[]): {
  total: number;
  applicable: number;
  quarantined: Record<string, number>;
} {
  const quarantined: Record<string, number> = {};
  let applicable = 0;
  for (const e of entries) {
    if (e.status === 'applicable') applicable++;
    else quarantined[e.reason ?? 'unknown'] = (quarantined[e.reason ?? 'unknown'] ?? 0) + 1;
  }
  return { total: entries.length, applicable, quarantined };
}

// CLI entry: write corpus-manifest.json next to this file and print a summary.
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const root = corpusRoot();
  const entries = buildManifest(root);
  const outPath = new URL('./corpus-manifest.json', import.meta.url);
  writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n');
  const s = summarise(entries);
  process.stderr.write(
    `corpus root: ${root}\n` +
      `total: ${s.total}  applicable: ${s.applicable}\n` +
      `quarantined: ${JSON.stringify(s.quarantined)}\n`,
  );
}
