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
  });
});
