import type { Shapewatch } from '../types.js';

export function createFetchWrapper(sw: Shapewatch, customNormalize?: (url: string, method?: string) => string) {
  return function wrapFetch<F extends typeof fetch>(fetchImpl: F): F {
    const wrapped = async function (
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const response = await fetchImpl.apply(this, [input, init]);

      try {
        const status = response.status;
        if (status < 200 || status >= 300 || status === 204) {
          return response;
        }

        const contentType = response.headers.get('content-type') || '';
        const isJson =
          contentType.includes('application/json') ||
          contentType.includes('+json');

        if (!isJson) {
          return response;
        }

        let urlStr = '';
        let method = 'GET';

        if (typeof input === 'string') {
          urlStr = input;
        } else if (input instanceof URL) {
          urlStr = input.toString();
        } else if (typeof Request !== 'undefined' && input instanceof Request) {
          urlStr = input.url;
          method = input.method;
        }

        if (init && init.method) {
          method = init.method;
        }

        const endpointKey = customNormalize
          ? customNormalize(urlStr, method)
          : undefined;

        // Clone to inspect body without consuming caller's response
        const clone = response.clone();
        clone
          .json()
          .then((jsonData) => {
            sw.observe(endpointKey || `${method.toUpperCase()} ${urlStr}`, jsonData);
          })
          .catch(() => {
            // Silently ignore non-JSON or read errors in async observation
          });
      } catch {
        // Guarantee host app is not disrupted
      }

      return response;
    };

    return wrapped as unknown as F;
  };
}
