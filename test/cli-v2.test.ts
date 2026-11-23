import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runCli, handleUiServer } from '../src/cli.js';

describe('CLI v2 Commands: generate-types & ui', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shapewatch-cliv2-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs generate-types command with baseline file', () => {
    const baselinePath = path.join(tmpDir, 'baselines.json');
    const dummyData = {
      'GET /api/v1/posts': {
        endpoint: 'GET /api/v1/posts',
        samples: 5,
        frozen: true,
        createdAt: '',
        updatedAt: '',
        fields: {
          '$': { path: '$', required: true, allowedTypes: ['object'], allowsNull: false },
          '$.title': { path: '$.title', required: true, allowedTypes: ['string'], allowsNull: false },
          '$.likes': { path: '$.likes', required: false, allowedTypes: ['number'], allowsNull: false },
        },
      },
    };
    fs.writeFileSync(baselinePath, JSON.stringify(dummyData), 'utf-8');

    // Generate TypeScript
    const code = runCli(['generate-types', '--baseline', baselinePath, '--name', 'PostDTO']);
    expect(code).toBe(0);

    // Generate JSON Schema
    const codeJson = runCli(['generate-types', '--baseline', baselinePath, '--format', 'json']);
    expect(codeJson).toBe(0);
  });

  it('starts and closes local UI dashboard server', async () => {
    const serverInstance = handleUiServer(['--port', '4055', '--dir', tmpDir], true) as { close: () => void };
    expect(serverInstance).toBeDefined();

    // Fetch dashboard HTML
    const res = await fetch('http://localhost:4055');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Shapewatch Dashboard');

    // Fetch API data endpoint
    const dataRes = await fetch('http://localhost:4055/api/data');
    expect(dataRes.status).toBe(200);
    const json = await dataRes.json();
    expect(json.baselines).toBeDefined();

    serverInstance.close();
  });
});
