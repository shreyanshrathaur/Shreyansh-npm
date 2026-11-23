import { describe, it, expect, vi } from 'vitest';
import { createExpressMiddleware, wrapQueryFn } from '../src/adapters/middleware.js';
import { createShapewatch } from '../src/index.js';

describe('Framework & Client Adapters', () => {
  it('createExpressMiddleware intercepts res.json and res.send', () => {
    const sw = createShapewatch({ learnSamples: 1 });
    const observeSpy = vi.spyOn(sw, 'observe');
    const middleware = createExpressMiddleware(sw);

    const req = { method: 'GET', url: '/api/users/42' };
    let jsonSent: any;
    let sendSent: any;

    const res = {
      statusCode: 200,
      json: vi.fn((data) => {
        jsonSent = data;
        return res;
      }),
      send: vi.fn((data) => {
        sendSent = data;
        return res;
      }),
    };

    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Call res.json
    res.json({ id: 42, role: 'member' });
    expect(jsonSent).toEqual({ id: 42, role: 'member' });
    expect(observeSpy).toHaveBeenCalledWith('GET /api/users/:id', { id: 42, role: 'member' });

    // Call res.send with stringified JSON
    res.send(JSON.stringify({ id: 43, role: 'admin' }));
    expect(sendSent).toBeDefined();
  });

  it('wrapQueryFn wraps TanStack Query functions and captures drift', async () => {
    const sw = createShapewatch({ learnSamples: 1 });
    const observeSpy = vi.spyOn(sw, 'observe');

    const mockApiCall = vi.fn().mockResolvedValue({ products: ['item-1', 'item-2'] });
    const wrapped = wrapQueryFn(sw, 'GET /products', mockApiCall);

    const data = await wrapped();
    expect(data).toEqual({ products: ['item-1', 'item-2'] });
    expect(observeSpy).toHaveBeenCalledWith('GET /products', { products: ['item-1', 'item-2'] });
  });
});
