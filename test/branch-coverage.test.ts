import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runCli } from '../src/cli.js';
import { createShapewatch, MemoryStorage, FileStorage } from '../src/index.js';

describe('Branch Coverage Optimization Tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shapewatch-branch-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('covers cli report with non-empty drifts table and corrupt file branches', () => {
    const reportPath = path.join(tmpDir, 'drifts-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify({
        drifts: [
          {
            endpoint: 'GET /items',
            kind: 'FIELD_REMOVED',
            severity: 'breaking',
            path: '$.price',
            expected: 'number',
            actual: 'undefined',
            count: 2,
            firstSeen: '',
            lastSeen: '',
          },
        ],
        generatedAt: new Date().toISOString(),
        summary: { total: 1, breaking: 1, warning: 0, info: 0 },
      }),
      'utf-8'
    );

    // Tests table output branch
    expect(runCli(['report', '--input', reportPath])).toBe(1);

    // Tests missing baseline or sample in diff
    const missingBase = path.join(tmpDir, 'missing-base.json');
    const existingFile = path.join(tmpDir, 'exists.json');
    fs.writeFileSync(existingFile, '{}', 'utf-8');

    expect(runCli(['diff', '--baseline', missingBase, '--sample', existingFile])).toBe(2);
    expect(runCli(['diff', '--baseline', existingFile, '--sample', missingBase])).toBe(2);

    // Tests corrupt JSON in diff
    const corruptFile = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(corruptFile, '{corrupt', 'utf-8');
    expect(runCli(['diff', '--baseline', corruptFile, '--sample', existingFile])).toBe(2);
  });

  it('covers storage integration in index.ts and sampleRate', () => {
    const memStorage = new MemoryStorage();
    const sw = createShapewatch({
      learnSamples: 1,
      storage: memStorage,
      onDrift: () => {
        throw new Error('Callback failed');
      },
    });

    // Learn and save to storage
    sw.observe('GET /store-test', { a: 1 });
    expect(memStorage.loadBaseline('GET /store-test')).toBeDefined();

    // Trigger drift which also calls failing onDrift (caught safely)
    const drifts = sw.observe('GET /store-test', { a: 'wrong' });
    expect(drifts).toHaveLength(1);
    expect(memStorage.loadReport()).toBeDefined();

    // Sample rate 0
    const swZero = createShapewatch({ sampleRate: 0 });
    expect(swZero.observe('GET /zero', { x: 1 })).toEqual([]);

    // FileStorage corrupt read returns null
    const fStorage = new FileStorage({ baseDir: tmpDir });
    const corruptFile = path.join(tmpDir, 'baselines.json');
    fs.writeFileSync(corruptFile, '{invalid', 'utf-8');
    expect(fStorage.loadBaseline('GET /any')).toBeNull();

    // Call save again to exercise ensureDir when dir exists
    fStorage.saveBaseline('GET /second', {
      endpoint: 'GET /second',
      samples: 1,
      fields: {},
      frozen: true,
      createdAt: '',
      updatedAt: '',
    });
    expect(fStorage.loadBaseline('GET /second')).toBeDefined();
  });

  it('covers hash anchor and suppressed child paths in compare', async () => {
    // Hash in relative URL
    const { normalizeEndpoint } = await import('../src/normalize.js');
    expect(normalizeEndpoint('/items/10#section')).toBe('GET /items/:id');

    // Child suppression when parent required field is missing
    const { compareObservation } = await import('../src/compare.js');
    const baseline = {
      endpoint: 'GET /nested',
      samples: 1,
      frozen: true,
      createdAt: '',
      updatedAt: '',
      fields: {
        '$': {
          path: '$',
          seen: 1,
          eligible: 1,
          presentRatio: 1,
          typeCounts: { object: 1 },
          nullCount: 0,
          allowedTypes: ['object'],
          allowsNull: false,
          required: true,
        },
        '$.parent': {
          path: '$.parent',
          seen: 1,
          eligible: 1,
          presentRatio: 1,
          typeCounts: { object: 1 },
          nullCount: 0,
          allowedTypes: ['object'],
          allowsNull: false,
          required: true,
        },
        '$.parent.child': {
          path: '$.parent.child',
          seen: 1,
          eligible: 1,
          presentRatio: 1,
          typeCounts: { string: 1 },
          nullCount: 0,
          allowedTypes: ['string'],
          allowsNull: false,
          required: true,
        },
      },
    };

    // Missing $.parent should report $.parent removed and suppress $.parent.child
    const drifts = compareObservation('GET /nested', baseline as any, {});
    expect(drifts).toHaveLength(1);
    expect(drifts[0]?.path).toBe('$.parent');
  });
});
