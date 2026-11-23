export type DriftKind =
  | 'FIELD_REMOVED'
  | 'TYPE_CHANGED'
  | 'UNEXPECTED_NULL'
  | 'FIELD_ADDED';

export type Severity = 'breaking' | 'warning' | 'info';

export type WatchMode = 'learn' | 'watch' | 'strict' | 'off';

export type PrimitiveType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';

export interface FieldObservation {
  seen: number;
  typeCounts: Record<string, number>;
  nullCount: number;
}

export interface FieldStats {
  path: string;
  seen: number;
  eligible: number;
  presentRatio: number;
  typeCounts: Record<string, number>;
  nullCount: number;
  allowedTypes: string[];
  allowsNull: boolean;
  required: boolean;
}

export interface EndpointBaseline {
  endpoint: string;
  samples: number;
  fields: Record<string, FieldStats>;
  frozen: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Drift {
  endpoint: string;
  kind: DriftKind;
  severity: Severity;
  path: string;
  expected?: string;
  actual?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface Report {
  drifts: Drift[];
  generatedAt: string;
  summary: {
    total: number;
    breaking: number;
    warning: number;
    info: number;
  };
}

export interface StorageAdapter {
  loadBaseline(endpoint: string): Promise<EndpointBaseline | null> | EndpointBaseline | null;
  saveBaseline(endpoint: string, baseline: EndpointBaseline): Promise<void> | void;
  loadReport?(): Promise<Report | null> | Report | null;
  saveReport?(report: Report): Promise<void> | void;
}

export interface ShapewatchOptions {
  learnSamples?: number;
  mode?: WatchMode;
  ignorePaths?: string[];
  sampleRate?: number;
  maxDepth?: number;
  maxArrayItems?: number;
  maxBodyBytes?: number;
  requiredThreshold?: number;
  maxEndpoints?: number;
  maxDriftKeys?: number;
  normalizeEndpoint?: (url: string, method?: string) => string;
  storage?: StorageAdapter;
  onDrift?: (drift: Drift) => void;
}

export interface Shapewatch {
  observe(endpoint: string, data: unknown): Drift[];
  report(): Report;
  setMode(mode: WatchMode): void;
  reset(endpoint?: string): void;
  exportBaseline(endpoint?: string): Record<string, EndpointBaseline>;
  importBaseline(snapshot: Record<string, EndpointBaseline>): void;
  wrapFetch<F extends typeof fetch>(fetchImpl: F): F;
  axiosInterceptor(): (response: any) => any;
}
