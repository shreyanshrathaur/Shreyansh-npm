import type { Drift, EndpointBaseline } from './types.js';
import { walkValue, type WalkOptions } from './walk.js';

export interface CompareOptions extends WalkOptions {}

export function compareObservation(
  endpoint: string,
  baseline: EndpointBaseline,
  data: unknown,
  options: CompareOptions = {}
): Drift[] {
  const drifts: Drift[] = [];
  const now = new Date().toISOString();

  const observedFields = walkValue(data, options);
  const baselineFields = baseline.fields;

  // Track paths that triggered breaking changes to suppress child cascades
  const suppressedPrefixes = new Set<string>();

  // 1. Check for removed required fields
  // Sort paths so parents are checked before children
  const sortedBaselinePaths = Object.keys(baselineFields).sort();

  for (const path of sortedBaselinePaths) {
    const stat = baselineFields[path];
    if (!stat || !stat.required) continue;

    // Check if covered by suppressed parent
    let isSuppressed = false;
    for (const prefix of suppressedPrefixes) {
      if (path.startsWith(prefix + '.') || path.startsWith(prefix + '[') || path.startsWith(prefix + '[]')) {
        isSuppressed = true;
        break;
      }
    }
    if (isSuppressed) continue;

    if (!observedFields.has(path)) {
      drifts.push({
        endpoint,
        kind: 'FIELD_REMOVED',
        severity: 'breaking',
        path,
        expected: stat.allowedTypes.join(' | ') || (stat.allowsNull ? 'null' : 'defined'),
        actual: 'undefined',
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
      suppressedPrefixes.add(path);
    }
  }

  // 2. Check observed fields against baseline
  // Sort paths so root/parent added fields suppress child added fields
  const addedPrefixes = new Set<string>();
  const sortedObservedPaths = Array.from(observedFields.keys()).sort();

  for (const path of sortedObservedPaths) {
    const obs = observedFields.get(path)!;
    const stat = baselineFields[path];

    if (!stat) {
      // FIELD_ADDED
      let isChildOfAdded = false;
      for (const prefix of addedPrefixes) {
        if (path.startsWith(prefix + '.') || path.startsWith(prefix + '[') || path.startsWith(prefix + '[]')) {
          isChildOfAdded = true;
          break;
        }
      }

      if (!isChildOfAdded) {
        drifts.push({
          endpoint,
          kind: 'FIELD_ADDED',
          severity: 'info',
          path,
          expected: 'undefined',
          actual: obs.isNull ? 'null' : obs.type,
          count: 1,
          firstSeen: now,
          lastSeen: now,
        });
        addedPrefixes.add(path);
      }
      continue;
    }

    // Check UNEXPECTED_NULL
    if (obs.isNull) {
      if (!stat.allowsNull) {
        drifts.push({
          endpoint,
          kind: 'UNEXPECTED_NULL',
          severity: 'warning',
          path,
          expected: stat.allowedTypes.join(' | ') || 'non-null',
          actual: 'null',
          count: 1,
          firstSeen: now,
          lastSeen: now,
        });
      }
    } else {
      // Check TYPE_CHANGED
      if (stat.allowedTypes.length > 0 && !stat.allowedTypes.includes(obs.type)) {
        drifts.push({
          endpoint,
          kind: 'TYPE_CHANGED',
          severity: 'breaking',
          path,
          expected: stat.allowedTypes.join(' | '),
          actual: obs.type,
          count: 1,
          firstSeen: now,
          lastSeen: now,
        });
        suppressedPrefixes.add(path);
      }
    }
  }

  return drifts;
}
