export interface ObservedField {
  path: string;
  type: string;
  isNull: boolean;
}

export interface WalkOptions {
  maxDepth?: number;
  maxArrayItems?: number;
  ignorePaths?: string[];
}

export function escapePathKey(key: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    return key;
  }
  return `["${key.replace(/["\\]/g, '\\$&')}"]`;
}

export function buildObjectPath(parentPath: string, key: string): string {
  if (parentPath === '$') {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return `$.${key}`;
    }
    return `$["${key.replace(/["\\]/g, '\\$&')}"]`;
  }
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    return `${parentPath}.${key}`;
  }
  return `${parentPath}["${key.replace(/["\\]/g, '\\$&')}"]`;
}

export function buildArrayElementPath(parentPath: string): string {
  return `${parentPath}[]`;
}

export function isPathIgnored(path: string, ignorePatterns?: string[]): boolean {
  if (!ignorePatterns || ignorePatterns.length === 0) return false;
  for (const pattern of ignorePatterns) {
    if (path === pattern) return true;
    if (path.startsWith(pattern + '.') || path.startsWith(pattern + '[') || path.startsWith(pattern + '[]')) {
      return true;
    }
  }
  return false;
}

export function getTypeString(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  const t = typeof val;
  if (t === 'string') return 'string';
  if (t === 'number') {
    return Number.isFinite(val) ? 'number' : 'number';
  }
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return 'object';
  return t;
}

export function walkValue(
  value: unknown,
  options: WalkOptions = {}
): Map<string, ObservedField> {
  const maxDepth = options.maxDepth ?? 10;
  const maxArrayItems = options.maxArrayItems ?? 20;
  const ignorePatterns = options.ignorePaths;

  const results = new Map<string, ObservedField>();
  const visitedObjects = new WeakSet<object>();

  function traverse(current: unknown, path: string, depth: number): void {
    if (isPathIgnored(path, ignorePatterns)) {
      return;
    }

    const typeStr = getTypeString(current);
    const isNull = current === null;

    if (!results.has(path)) {
      results.set(path, { path, type: typeStr, isNull });
    }

    if (isNull || depth >= maxDepth) {
      return;
    }

    if (Array.isArray(current)) {
      const elemPath = buildArrayElementPath(path);
      if (isPathIgnored(elemPath, ignorePatterns)) {
        return;
      }

      const limit = Math.min(current.length, maxArrayItems);
      for (let i = 0; i < limit; i++) {
        traverse(current[i], elemPath, depth + 1);
      }
      return;
    }

    if (typeof current === 'object' && current !== null) {
      if (visitedObjects.has(current)) {
        // Cycle detected, prevent infinite loop
        return;
      }
      visitedObjects.add(current);

      const keys = Object.keys(current);
      for (const key of keys) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        let childVal: unknown;
        try {
          childVal = (current as Record<string, unknown>)[key];
        } catch {
          continue;
        }

        const childPath = buildObjectPath(path, key);
        traverse(childVal, childPath, depth + 1);
      }
    }
  }

  traverse(value, '$', 0);
  return results;
}
