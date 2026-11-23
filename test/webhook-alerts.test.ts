import { describe, it, expect, vi } from 'vitest';
import { sendWebhookNotification } from '../src/alerts/webhook.js';
import { createShapewatch } from '../src/index.js';
import type { Drift } from '../src/types.js';

describe('Webhook & Slack / Discord Alerts', () => {
  it('sends formatted webhook payload on shape drift', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    (globalThis as any).fetch = fetchMock;

    const dummyDrift: Drift = {
      endpoint: 'GET /orders/:id',
      kind: 'FIELD_REMOVED',
      severity: 'breaking',
      path: '$.total',
      expected: 'number',
      actual: 'undefined',
      count: 1,
      firstSeen: '',
      lastSeen: '',
    };

    await sendWebhookNotification('https://hooks.slack.com/services/test', dummyDrift);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe('https://hooks.slack.com/services/test');
    const body = JSON.parse(callArgs[1].body);
    expect(body.event).toBe('shapewatch_drift');
    expect(body.text).toContain('FIELD_REMOVED');
    expect(body.attachments[0].color).toBe('#ef4444');
  });

  it('triggers webhook notification automatically from observe()', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    (globalThis as any).fetch = fetchMock;

    const sw = createShapewatch({
      learnSamples: 1,
      webhookUrl: 'https://webhook.site/test',
    });

    sw.observe('GET /items', { title: 'Book' });
    sw.observe('GET /items', { title: 'Book', newExtra: true }); // triggers FIELD_ADDED

    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalled();
  });
});
