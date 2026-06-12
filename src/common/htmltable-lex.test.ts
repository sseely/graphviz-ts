// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for the HTML-like label tokenizer.
 * @see lib/common/htmllex.c
 */
import { describe, expect, it } from 'vitest';
import { tokenize } from './htmltable-lex.js';
import type { OpenToken } from './htmltable-types.js';

describe('tokenize — table attrs', () => {
  it('tokenizes GRADIENTANGLE on TABLE', () => {
    const tok = tokenize('<TABLE GRADIENTANGLE="90">')[0] as OpenToken;
    expect(tok.attrs['gradientangle']).toBe('90');
  });

  it('tokenizes SIDES on TABLE', () => {
    const tok = tokenize('<TABLE SIDES="LT">')[0] as OpenToken;
    expect(tok.attrs['sides']).toBe('LT');
  });

  it('tokenizes PORT on TABLE', () => {
    const tok = tokenize('<TABLE PORT="p1">')[0] as OpenToken;
    expect(tok.attrs['port']).toBe('p1');
  });

  it('tokenizes GRADIENTANGLE and SIDES together on TABLE', () => {
    const tok = tokenize('<TABLE GRADIENTANGLE="45" SIDES="LTRB">')[0] as OpenToken;
    expect(tok.attrs['gradientangle']).toBe('45');
    expect(tok.attrs['sides']).toBe('LTRB');
  });
});

describe('tokenize — cell attrs', () => {
  it('tokenizes GRADIENTANGLE on TD', () => {
    const tok = tokenize('<TD GRADIENTANGLE="180">')[0] as OpenToken;
    expect(tok.attrs['gradientangle']).toBe('180');
  });

  it('tokenizes SIDES on TD', () => {
    const tok = tokenize('<TD SIDES="LR">')[0] as OpenToken;
    expect(tok.attrs['sides']).toBe('LR');
  });

  it('tokenizes PORT on TD', () => {
    const tok = tokenize('<TD PORT="myport">')[0] as OpenToken;
    expect(tok.attrs['port']).toBe('myport');
  });

  it('lowercases attribute names', () => {
    const tok = tokenize('<TD gradientangle="30" sides="T">')[0] as OpenToken;
    expect(tok.attrs['gradientangle']).toBe('30');
    expect(tok.attrs['sides']).toBe('T');
  });
});

describe('tokenize — basic tokens', () => {
  it('produces open token for TABLE', () => {
    const tokens = tokenize('<TABLE>');
    expect(tokens[0]).toMatchObject({ type: 'open', tag: 'TABLE' });
  });

  it('produces text token', () => {
    expect(tokenize('hello')[0]).toMatchObject({ type: 'text', value: 'hello' });
  });

  it('produces close token', () => {
    expect(tokenize('</TABLE>')[0]).toMatchObject({ type: 'close', tag: 'TABLE' });
  });
});
