import { describe, it, expect } from 'vitest';
import { Reporter } from '../src/reporter.js';
import type { Drift } from '../src/types.js';

describe('Reporter', () => {
  it('deduplicates drifts by (endpoint, kind, path) and tracks counts', () => {
    const reporter = new Reporter();
    const drift1: Drift = {
      endpoint: 'GET /users/:id',
      kind: 'FIELD_REMOVED',
      severity: 'breaking',
      path: '$.id',
      count: 1,
      firstSeen: '',
      lastSeen: '',
    };

    const firstBatch = reporter.recordDrifts([drift1]);
    expect(firstBatch[0]?.count).toBe(1);

    const secondBatch = reporter.recordDrifts([drift1]);
    expect(secondBatch[0]?.count).toBe(2);

    const report = reporter.getReport();
    expect(report.summary.total).toBe(1);
    expect(report.summary.breaking).toBe(1);
    expect(report.drifts[0]?.count).toBe(2);
  });

  it('correctly tallies severity categories and resets', () => {
    const reporter = new Reporter();
    reporter.recordDrifts([
      {
        endpoint: 'GET /a',
        kind: 'FIELD_REMOVED',
        severity: 'breaking',
        path: '$.x',
        count: 1,
        firstSeen: '',
        lastSeen: '',
      },
      {
        endpoint: 'GET /a',
        kind: 'UNEXPECTED_NULL',
        severity: 'warning',
        path: '$.y',
        count: 1,
        firstSeen: '',
        lastSeen: '',
      },
      {
        endpoint: 'GET /a',
        kind: 'FIELD_ADDED',
        severity: 'info',
        path: '$.z',
        count: 1,
        firstSeen: '',
        lastSeen: '',
      },
    ]);

    const report = reporter.getReport();
    expect(report.summary.total).toBe(3);
    expect(report.summary.breaking).toBe(1);
    expect(report.summary.warning).toBe(1);
    expect(report.summary.info).toBe(1);

    reporter.reset();
    expect(reporter.getReport().summary.total).toBe(0);
  });
});
