import { describe, it, expect } from 'vitest';
import { compareObservation } from '../src/compare.js';
import type { EndpointBaseline } from '../src/types.js';

describe('compareObservation', () => {
  const baseBaseline: EndpointBaseline = {
    endpoint: 'GET /users/:id',
    samples: 20,
    frozen: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: {
      '$': {
        path: '$',
        seen: 20,
        eligible: 20,
        presentRatio: 1,
        typeCounts: { object: 20 },
        nullCount: 0,
        allowedTypes: ['object'],
        allowsNull: false,
        required: true,
      },
      '$.id': {
        path: '$.id',
        seen: 20,
        eligible: 20,
        presentRatio: 1,
        typeCounts: { number: 20 },
        nullCount: 0,
        allowedTypes: ['number'],
        allowsNull: false,
        required: true,
      },
      '$.name': {
        path: '$.name',
        seen: 20,
        eligible: 20,
        presentRatio: 1,
        typeCounts: { string: 20 },
        nullCount: 0,
        allowedTypes: ['string'],
        allowsNull: false,
        required: true,
      },
      '$.avatar': {
        path: '$.avatar',
        seen: 10,
        eligible: 20,
        presentRatio: 0.5,
        typeCounts: { string: 10 },
        nullCount: 0,
        allowedTypes: ['string'],
        allowsNull: false,
        required: false,
      },
      '$.bio': {
        path: '$.bio',
        seen: 20,
        eligible: 20,
        presentRatio: 1,
        typeCounts: { string: 10 },
        nullCount: 10,
        allowedTypes: ['string'],
        allowsNull: true,
        required: true,
      },
    },
  };

  it('produces no drift for a fully compatible sample', () => {
    const sample = {
      id: 1,
      name: 'Ada Lovelace',
      avatar: 'https://example.com/pic.jpg',
      bio: 'Mathematician',
    };
    const drifts = compareObservation('GET /users/:id', baseBaseline, sample);
    expect(drifts).toHaveLength(0);
  });

  it('detects FIELD_REMOVED (breaking) when a required field is missing', () => {
    const sample = {
      name: 'Ada Lovelace', // missing required id
      bio: 'Mathematician',
    };
    const drifts = compareObservation('GET /users/:id', baseBaseline, sample);
    const removed = drifts.find((d) => d.kind === 'FIELD_REMOVED');
    expect(removed).toBeDefined();
    expect(removed?.path).toBe('$.id');
    expect(removed?.severity).toBe('breaking');
  });

  it('does NOT report FIELD_REMOVED for optional fields that are omitted', () => {
    const sample = {
      id: 1,
      name: 'Ada Lovelace',
      // $.avatar omitted
      bio: 'Mathematician',
    };
    const drifts = compareObservation('GET /users/:id', baseBaseline, sample);
    expect(drifts).toHaveLength(0);
  });

  it('detects TYPE_CHANGED (breaking) when field has incompatible type', () => {
    const sample = {
      id: 'string-instead-of-number',
      name: 'Ada Lovelace',
      bio: 'Mathematician',
    };
    const drifts = compareObservation('GET /users/:id', baseBaseline, sample);
    const typeDrift = drifts.find((d) => d.kind === 'TYPE_CHANGED');
    expect(typeDrift).toBeDefined();
    expect(typeDrift?.path).toBe('$.id');
    expect(typeDrift?.expected).toBe('number');
    expect(typeDrift?.actual).toBe('string');
    expect(typeDrift?.severity).toBe('breaking');
  });

  it('detects UNEXPECTED_NULL (warning) when non-nullable field receives null', () => {
    const sample = {
      id: 1,
      name: null, // baseline $.name never allowed null
      bio: 'Mathematician',
    };
    const drifts = compareObservation('GET /users/:id', baseBaseline, sample);
    const nullDrift = drifts.find((d) => d.kind === 'UNEXPECTED_NULL');
    expect(nullDrift).toBeDefined();
    expect(nullDrift?.path).toBe('$.name');
    expect(nullDrift?.severity).toBe('warning');
  });

  it('allows null when baseline allowsNull is true', () => {
    const sample = {
      id: 1,
      name: 'Ada Lovelace',
      bio: null, // baseline allowed null
    };
    const drifts = compareObservation('GET /users/:id', baseBaseline, sample);
    expect(drifts).toHaveLength(0);
  });

  it('detects FIELD_ADDED (info) and suppresses child additions', () => {
    const sample = {
      id: 1,
      name: 'Ada Lovelace',
      bio: 'Mathematician',
      newProfile: {
        twitter: '@ada',
        github: 'ada',
      },
    };
    const drifts = compareObservation('GET /users/:id', baseBaseline, sample);
    const addedDrifts = drifts.filter((d) => d.kind === 'FIELD_ADDED');
    // Only top level $.newProfile is reported, not its children
    expect(addedDrifts).toHaveLength(1);
    expect(addedDrifts[0]?.path).toBe('$.newProfile');
    expect(addedDrifts[0]?.severity).toBe('info');
  });
});
