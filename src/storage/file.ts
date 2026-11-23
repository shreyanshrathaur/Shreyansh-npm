import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EndpointBaseline, Report, StorageAdapter } from '../types.js';

export interface FileStorageOptions {
  baseDir?: string;
}

export class FileStorage implements StorageAdapter {
  private baseDir: string;

  constructor(options: FileStorageOptions = {}) {
    this.baseDir = options.baseDir || path.resolve('.shapewatch');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getBaselineFilePath(): string {
    return path.join(this.baseDir, 'baselines.json');
  }

  private getReportFilePath(): string {
    return path.join(this.baseDir, 'report.json');
  }

  private readJson<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  private writeJsonAtomic(filePath: string, data: unknown): void {
    this.ensureDir();
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  public loadBaseline(endpoint: string): EndpointBaseline | null {
    const fileData = this.readJson<Record<string, EndpointBaseline>>(this.getBaselineFilePath());
    if (!fileData) return null;
    return fileData[endpoint] || null;
  }

  public saveBaseline(endpoint: string, baseline: EndpointBaseline): void {
    const filePath = this.getBaselineFilePath();
    const fileData = this.readJson<Record<string, EndpointBaseline>>(filePath) || {};
    fileData[endpoint] = baseline;
    this.writeJsonAtomic(filePath, fileData);
  }

  public loadReport(): Report | null {
    return this.readJson<Report>(this.getReportFilePath());
  }

  public saveReport(report: Report): void {
    this.writeJsonAtomic(this.getReportFilePath(), report);
  }
}
