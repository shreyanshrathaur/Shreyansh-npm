import type { Drift } from '../types.js';

export async function sendWebhookNotification(webhookUrl: string, drift: Drift): Promise<void> {
  if (!webhookUrl || typeof fetch === 'undefined') {
    return;
  }

  const payload = {
    event: 'shapewatch_drift',
    drift,
    // Slack and Discord message compatibility
    text: `⚠️ [${drift.severity.toUpperCase()}] ${drift.kind} at \`${drift.path}\` on ${drift.endpoint}`,
    attachments: [
      {
        color: drift.severity === 'breaking' ? '#ef4444' : drift.severity === 'warning' ? '#f59e0b' : '#3b82f6',
        title: `Shape Drift: ${drift.kind}`,
        fields: [
          { title: 'Endpoint', value: drift.endpoint, short: true },
          { title: 'Path', value: drift.path, short: true },
          { title: 'Expected', value: drift.expected || 'N/A', short: true },
          { title: 'Actual', value: drift.actual || 'N/A', short: true },
          { title: 'Violations', value: String(drift.count), short: true },
          { title: 'Severity', value: drift.severity, short: true },
        ],
        footer: 'Shapewatch API Monitoring',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget: do not block or crash the host application
  }
}
