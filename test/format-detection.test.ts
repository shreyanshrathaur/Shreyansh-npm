import { describe, it, expect } from 'vitest';
import { detectStringFormat } from '../src/walk.js';
import { createShapewatch } from '../src/index.js';

describe('Format Recognition & Min Drift Confirmations', () => {
  it('identifies uuid, date-time, email, and uri formats', () => {
    expect(detectStringFormat('123e4567-e89b-12d3-a456-426614174000')).toBe('uuid');
    expect(detectStringFormat('2026-11-23T20:30:00.000Z')).toBe('date-time');
    expect(detectStringFormat('test@example.com')).toBe('email');
    expect(detectStringFormat('https://example.com/api')).toBe('uri');
    expect(detectStringFormat('plain text')).toBeUndefined();
  });

  it('detects FORMAT_CHANGED drift when string format alters', () => {
    const sw = createShapewatch({ learnSamples: 1 });
    // Learn baseline with ISO date
    sw.observe('GET /event', { timestamp: '2026-11-23T12:00:00.000Z' });

    // 2nd sample has plain string instead of ISO date
    const drifts = sw.observe('GET /event', { timestamp: 'yesterday' });
    const formatDrift = drifts.find((d) => d.kind === 'FORMAT_CHANGED');
    expect(formatDrift).toBeDefined();
    expect(formatDrift?.severity).toBe('warning');
    expect(formatDrift?.expected).toBe('format:date-time');
    expect(formatDrift?.actual).toBe('raw-string');
  });

  it('respects minDriftConfirmations before triggering strict mode error', () => {
    const sw = createShapewatch({
      learnSamples: 1,
      mode: 'strict',
      minDriftConfirmations: 2,
    });

    sw.observe('GET /status', { online: true });

    // 1st drift occurrence: count = 1 < 2 => does not throw
    expect(() => {
      sw.observe('GET /status', { online: 'yes' }); // type change
    }).not.toThrow();

    // 2nd drift occurrence: count = 2 >= 2 => throws strict error
    expect(() => {
      sw.observe('GET /status', { online: 'yes' });
    }).toThrow();
  });
});
