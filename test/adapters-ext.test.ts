import { describe, it, expect, vi } from 'vitest';
import { createShapewatch } from '../src/index.js';
import { ShapewatchDriftError } from '../src/errors.js';

describe('HTTP Adapters Extended', () => {
  it('wrapFetch handles Request object and customNormalize', async () => {
    const sw = createShapewatch({
      learnSamples: 1,
      normalizeEndpoint: (url, method) => `${method || 'GET'} /custom-route`,
    });
    const observeSpy = vi.spyOn(sw, 'observe');

    const fakeResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const mockFetch = vi.fn().mockResolvedValue(fakeResponse);
    const wrapped = sw.wrapFetch(mockFetch);

    const req = new Request('https://api.example.com/items/999', { method: 'POST' });
    const res = await wrapped(req);
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 10));
    expect(observeSpy).toHaveBeenCalledWith('POST /custom-route', { ok: true });
  });

  it('wrapFetch handles URL input', async () => {
    const sw = createShapewatch({ learnSamples: 1 });
    const observeSpy = vi.spyOn(sw, 'observe');

    const fakeResponse = new Response(JSON.stringify({ foo: 'bar' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const mockFetch = vi.fn().mockResolvedValue(fakeResponse);
    const wrapped = sw.wrapFetch(mockFetch);

    await wrapped(new URL('https://api.example.com/feed'));
    await new Promise((r) => setTimeout(r, 10));
    expect(observeSpy).toHaveBeenCalled();
  });

  it('axiosInterceptor respects baseURL and throws in strict mode', () => {
    const sw = createShapewatch({
      learnSamples: 1,
      mode: 'strict',
    });

    // Learn baseline
    sw.observe('GET /users/:id', { id: 1, role: 'admin' });

    const interceptor = sw.axiosInterceptor();

    const responseWithBaseURL = {
      status: 200,
      data: { id: 2, role: 'user' },
      config: {
        method: 'get',
        baseURL: 'https://api.example.com/v1',
        url: '/users/2',
      },
    };

    expect(() => interceptor(responseWithBaseURL)).not.toThrow();

    // Trigger breaking drift in strict mode
    const driftResponse = {
      status: 200,
      data: { id: 3 }, // missing role
      config: {
        method: 'get',
        url: 'https://api.example.com/v1/users/3',
      },
    };

    expect(() => interceptor(driftResponse)).toThrow(ShapewatchDriftError);
  });
});
