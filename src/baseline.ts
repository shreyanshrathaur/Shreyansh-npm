import type { EndpointBaseline } from './types.js';
import { walkValue, type WalkOptions } from './walk.js';

export interface BaselineConfig extends WalkOptions {
  learnSamples?: number;
  requiredThreshold?: number;
}

export class BaselineManager {
  private baselines: Map<string, EndpointBaseline> = new Map();
  private maxEndpoints: number;
  private learnSamples: number;
  private requiredThreshold: number;
  private walkOptions: WalkOptions;

  constructor(options: BaselineConfig & { maxEndpoints?: number } = {}) {
    this.learnSamples = options.learnSamples ?? 20;
    this.requiredThreshold = options.requiredThreshold ?? 0.95;
    this.maxEndpoints = options.maxEndpoints ?? 1000;
    this.walkOptions = {
      maxDepth: options.maxDepth,
      maxArrayItems: options.maxArrayItems,
      ignorePaths: options.ignorePaths,
    };
  }

  public getBaseline(endpoint: string): EndpointBaseline | undefined {
    return this.baselines.get(endpoint);
  }

  public isFrozen(endpoint: string): boolean {
    const b = this.baselines.get(endpoint);
    return b ? b.frozen : false;
  }

  public getOrCreateBaseline(endpoint: string): EndpointBaseline {
    let baseline = this.baselines.get(endpoint);
    if (!baseline) {
      if (this.baselines.size >= this.maxEndpoints) {
        throw new Error(`Endpoint capacity limit reached (${this.maxEndpoints})`);
      }
      const now = new Date().toISOString();
      baseline = {
        endpoint,
        samples: 0,
        fields: {},
        frozen: false,
        createdAt: now,
        updatedAt: now,
      };
      this.baselines.set(endpoint, baseline);
    }
    return baseline;
  }

  public recordSample(endpoint: string, data: unknown): EndpointBaseline {
    const baseline = this.getOrCreateBaseline(endpoint);
    if (baseline.frozen) {
      return baseline;
    }

    const observedFields = walkValue(data, this.walkOptions);
    baseline.samples += 1;
    baseline.updatedAt = new Date().toISOString();

    // Increment eligible count for all known fields or initialize new fields
    for (const [path, obs] of observedFields) {
      let stat = baseline.fields[path];
      if (!stat) {
        stat = {
          path,
          seen: 0,
          eligible: baseline.samples - 1, // missed prior samples
          presentRatio: 0,
          typeCounts: {},
          nullCount: 0,
          allowedTypes: [],
          allowsNull: false,
          required: false,
        };
        baseline.fields[path] = stat;
      }
      stat.seen += 1;
      stat.eligible += 1;
      stat.presentRatio = stat.eligible > 0 ? stat.seen / stat.eligible : 1;

      if (obs.isNull) {
        stat.nullCount += 1;
        stat.allowsNull = true;
      } else {
        stat.typeCounts[obs.type] = (stat.typeCounts[obs.type] || 0) + 1;
        if (!stat.allowedTypes.includes(obs.type)) {
          stat.allowedTypes.push(obs.type);
        }
      }
    }

    // For fields in baseline that were NOT observed in this sample, increment eligible
    for (const [path, stat] of Object.entries(baseline.fields)) {
      if (!observedFields.has(path)) {
        stat.eligible += 1;
        stat.presentRatio = stat.eligible > 0 ? stat.seen / stat.eligible : 0;
      }
    }

    if (baseline.samples >= this.learnSamples) {
      this.freezeBaseline(baseline);
    }

    return baseline;
  }

  private freezeBaseline(baseline: EndpointBaseline): void {
    baseline.frozen = true;
    for (const stat of Object.values(baseline.fields)) {
      stat.required = stat.presentRatio >= this.requiredThreshold && stat.eligible > 0;
    }
  }

  public reset(endpoint?: string): void {
    if (endpoint) {
      this.baselines.delete(endpoint);
    } else {
      this.baselines.clear();
    }
  }

  public exportAll(endpoint?: string): Record<string, EndpointBaseline> {
    const result: Record<string, EndpointBaseline> = {};
    if (endpoint) {
      const b = this.baselines.get(endpoint);
      if (b) {
        result[endpoint] = JSON.parse(JSON.stringify(b));
      }
    } else {
      for (const [ep, b] of this.baselines.entries()) {
        result[ep] = JSON.parse(JSON.stringify(b));
      }
    }
    return result;
  }

  public importAll(snapshot: Record<string, EndpointBaseline>): void {
    for (const [ep, b] of Object.entries(snapshot)) {
      this.baselines.set(ep, JSON.parse(JSON.stringify(b)));
    }
  }
}
