import { describe, it, expect } from 'vitest';
import { normalizeEndpoint } from '../src/normalize.js';

describe('normalizeEndpoint', () => {
  it('normalizes full URLs and relative paths', () => {
    expect(normalizeEndpoint('https://api.example.com/users/123')).toBe('GET /users/:id');
    expect(normalizeEndpoint('/users/123')).toBe('GET /users/:id');
    expect(normalizeEndpoint('/items/456', 'POST')).toBe('POST /items/:id');
  });

  it('normalizes UUIDs to :id', () => {
    expect(normalizeEndpoint('/orders/123e4567-e89b-12d3-a456-426614174000')).toBe('GET /orders/:id');
  });

  it('strips query strings and hash anchors', () => {
    expect(normalizeEndpoint('/users/123?filter=active&sort=desc#profile')).toBe('GET /users/:id');
    expect(normalizeEndpoint('https://api.example.com/items?query=search')).toBe('GET /items');
  });

  it('preserves non-ID path segments', () => {
    expect(normalizeEndpoint('/api/v1/auth/login', 'POST')).toBe('POST /api/v1/auth/login');
  });
});
