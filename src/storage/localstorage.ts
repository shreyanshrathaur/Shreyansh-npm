import type { EndpointBaseline, Report, StorageAdapter } from '../types.js';

export interface LocalStorageOptions {
  prefix?: string;
}

export class LocalStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(options: LocalStorageOptions = {}) {
    this.prefix = options.prefix || 'shapewatch:';
  }

  private get isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
      return false;
    }
  }

  public loadBaseline(endpoint: string): EndpointBaseline | null {
    if (!this.isAvailable) return null;
    try {
      const raw = window.localStorage.getItem(`${this.prefix}baseline:${endpoint}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public saveBaseline(endpoint: string, baseline: EndpointBaseline): void {
    if (!this.isAvailable) return;
    try {
      window.localStorage.setItem(
        `${this.prefix}baseline:${endpoint}`,
        JSON.stringify(baseline)
      );
    } catch {
      // Storage quota or privacy restriction
    }
  }

  public loadReport(): Report | null {
    if (!this.isAvailable) return null;
    try {
      const raw = window.localStorage.getItem(`${this.prefix}report`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public saveReport(report: Report): void {
    if (!this.isAvailable) return;
    try {
      window.localStorage.setItem(`${this.prefix}report`, JSON.stringify(report));
    } catch {
      // Storage quota or privacy restriction
    }
  }
}
