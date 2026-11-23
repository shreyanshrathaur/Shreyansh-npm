import type { EndpointBaseline, FieldStats } from './types.js';

export function generateTypeScriptTypes(
  baseline: EndpointBaseline,
  interfaceName: string = 'ApiResponse'
): string {
  const fields = baseline.fields;
  const lines: string[] = [];
  lines.push(`export interface ${interfaceName} {`);

  // Group top-level and direct fields under $
  const directProperties: { key: string; stat: FieldStats }[] = [];

  for (const [path, stat] of Object.entries(fields)) {
    if (path === '$') continue;

    // Check if direct property of root object: $.fieldName
    const match = path.match(/^\$\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (match && match[1]) {
      directProperties.push({ key: match[1], stat });
    }
  }

  directProperties.sort((a, b) => a.key.localeCompare(b.key));

  for (const { key, stat } of directProperties) {
    const isOptional = !stat.required;
    const types: string[] = [...stat.allowedTypes];
    if (stat.allowsNull && !types.includes('null')) {
      types.push('null');
    }
    const typeSignature = types.length > 0 ? types.join(' | ') : 'unknown';
    lines.push(`  ${key}${isOptional ? '?' : ''}: ${typeSignature};`);
  }

  lines.push('}');
  return lines.join('\n');
}

export function generateJsonSchema(baseline: EndpointBaseline): Record<string, unknown> {
  const fields = baseline.fields;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [path, stat] of Object.entries(fields)) {
    if (path === '$') continue;

    const match = path.match(/^\$\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (match && match[1]) {
      const propName = match[1];
      const types = [...stat.allowedTypes];
      if (stat.allowsNull && !types.includes('null')) {
        types.push('null');
      }

      properties[propName] = {
        type: types.length === 1 ? types[0] : types,
      };

      if (stat.format) {
        (properties[propName] as Record<string, unknown>).format = stat.format;
      }

      if (stat.required) {
        required.push(propName);
      }
    }
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: baseline.endpoint,
    type: 'object',
    properties,
    required: required.sort(),
  };
}
