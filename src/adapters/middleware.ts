import type { Shapewatch } from '../types.js';
import { normalizeEndpoint } from '../normalize.js';

export function createExpressMiddleware(sw: Shapewatch) {
  return function shapewatchMiddleware(req: any, res: any, next: () => void): void {
    const originalJson = res.json;
    const originalSend = res.send;

    const method = (req.method || 'GET').toUpperCase();
    const route = req.route ? req.route.path : req.path || req.url || '/';
    const endpoint = normalizeEndpoint(route, method);

    res.json = function (body: unknown): any {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          sw.observe(endpoint, body);
        }
      } catch (err) {
        if (err && (err as any).name === 'ShapewatchDriftError') {
          return next();
        }
      }
      return originalJson.call(this, body);
    };

    res.send = function (body: unknown): any {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (typeof body === 'string') {
            try {
              const parsed = JSON.parse(body);
              sw.observe(endpoint, parsed);
            } catch {
              // Not JSON
            }
          } else if (typeof body === 'object' && body !== null) {
            sw.observe(endpoint, body);
          }
        }
      } catch {
        // Safe containment
      }
      return originalSend.call(this, body);
    };

    next();
  };
}

export function wrapQueryFn<TData>(
  sw: Shapewatch,
  endpoint: string,
  queryFn: () => Promise<TData>
): () => Promise<TData> {
  return async function wrappedQueryFn(): Promise<TData> {
    const result = await queryFn();
    try {
      sw.observe(endpoint, result);
    } catch (err) {
      if (err && (err as any).name === 'ShapewatchDriftError') {
        throw err;
      }
    }
    return result;
  };
}
