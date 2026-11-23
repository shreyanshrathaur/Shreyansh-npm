import type { Drift, Report } from './types.js';

export class Reporter {
  private driftsMap = new Map<string, Drift>();
  private maxDriftKeys: number;

  constructor(maxDriftKeys: number = 5000) {
    this.maxDriftKeys = maxDriftKeys;
  }

  private makeKey(endpoint: string, kind: string, path: string): string {
    return `${endpoint}::${kind}::${path}`;
  }

  public recordDrifts(newDrifts: Drift[]): Drift[] {
    const recorded: Drift[] = [];
    const now = new Date().toISOString();

    for (const drift of newDrifts) {
      const key = this.makeKey(drift.endpoint, drift.kind, drift.path);
      const existing = this.driftsMap.get(key);

      if (existing) {
        existing.count += 1;
        existing.lastSeen = now;
        existing.actual = drift.actual;
        recorded.push({ ...existing });
      } else {
        if (this.driftsMap.size < this.maxDriftKeys) {
          const fresh: Drift = {
            ...drift,
            count: 1,
            firstSeen: now,
            lastSeen: now,
          };
          this.driftsMap.set(key, fresh);
          recorded.push({ ...fresh });
        }
      }
    }

    return recorded;
  }

  public getReport(): Report {
    const list: Drift[] = Array.from(this.driftsMap.values()).sort((a, b) => {
      if (a.endpoint !== b.endpoint) return a.endpoint.localeCompare(b.endpoint);
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      return a.kind.localeCompare(b.kind);
    });

    let breaking = 0;
    let warning = 0;
    let info = 0;

    for (const d of list) {
      if (d.severity === 'breaking') breaking++;
      else if (d.severity === 'warning') warning++;
      else if (d.severity === 'info') info++;
    }

    return {
      drifts: list,
      generatedAt: new Date().toISOString(),
      summary: {
        total: list.length,
        breaking,
        warning,
        info,
      },
    };
  }

  public reset(): void {
    this.driftsMap.clear();
  }
}
