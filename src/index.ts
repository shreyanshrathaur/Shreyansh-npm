import { BaselineManager } from './baseline.js';
import { compareObservation } from './compare.js';
import { Reporter } from './reporter.js';
import { normalizeEndpoint } from './normalize.js';
import { ShapewatchDriftError } from './errors.js';
import { createFetchWrapper } from './adapters/fetch.js';
import { createAxiosInterceptor } from './adapters/axios.js';
import type {
  Drift,
  EndpointBaseline,
  Report,
  Shapewatch,
  ShapewatchOptions,
  WatchMode,
} from './types.js';

export * from './types.js';
export * from './errors.js';
export * from './walk.js';
export * from './baseline.js';
export * from './compare.js';
export * from './reporter.js';
export * from './normalize.js';
export * from './storage/memory.js';
export * from './storage/file.js';
export * from './storage/localstorage.js';

export function createShapewatch(options: ShapewatchOptions = {}): Shapewatch {
  let mode: WatchMode = options.mode || 'watch';
  const sampleRate = options.sampleRate ?? 1;
  const customNormalize = options.normalizeEndpoint;
  const onDrift = options.onDrift;

  const baselineManager = new BaselineManager({
    learnSamples: options.learnSamples,
    requiredThreshold: options.requiredThreshold,
    maxDepth: options.maxDepth,
    maxArrayItems: options.maxArrayItems,
    ignorePaths: options.ignorePaths,
    maxEndpoints: options.maxEndpoints,
  });

  const reporter = new Reporter(options.maxDriftKeys);
  const storage = options.storage;

  const instance: Shapewatch = {
    observe(endpointInput: string, data: unknown): Drift[] {
      if (mode === 'off') {
        return [];
      }

      if (sampleRate < 1 && Math.random() > sampleRate) {
        return [];
      }

      const endpoint = customNormalize
        ? customNormalize(endpointInput)
        : normalizeEndpoint(endpointInput);

      let baseline = baselineManager.getBaseline(endpoint);

      if (!baseline && storage) {
        const stored = storage.loadBaseline(endpoint);
        if (stored && !(stored instanceof Promise)) {
          baselineManager.importAll({ [endpoint]: stored });
          baseline = baselineManager.getBaseline(endpoint);
        }
      }

      // If in explicit learn mode or baseline is not yet frozen
      if (mode === 'learn' || !baseline || !baseline.frozen) {
        const updated = baselineManager.recordSample(endpoint, data);
        if (storage && updated.frozen) {
          storage.saveBaseline(endpoint, updated);
        }
        return [];
      }

      // Baseline is frozen, perform comparison
      const rawDrifts = compareObservation(endpoint, baseline, data, {
        maxDepth: options.maxDepth,
        maxArrayItems: options.maxArrayItems,
        ignorePaths: options.ignorePaths,
      });

      if (rawDrifts.length === 0) {
        return [];
      }

      const recordedDrifts = reporter.recordDrifts(rawDrifts);

      if (storage && storage.saveReport) {
        storage.saveReport(reporter.getReport());
      }

      for (const drift of recordedDrifts) {
        if (onDrift) {
          try {
            onDrift(drift);
          } catch {
            // Container protects host application
          }
        }
      }

      if (mode === 'strict' && recordedDrifts.length > 0) {
        throw new ShapewatchDriftError(recordedDrifts);
      }

      return recordedDrifts;
    },

    report(): Report {
      return reporter.getReport();
    },

    setMode(newMode: WatchMode): void {
      mode = newMode;
    },

    reset(endpoint?: string): void {
      baselineManager.reset(endpoint);
      if (!endpoint) {
        reporter.reset();
      }
    },

    exportBaseline(endpoint?: string): Record<string, EndpointBaseline> {
      return baselineManager.exportAll(endpoint);
    },

    importBaseline(snapshot: Record<string, EndpointBaseline>): void {
      baselineManager.importAll(snapshot);
    },

    wrapFetch<F extends typeof fetch>(fetchImpl: F): F {
      return createFetchWrapper(instance, customNormalize)(fetchImpl);
    },

    axiosInterceptor(): (response: any) => any {
      return createAxiosInterceptor(instance, customNormalize);
    },
  };

  return instance;
}
