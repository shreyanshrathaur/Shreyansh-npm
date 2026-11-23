const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID_REGEX = /^\d+$/;

export function normalizeEndpoint(urlOrPath: string, method: string = 'GET'): string {
  let cleanMethod = (method || 'GET').toUpperCase();
  let pathname = urlOrPath.trim();

  // Handle case where urlOrPath already starts with "METHOD /path"
  const methodMatch = pathname.match(/^([A-Z]+)\s+(.+)$/i);
  if (methodMatch && methodMatch[1] && methodMatch[2]) {
    cleanMethod = methodMatch[1].toUpperCase();
    pathname = methodMatch[2];
  }

  try {
    if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
      const parsed = new URL(pathname);
      pathname = parsed.pathname;
    } else {
      const questionIdx = pathname.indexOf('?');
      if (questionIdx !== -1) {
        pathname = pathname.substring(0, questionIdx);
      }
      const hashIdx = pathname.indexOf('#');
      if (hashIdx !== -1) {
        pathname = pathname.substring(0, hashIdx);
      }
    }
  } catch {
    // Keep pathname as-is
  }

  const segments = pathname.split('/').map((seg) => {
    if (!seg) return seg;
    if (UUID_REGEX.test(seg) || NUMERIC_ID_REGEX.test(seg)) {
      return ':id';
    }
    return seg;
  });

  const normalizedPath = segments.join('/') || '/';
  return `${cleanMethod} ${normalizedPath}`;
}
