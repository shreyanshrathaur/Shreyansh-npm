import { describe, it, expect } from 'vitest';
import {
  walkValue,
  escapePathKey,
  buildObjectPath,
  buildArrayElementPath,
  isPathIgnored,
  getTypeString,
} from '../src/walk.js';

describe('walk utility functions', () => {
  it('escapes keys and builds object paths properly', () => {
    expect(escapePathKey('foo')).toBe('foo');
    expect(escapePathKey('foo-bar')).toBe('["foo-bar"]');
    expect(buildObjectPath('$', 'normal')).toBe('$.normal');
    expect(buildObjectPath('$', 'k-e-y')).toBe('$["k-e-y"]');
    expect(buildObjectPath('$.parent', 'child')).toBe('$.parent.child');
    expect(buildObjectPath('$.parent', 'k-e-y')).toBe('$.parent["k-e-y"]');
    expect(buildArrayElementPath('$.items')).toBe('$.items[]');
  });

  it('determines ignored paths and subtrees', () => {
    expect(isPathIgnored('$.token', ['$.token'])).toBe(true);
    expect(isPathIgnored('$.token.secret', ['$.token'])).toBe(true);
    expect(isPathIgnored('$.token["sub"]', ['$.token'])).toBe(true);
    expect(isPathIgnored('$.token[]', ['$.token'])).toBe(true);
    expect(isPathIgnored('$.other', ['$.token'])).toBe(false);
    expect(isPathIgnored('$.other', [])).toBe(false);
    expect(isPathIgnored('$.other', undefined)).toBe(false);
  });

  it('correctly resolves type strings', () => {
    expect(getTypeString(null)).toBe('null');
    expect(getTypeString([1, 2])).toBe('array');
    expect(getTypeString('text')).toBe('string');
    expect(getTypeString(42)).toBe('number');
    expect(getTypeString(NaN)).toBe('number');
    expect(getTypeString(true)).toBe('boolean');
    expect(getTypeString({})).toBe('object');
    expect(getTypeString(undefined)).toBe('undefined');
  });
});

describe('walkValue', () => {
  it('walks flat and nested objects', () => {
    const data = {
      id: 1,
      name: 'Test',
      active: true,
      tags: ['a', 'b'],
      profile: {
        role: 'admin',
      },
      deletedAt: null,
    };

    const res = walkValue(data);
    expect(res.has('$')).toBe(true);
    expect(res.has('$.id')).toBe(true);
    expect(res.get('$.id')?.type).toBe('number');
    expect(res.has('$.name')).toBe(true);
    expect(res.has('$.active')).toBe(true);
    expect(res.has('$.tags')).toBe(true);
    expect(res.has('$.tags[]')).toBe(true);
    expect(res.has('$.profile')).toBe(true);
    expect(res.has('$.profile.role')).toBe(true);
    expect(res.get('$.deletedAt')?.isNull).toBe(true);
  });

  it('respects depth limits', () => {
    const deepObj = { l1: { l2: { l3: { l4: 'deep' } } } };
    const res = walkValue(deepObj, { maxDepth: 2 });
    expect(res.has('$.l1')).toBe(true);
    expect(res.has('$.l1.l2')).toBe(true);
    expect(res.has('$.l1.l2.l3')).toBe(false);
  });

  it('respects maxArrayItems', () => {
    const arr = Array.from({ length: 30 }, (_, i) => ({ idx: i }));
    const res = walkValue(arr, { maxArrayItems: 5 });
    expect(res.has('$')).toBe(true);
    expect(res.has('$[]')).toBe(true);
    expect(res.has('$[].idx')).toBe(true);
  });

  it('ignores ignored paths and does not traverse them', () => {
    const data = {
      safe: 123,
      secret: { key: 'topsecret' },
    };
    const res = walkValue(data, { ignorePaths: ['$.secret'] });
    expect(res.has('$.safe')).toBe(true);
    expect(res.has('$.secret')).toBe(false);
    expect(res.has('$.secret.key')).toBe(false);
  });

  it('handles circular references and prototype properties safely', () => {
    const circular: any = { a: 1 };
    circular.self = circular;

    const res = walkValue(circular);
    expect(res.has('$.a')).toBe(true);
    expect(res.has('$.self')).toBe(true);

    const protoTest = JSON.parse('{"__proto__": {"polluted": true}, "constructor": 123, "valid": 456}');
    const protoRes = walkValue(protoTest);
    expect(protoRes.has('$.valid')).toBe(true);
    expect(protoRes.has('$.__proto__')).toBe(false);
  });
});
