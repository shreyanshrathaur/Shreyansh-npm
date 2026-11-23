import { describe, it, expect, vi } from 'vitest';
import { createShapewatch } from '../src/index.js';
import { ShapewatchDriftError } from '../src/errors.js';

describe('createShapewatch integration & modes', () => {
  it('learns 20 samples, freezes baseline, and detects drift in watch mode', () => {
    const onDrift = vi.fn();
    const sw = createShapewatch({
      learnSamples: 20,
      mode: 'watch',
      onDrift,
    });

    // 20 learning samples
    for (let i = 0; i < 20; i++) {
      const drifts = sw.observe('GET /users/:id', { id: i, name: 'Ada' });
      expect(drifts).toHaveLength(0);
    }

    // 21st sample has removed name (breaking)
    const driftResult = sw.observe('GET /users/:id', { id: 21 });
    expect(driftResult).toHaveLength(1);
    expect(driftResult[0]?.kind).toBe('FIELD_REMOVED');
    expect(driftResult[0]?.path).toBe('$.name');
    expect(onDrift).toHaveBeenCalledTimes(1);

    const report = sw.report();
    expect(report.summary.breaking).toBe(1);
  });

  it('throws ShapewatchDriftError in strict mode upon drift', () => {
    const sw = createShapewatch({
      learnSamples: 2,
      mode: 'strict',
    });

    sw.observe('GET /items/:id', { id: 1, price: 99 });
    sw.observe('GET /items/:id', { id: 2, price: 100 });

    expect(() => {
      // Changed type from number to string
      sw.observe('GET /items/:id', { id: 3, price: 'one-hundred' });
    }).toThrow(ShapewatchDriftError);
  });

  it('does nothing in off mode', () => {
    const sw = createShapewatch({
      learnSamples: 2,
      mode: 'off',
    });

    const res = sw.observe('GET /test', { key: 'val' });
    expect(res).toHaveLength(0);
    expect(sw.exportBaseline()).toEqual({});
  });

  it('supports setMode and reset', () => {
    const sw = createShapewatch({
      learnSamples: 2,
      mode: 'learn',
    });

    sw.observe('GET /test', { a: 1 });
    sw.setMode('watch');
    sw.observe('GET /test', { a: 2 });

    const baseline = sw.exportBaseline('GET /test');
    expect(baseline['GET /test']?.frozen).toBe(true);

    sw.reset('GET /test');
    expect(sw.exportBaseline('GET /test')).toEqual({});
  });

  it('never leaks secret values in reports or drift objects', () => {
    const canarySecret = 'CANARY_SECRET_DO_NOT_LEAK_12345';
    const sw = createShapewatch({
      learnSamples: 1,
      mode: 'watch',
    });

    sw.observe('GET /auth', { user: 'admin', secretToken: canarySecret });
    const drifts = sw.observe('GET /auth', { user: 'admin' }); // secretToken missing

    const report = sw.report();
    const serializedReport = JSON.stringify(report);
    const serializedDrifts = JSON.stringify(drifts);

    expect(serializedReport.includes(canarySecret)).toBe(false);
    expect(serializedDrifts.includes(canarySecret)).toBe(false);
  });
});
