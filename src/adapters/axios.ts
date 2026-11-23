import type { Shapewatch } from '../types.js';
import { normalizeEndpoint } from '../normalize.js';

export function createAxiosInterceptor(
  sw: Shapewatch,
  customNormalize?: (url: string, method?: string) => string
) {
  return function axiosResponseInterceptor(response: any): any {
    try {
      if (
        response &&
        response.status >= 200 &&
        response.status < 300 &&
        response.data !== undefined
      ) {
        const config = response.config || {};
        const method = (config.method || 'GET').toUpperCase();
        let url = config.url || '';

        if (config.baseURL && !url.startsWith('http://') && !url.startsWith('https://')) {
          url = `${config.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
        }

        const endpointKey = customNormalize
          ? customNormalize(url, method)
          : normalizeEndpoint(url, method);

        sw.observe(endpointKey, response.data);
      }
    } catch (err) {
      if (err && (err as any).name === 'ShapewatchDriftError') {
        throw err;
      }
    }

    return response;
  };
}
