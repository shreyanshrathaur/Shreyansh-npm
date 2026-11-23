import { describe, it, expect } from 'vitest';
import { generateTypeScriptTypes, generateJsonSchema } from '../src/generators.js';
import { createShapewatch } from '../src/index.js';
import type { EndpointBaseline } from '../src/types.js';

describe('TypeScript & JSON Schema Generators', () => {
  const dummyBaseline: EndpointBaseline = {
    endpoint: 'GET /users/:id',
    samples: 10,
    frozen: true,
    createdAt: '',
    updatedAt: '',
    fields: {
      '$': {
        path: '$',
        seen: 10,
        eligible: 10,
        presentRatio: 1,
        typeCounts: { object: 10 },
        nullCount: 0,
        allowedTypes: ['object'],
        allowsNull: false,
        required: true,
      },
      '$.id': {
        path: '$.id',
        seen: 10,
        eligible: 10,
        presentRatio: 1,
        typeCounts: { number: 10 },
        nullCount: 0,
        allowedTypes: ['number'],
        allowsNull: false,
        required: true,
      },
      '$.email': {
        path: '$.email',
        seen: 10,
        eligible: 10,
        presentRatio: 1,
        typeCounts: { string: 10 },
        nullCount: 0,
        allowedTypes: ['string'],
        allowsNull: false,
        required: true,
        format: 'email',
      },
      '$.nickname': {
        path: '$.nickname',
        seen: 5,
        eligible: 10,
        presentRatio: 0.5,
        typeCounts: { string: 5 },
        nullCount: 0,
        allowedTypes: ['string'],
        allowsNull: false,
        required: false,
      },
    },
  };

  it('generates clean TypeScript interface string', () => {
    const ts = generateTypeScriptTypes(dummyBaseline, 'UserProfile');
    expect(ts).toContain('export interface UserProfile {');
    expect(ts).toContain('id: number;');
    expect(ts).toContain('email: string;');
    expect(ts).toContain('nickname?: string;');
  });

  it('generates valid JSON Schema object', () => {
    const schema = generateJsonSchema(dummyBaseline);
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.title).toBe('GET /users/:id');
    const props = schema.properties as Record<string, any>;
    expect(props.id.type).toBe('number');
    expect(props.email.format).toBe('email');
    expect(schema.required).toContain('id');
    expect(schema.required).toContain('email');
    expect(schema.required).not.toContain('nickname');
  });

  it('generates types directly from Shapewatch instance', () => {
    const sw = createShapewatch({ learnSamples: 1 });
    sw.observe('GET /profile', { username: 'shreyansh', age: 25 });

    const ts = sw.generateTypeScript('GET /profile', 'MyProfile');
    expect(ts).toContain('export interface MyProfile {');
    expect(ts).toContain('username: string;');
    expect(ts).toContain('age: number;');

    const schema = sw.generateJsonSchema('GET /profile');
    expect(schema.type).toBe('object');
  });
});
