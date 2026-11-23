import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runCli } from '../src/cli.js';

describe('CLI Unit & In-Process Tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shapewatch-cli-unit-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs --help and --version', () => {
    expect(runCli(['--help'])).toBe(0);
    expect(runCli(['-v'])).toBe(0);
    expect(runCli(['unknown-cmd'])).toBe(2);
  });

  it('runs init command and creates config file', () => {
    const configPath = path.join(tmpDir, 'shapewatch.json');
    const code = runCli(['init', '--config', configPath]);
    expect(code).toBe(0);
    expect(fs.existsSync(configPath)).toBe(true);

    // Running again without --force returns 2
    expect(runCli(['init', '--config', configPath])).toBe(2);
    // Running again with --force returns 0
    expect(runCli(['init', '--config', configPath, '--force'])).toBe(0);
  });

  it('runs report command on valid and invalid files', () => {
    const missingPath = path.join(tmpDir, 'nonexistent.json');
    expect(runCli(['report', '--input', missingPath])).toBe(2);

    const corruptPath = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(corruptPath, '{invalid-json', 'utf-8');
    expect(runCli(['report', '--input', corruptPath])).toBe(2);

    const validReportPath = path.join(tmpDir, 'report.json');
    fs.writeFileSync(
      validReportPath,
      JSON.stringify({
        drifts: [],
        generatedAt: new Date().toISOString(),
        summary: { total: 0, breaking: 0, warning: 0, info: 0 },
      }),
      'utf-8'
    );
    expect(runCli(['report', '--input', validReportPath])).toBe(0);
    expect(runCli(['report', '--input', validReportPath, '--json'])).toBe(0);
  });

  it('runs diff command with passing and failing conditions', () => {
    expect(runCli(['diff'])).toBe(2);

    const baselinePath = path.join(tmpDir, 'baseline.json');
    const sampleOkPath = path.join(tmpDir, 'sample-ok.json');
    const sampleDriftPath = path.join(tmpDir, 'sample-drift.json');

    const baselineData = {
      'GET /users/:id': {
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
        },
      },
    };

    fs.writeFileSync(baselinePath, JSON.stringify(baselineData), 'utf-8');
    fs.writeFileSync(sampleOkPath, JSON.stringify({ id: 123 }), 'utf-8');
    fs.writeFileSync(sampleDriftPath, JSON.stringify({ id: 'wrong-type' }), 'utf-8');

    expect(
      runCli([
        'diff',
        '--baseline',
        baselinePath,
        '--sample',
        sampleOkPath,
        '--endpoint',
        'GET /users/:id',
      ])
    ).toBe(0);

    expect(
      runCli([
        'diff',
        '--baseline',
        baselinePath,
        '--sample',
        sampleDriftPath,
        '--endpoint',
        'GET /users/:id',
        '--json',
      ])
    ).toBe(1);
  });
});
