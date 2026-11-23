import { describe, it, expect, vi } from 'vitest';
import { createShapewatch } from '../src/index.js';

describe('HTTP Adapters', () => {
  it('wrapFetch observes 2xx JSON responses using clone() and leaves body readable', async () => {
    const sw = createShapewatch({ learnSamples: 1 });
    const observeSpy = vi.spyOn(sw, 'observe');

    const fakeResponseData = { id: 101, name: 'Alice' };
    const fakeResponse = new Response(JSON.stringify(fakeResponseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const mockFetch = vi.fn().mockResolvedValue(fakeResponse);
    const wrappedFetch = sw.wrapFetch(mockFetch);

    const res = await wrappedFetch('https://api.example.com/users/101');
    expect(res.status).toBe(200);

    // Ensure the caller can still read the original response body!
    const body = await res.json();
    expect(body).toEqual(fakeResponseData);

    // Yield event loop to allow clone().then to execute
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(observeSpy).toHaveBeenCalled();
  });

  it('wrapFetch ignores non-2xx and non-JSON responses', async () => {
    const sw = createShapewatch();
    const observeSpy = vi.spyOn(sw, 'observe');

    const nonJsonResponse = new Response('<html>Error</html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });

    const mockFetch = vi.fn().mockResolvedValue(nonJsonResponse);
    const wrapped = sw.wrapFetch(mockFetch);

    const res = await wrapped('/server-error');
    expect(res.status).toBe(500);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(observeSpy).not.toHaveBeenCalled();
  });

  it('axiosInterceptor passes through response and observes data', () => {
    const sw = createShapewatch({ learnSamples: 1 });
    const observeSpy = vi.spyOn(sw, 'observe');

    const interceptor = sw.axiosInterceptor();
    const mockAxiosResponse = {
      status: 200,
      data: { score: 98 },
      config: {
        method: 'post',
        url: '/games/level/5',
      },
    };

    const returned = interceptor(mockAxiosResponse);
    expect(returned).toBe(mockAxiosResponse);
    expect(observeSpy).toHaveBeenCalledWith('POST /games/level/:id', { score: 98 });
  });
});
