import { describe, it, expect } from 'vitest';
import { BaselineManager } from '../src/baseline.js';

describe('BaselineManager', () => {
  it('learns over 20 samples and freezes', () => {
    const mgr = new BaselineManager({ learnSamples: 20 });
    const endpoint = 'GET /api/test';

    for (let i = 0; i < 19; i++) {
      const b = mgr.recordSample(endpoint, { id: i, name: 'Alice' });
      expect(b.frozen).toBe(false);
      expect(b.samples).toBe(i + 1);
    }

    const finalBaseline = mgr.recordSample(endpoint, { id: 19, name: 'Alice' });
    expect(finalBaseline.frozen).toBe(true);
    expect(finalBaseline.samples).toBe(20);
    expect(finalBaseline.fields['$.id']?.required).toBe(true);
    expect(finalBaseline.fields['$.name']?.required).toBe(true);
  });

  it('determines required vs optional fields based on requiredThreshold', () => {
    const mgr = new BaselineManager({ learnSamples: 20, requiredThreshold: 0.95 });
    const endpoint = 'GET /api/items';

    // 19 times with optionalField, 1 time without
    for (let i = 0; i < 19; i++) {
      mgr.recordSample(endpoint, { req: 1, opt: 'maybe' });
    }
    // 20th sample misses opt: 19/20 = 0.95 => exactly at threshold
    const b1 = mgr.recordSample(endpoint, { req: 1 });
    expect(b1.fields['$.req']?.required).toBe(true);
    expect(b1.fields['$.opt']?.required).toBe(true);

    // Now test below 0.95 (18/20 = 0.90)
    const mgr2 = new BaselineManager({ learnSamples: 20, requiredThreshold: 0.95 });
    for (let i = 0; i < 18; i++) {
      mgr2.recordSample('GET /api/other', { req: 1, opt: 'maybe' });
    }
    mgr2.recordSample('GET /api/other', { req: 1 });
    const b2 = mgr2.recordSample('GET /api/other', { req: 1 });
    expect(b2.fields['$.opt']?.presentRatio).toBe(0.9);
    expect(b2.fields['$.opt']?.required).toBe(false);
  });

  it('tracks allowsNull and allowedTypes union', () => {
    const mgr = new BaselineManager({ learnSamples: 5 });
    const endpoint = 'GET /api/types';

    mgr.recordSample(endpoint, { val: 'text', optNull: null });
    mgr.recordSample(endpoint, { val: 123, optNull: 'present' });
    mgr.recordSample(endpoint, { val: 'another', optNull: null });
    mgr.recordSample(endpoint, { val: 456, optNull: 'present' });
    const b = mgr.recordSample(endpoint, { val: 'end', optNull: 'present' });

    expect(b.fields['$.val']?.allowedTypes).toContain('string');
    expect(b.fields['$.val']?.allowedTypes).toContain('number');
    expect(b.fields['$.optNull']?.allowsNull).toBe(true);
  });

  it('isolates different endpoints and supports export/import/reset', () => {
    const mgr = new BaselineManager({ learnSamples: 2 });
    mgr.recordSample('GET /one', { a: 1 });
    mgr.recordSample('GET /two', { b: 2 });

    expect(mgr.getBaseline('GET /one')).toBeDefined();
    expect(mgr.getBaseline('GET /two')).toBeDefined();

    const exported = mgr.exportAll();
    expect(exported['GET /one']).toBeDefined();
    expect(exported['GET /two']).toBeDefined();

    const newMgr = new BaselineManager();
    newMgr.importAll(exported);
    expect(newMgr.getBaseline('GET /one')).toBeDefined();

    mgr.reset('GET /one');
    expect(mgr.getBaseline('GET /one')).toBeUndefined();
    expect(mgr.getBaseline('GET /two')).toBeDefined();

    mgr.reset();
    expect(mgr.getBaseline('GET /two')).toBeUndefined();
  });
});
