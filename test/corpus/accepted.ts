// SPDX-License-Identifier: EPL-2.0
//
// Accepted-divergence registry loader + classifier (shared by dashboard.ts and
// rules-gate.ts). The registry (`accepted-divergences.json`) is the single
// source of truth for deliberate, documented, won't-fix divergences from C
// Graphviz; it is joined into the report/gate at read-time (parity.json stays
// pure). See that file's `comment` field and docs/known-divergences.md.
//
// Node-only dev/test infra — never imported by src/index.ts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Which join consumes an entry: the parity dashboard, the rules gate, or both. */
export type AcceptedScope = 'parity' | 'rules' | 'both';

/** How an entry selects graphs. Exactly one selector is expected per entry. */
export interface AcceptedMatch {
  /** Exact corpus id (e.g. `2368`). */
  id?: string;
  /** Glob over the id (`*` = any run within the id), e.g. `*-NaN`. */
  idPattern?: string;
  /** Layout engines this applies to (e.g. the force-directed family). */
  engineIn?: string[];
}

/** One accepted/known divergence. */
export interface AcceptedEntry {
  match: AcceptedMatch;
  /** Doc class — A1/A2/A3 (known-divergences.md) or R-* (rules allowlist). */
  class: string;
  scope: AcceptedScope;
  /** Expected verdict, if pinned (descriptive). */
  verdict?: string;
  /** Bound on the delta (descriptive). */
  bound?: string;
  reason: string;
  /** Anchor into the prose docs. */
  ref: string;
}

interface Registry { comment?: string; entries: AcceptedEntry[]; }

const DEFAULT_REGISTRY = new URL('./accepted-divergences.json', import.meta.url);

/** Read + parse the accepted-divergence registry. */
export function loadAccepted(path?: string): AcceptedEntry[] {
  const p = path ?? fileURLToPath(DEFAULT_REGISTRY);
  const reg = JSON.parse(readFileSync(p, 'utf8')) as Registry;
  return reg.entries;
}

/** True if `entry.scope` participates in the requested join scope. */
function scopeApplies(entry: AcceptedEntry, scope: 'parity' | 'rules'): boolean {
  return entry.scope === scope || entry.scope === 'both';
}

/** Glob match where `*` matches any (possibly empty) run of characters. */
function globMatch(pattern: string, id: string): boolean {
  const re = new RegExp('^' + pattern.split('*').map(escapeRe).join('.*') + '$');
  return re.test(id);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if `entry.match` selects this graph. */
function selects(entry: AcceptedEntry, id: string, engine: string | undefined): boolean {
  const m = entry.match;
  if (m.id !== undefined) return m.id === id;
  if (m.idPattern !== undefined) return globMatch(m.idPattern, id);
  if (m.engineIn !== undefined) return engine !== undefined && m.engineIn.includes(engine);
  return false;
}

/**
 * The first registry entry that accepts `id` (with `engine`) under `scope`, or
 * `null` if the divergence is NOT accepted (i.e. a tracked gap / a real
 * regression). `entries` is passed in so callers load the registry once.
 */
export function matchAccepted(
  id: string,
  engine: string | undefined,
  scope: 'parity' | 'rules',
  entries: AcceptedEntry[],
): AcceptedEntry | null {
  for (const e of entries) {
    if (scopeApplies(e, scope) && selects(e, id, engine)) return e;
  }
  return null;
}
