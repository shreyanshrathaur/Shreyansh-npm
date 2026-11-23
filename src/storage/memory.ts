import type { EndpointBaseline, Report, StorageAdapter } from '../types.js';

export class MemoryStorage implements StorageAdapter {
  private baselines = new Map<string, EndpointBaseline>();
  private lastReport: Report | null = null;

  public loadBaseline(endpoint: string): EndpointBaseline | null {
    const found = this.baselines.get(endpoint);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  public saveBaseline(endpoint: string, baseline: EndpointBaseline): void {
    this.baselines.set(endpoint, JSON.parse(JSON.stringify(baseline)));
  }

  public loadReport(): Report | null {
    return this.lastReport ? JSON.parse(JSON.stringify(this.lastReport)) : null;
  }

  public saveReport(report: Report): void {
    this.lastReport = JSON.parse(JSON.stringify(report));
  }
}
