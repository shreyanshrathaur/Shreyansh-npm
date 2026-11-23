import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createExpressMiddleware, wrapQueryFn } from '../src/adapters/middleware.js';
import { sendWebhookNotification } from '../src/alerts/webhook.js';
import { generateTypeScriptTypes, generateJsonSchema } from '../src/generators.js';
import { createShapewatch } from '../src/index.js';
import { runCli } from '../src/cli.js';

describe('V2 Branch Coverage Tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shapewatch-v2-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('covers express middleware edge cases (status >= 300, non-json send, object send)', () => {
    const sw = createShapewatch();
    const mw = createExpressMiddleware(sw);

    const req = { method: 'POST', url: '/api/test' };

    // Status 404 (ignored)
    const res404 = {
      statusCode: 404,
      json: vi.fn(),
      send: vi.fn(),
    };
    mw(req, res404, () => {});
    res404.json({ error: 'not found' });
    res404.send('plain text');

    // Status 200 with object send
    const res200 = {
      statusCode: 200,
      json: vi.fn(),
      send: vi.fn(),
    };
    mw(req, res200, () => {});
    res200.send({ status: 'ok' });
    res200.send('not valid json {{{{');

    // Strict mode error catch
    const strictSw = createShapewatch({ learnSamples: 1, mode: 'strict' });
    strictSw.observe('GET /strict-mw', { count: 1 });
    const strictMw = createExpressMiddleware(strictSw);
    const strictRes = {
      statusCode: 200,
      json: vi.fn(),
      send: vi.fn(),
    };
    const nextFn = vi.fn();
    strictMw({ method: 'GET', url: '/strict-mw' }, strictRes, nextFn);
    strictRes.json({ count: 'one' });
    expect(nextFn).toHaveBeenCalled();
  });

  it('covers wrapQueryFn strict error throw', async () => {
    const sw = createShapewatch({ learnSamples: 1, mode: 'strict' });
    sw.observe('GET /q', { a: 1 });

    const wrapped = wrapQueryFn(sw, 'GET /q', async () => ({ a: 'string' }));
    await expect(wrapped()).rejects.toThrow();
  });

  it('covers webhook with empty url or fetch failure and warning color', async () => {
    await expect(sendWebhookNotification('', {} as any)).resolves.toBeUndefined();

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));

    // Warning drift color branch
    await sendWebhookNotification('https://example.com/hook', {
      endpoint: 'GET /test',
      kind: 'UNEXPECTED_NULL',
      severity: 'warning',
      path: '$.x',
      count: 1,
      firstSeen: '',
      lastSeen: '',
    });

    // Info drift color branch
    await sendWebhookNotification('https://example.com/hook', {
      endpoint: 'GET /test',
      kind: 'FIELD_ADDED',
      severity: 'info',
      path: '$.x',
      count: 1,
      firstSeen: '',
      lastSeen: '',
    });

    // Fetch throws
    (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    await expect(sendWebhookNotification('https://example.com/hook', {
      endpoint: 'GET /test',
      kind: 'FIELD_ADDED',
      severity: 'info',
      path: '$.x',
      count: 1,
      firstSeen: '',
      lastSeen: '',
    })).resolves.toBeUndefined();

    globalThis.fetch = originalFetch;
  });

  it('covers generators edge cases', () => {
    const emptyStatBaseline = {
      endpoint: 'GET /empty',
      samples: 1,
      frozen: true,
      createdAt: '',
      updatedAt: '',
      fields: {
        '$': { path: '$', required: true, allowedTypes: ['object'], allowsNull: false } as any,
        '$.untyped': { path: '$.untyped', required: true, allowedTypes: [], allowsNull: true } as any,
      },
    };

    const ts = generateTypeScriptTypes(emptyStatBaseline as any);
    expect(ts).toContain('untyped: null;');

    const schema = generateJsonSchema(emptyStatBaseline as any);
    expect(schema.type).toBe('object');
  });

  it('covers index.ts generateTypeScript and generateJsonSchema errors', () => {
    const sw = createShapewatch();
    expect(() => sw.generateTypeScript('GET /missing')).toThrow();
    expect(() => sw.generateJsonSchema('GET /missing')).toThrow();
  });

  it('covers cli generate-types missing baseline or invalid json or empty file', () => {
    expect(runCli(['generate-types', '--baseline', '/nonexistent-baseline-file.json'])).toBe(2);

    const corruptFile = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(corruptFile, '{corrupt', 'utf-8');
    expect(runCli(['generate-types', '--baseline', corruptFile])).toBe(2);

    const emptyFile = path.join(tmpDir, 'empty.json');
    fs.writeFileSync(emptyFile, '{}', 'utf-8');
    expect(runCli(['generate-types', '--baseline', emptyFile])).toBe(2);
  });
});
