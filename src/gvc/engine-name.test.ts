// SPDX-License-Identifier: EPL-2.0

/**
 * Contract tests for the EngineName / BuiltinEngine types and their use at
 * the renderSvg boundary. The compile-time assertions are validated by the
 * `tsc --noEmit` gate (tsconfig includes test/** and src/**); the runtime
 * assertions exercise the registry dispatch.
 *
 * @see src/gvc/context.ts (EngineName, BuiltinEngine, GvcContext.layout)
 */

import { describe, test, expect } from 'vitest';
import { renderSvg } from '../index.js';
import type { BuiltinEngine, EngineName } from './context.js';

describe('EngineName / BuiltinEngine types', () => {
  test('builtins are valid, the registry stays open, and a string still fits', () => {
    const builtin: BuiltinEngine = 'dot';        // builtin literal
    const custom: EngineName = 'my-custom-engine'; // open registry — any name
    const fromVar: string = 'neato';
    const widened: EngineName = fromVar;         // non-breaking: string ⊆ EngineName
    expect([builtin, custom, widened]).toEqual(['dot', 'my-custom-engine', 'neato']);
  });

  test('BuiltinEngine rejects unknown names (typo guard)', () => {
    // @ts-expect-error — 'dott' is not a built-in; widening BuiltinEngine to
    // `string` would make this error disappear and fail the build here.
    const typo: BuiltinEngine = 'dott';
    expect(typo).toBe('dott');
  });
});

describe('renderSvg engine dispatch', () => {
  test('renders with a builtin engine', () => {
    expect(renderSvg('digraph { a }', 'dot')).toContain('<svg');
  });

  test('throws on an unregistered engine name', () => {
    expect(() => renderSvg('digraph { a }', 'bogus')).toThrow(
      /no layout engine registered: bogus/,
    );
  });
});
