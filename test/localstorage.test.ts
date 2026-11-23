import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalStorageAdapter } from '../src/storage/localstorage.js';
import type { EndpointBaseline, Report } from '../src/types.js';

describe('LocalStorageAdapter with mocked window', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key in store) delete store[key];
    (globalThis as any).window = {
      localStorage: {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          store[key] = val;
        }),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('saves and loads baseline and report via window.localStorage', () => {
    const adapter = new LocalStorageAdapter({ prefix: 'test:' });
    const baseline: EndpointBaseline = {
      endpoint: 'GET /items',
      samples: 5,
      fields: {},
      frozen: true,
      createdAt: '',
      updatedAt: '',
    };
    adapter.saveBaseline('GET /items', baseline);
    expect(adapter.loadBaseline('GET /items')).toEqual(baseline);

    const report: Report = {
      drifts: [],
      generatedAt: '',
      summary: { total: 0, breaking: 0, warning: 0, info: 0 },
    };
    adapter.saveReport(report);
    expect(adapter.loadReport()).toEqual(report);
  });

  it('handles JSON parse error and quota exception safely', () => {
    const adapter = new LocalStorageAdapter({ prefix: 'test:' });
    (globalThis as any).window.localStorage.getItem = vi.fn(() => 'INVALID_JSON{{{');
    expect(adapter.loadBaseline('GET /items')).toBeNull();
    expect(adapter.loadReport()).toBeNull();

    (globalThis as any).window.localStorage.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    // Does not throw
    expect(() => adapter.saveBaseline('GET /items', {} as any)).not.toThrow();
    expect(() => adapter.saveReport({} as any)).not.toThrow();
  });
});
