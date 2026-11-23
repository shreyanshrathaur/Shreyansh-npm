import type { Drift } from './types.js';

export class ShapewatchDriftError extends Error {
  public readonly drifts: Drift[];

  constructor(drifts: Drift[]) {
    const summary = drifts
      .map((d) => `[${d.severity.toUpperCase()}] ${d.kind} at ${d.path} (${d.endpoint})`)
      .join('; ');
    super(`API response shape drift detected: ${summary}`);
    this.name = 'ShapewatchDriftError';
    this.drifts = drifts;
    Object.setPrototypeOf(this, ShapewatchDriftError.prototype);
  }
}
