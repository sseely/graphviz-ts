// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { parseArrow, resolveArrowType } from './arrows.js';
import {
  ARR_TYPE_NORM, ARR_TYPE_CROW, ARR_TYPE_TEE, ARR_TYPE_BOX,
  ARR_TYPE_DIAMOND, ARR_TYPE_DOT, ARR_TYPE_CURVE, ARR_TYPE_GAP,
  ARR_MOD_INV,
} from './arrows-constants.js';

const resolve = (s: string) => resolveArrowType(parseArrow(s)[0]);

describe('resolveArrowType — acceptance criteria', () => {
  it('AC1: odot → {type:DOT, open:true, lenfact:0.8}', () => {
    const r = resolve('odot');
    expect(r.type).toBe(ARR_TYPE_DOT);
    expect(r.open).toBe(true);
    expect(r.lenfact).toBe(0.8);
  });

  it('AC2: vee → CROW with INV set', () => {
    const r = resolve('vee');
    expect(r.type).toBe(ARR_TYPE_CROW | ARR_MOD_INV);
    expect(r.lenfact).toBe(1.0);
  });

  it('AC3: inv → NORM with INV set', () => {
    const r = resolve('inv');
    expect(r.type).toBe(ARR_TYPE_NORM | ARR_MOD_INV);
    expect(r.lenfact).toBe(1.0);
  });

  it('AC4: unknown name → NORM (C default)', () => {
    // parseArrow falls back to {name:'normal'} on no match, but resolve must
    // also tolerate a stray name directly.
    const r = resolveArrowType({ name: 'bogus', open: false, left: false, right: false });
    expect(r.type).toBe(ARR_TYPE_NORM);
    expect(r.lenfact).toBe(1.0);
  });
});

describe('resolveArrowType — full type table lenfacts', () => {
  it('maps every base name to its ARR_TYPE_* + lenfact', () => {
    expect(resolve('normal')).toMatchObject({ type: ARR_TYPE_NORM, lenfact: 1.0 });
    expect(resolve('crow')).toMatchObject({ type: ARR_TYPE_CROW, lenfact: 1.0 });
    expect(resolve('tee')).toMatchObject({ type: ARR_TYPE_TEE, lenfact: 0.5 });
    expect(resolve('box')).toMatchObject({ type: ARR_TYPE_BOX, lenfact: 1.0 });
    expect(resolve('diamond')).toMatchObject({ type: ARR_TYPE_DIAMOND, lenfact: 1.2 });
    expect(resolve('dot')).toMatchObject({ type: ARR_TYPE_DOT, lenfact: 0.8 });
    expect(resolve('none')).toMatchObject({ type: ARR_TYPE_GAP, lenfact: 0.5 });
    expect(resolve('curve')).toMatchObject({ type: ARR_TYPE_CURVE, lenfact: 1.0 });
    expect(resolve('icurve')).toMatchObject({ type: ARR_TYPE_CURVE | ARR_MOD_INV, lenfact: 1.0 });
  });
});

describe('resolveArrowType — modifiers and synonyms', () => {
  it('open == vee (pen kludge): CROW|INV', () => {
    expect(resolve('open').type).toBe(ARR_TYPE_CROW | ARR_MOD_INV);
  });

  it('empty == open-normal (mpty kludge): NORM, open:true', () => {
    const r = resolve('empty');
    expect(r.type).toBe(ARR_TYPE_NORM);
    expect(r.open).toBe(true);
  });

  it('invempty synonym → NORM|INV, open:true', () => {
    const r = resolve('invempty');
    expect(r.type).toBe(ARR_TYPE_NORM | ARR_MOD_INV);
    expect(r.open).toBe(true);
  });

  it('side modifiers carry through: lnormal → left, rdiamond → right', () => {
    expect(resolve('lnormal')).toMatchObject({ type: ARR_TYPE_NORM, left: true, right: false });
    expect(resolve('rdiamond')).toMatchObject({ type: ARR_TYPE_DIAMOND, left: false, right: true });
  });
});
