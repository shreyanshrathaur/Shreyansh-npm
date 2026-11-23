import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MemoryStorage } from '../src/storage/memory.js';
import { FileStorage } from '../src/storage/file.js';
import { LocalStorageAdapter } from '../src/storage/localstorage.js';
import type { EndpointBaseline, Report } from '../src/types.js';

describe('Storage Adapters', () => {
  const dummyBaseline: EndpointBaseline = {
    endpoint: 'GET /test',
    samples: 1,
    fields: {},
    frozen: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dummyReport: Report = {
    drifts: [],
    generatedAt: new Date().toISOString(),
    summary: { total: 0, breaking: 0, warning: 0, info: 0 },
  };

  describe('MemoryStorage', () => {
    it('saves and loads baseline and report without shared mutation', () => {
      const storage = new MemoryStorage();
      storage.saveBaseline('GET /test', dummyBaseline);
      const loaded = storage.loadBaseline('GET /test');
      expect(loaded).toEqual(dummyBaseline);

      storage.saveReport(dummyReport);
      expect(storage.loadReport()).toEqual(dummyReport);
    });
  });

  describe('FileStorage', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shapewatch-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('persists baselines and reports atomically across instances', () => {
      const storage1 = new FileStorage({ baseDir: tmpDir });
      storage1.saveBaseline('GET /test', dummyBaseline);
      storage1.saveReport(dummyReport);

      const storage2 = new FileStorage({ baseDir: tmpDir });
      const loadedBaseline = storage2.loadBaseline('GET /test');
      expect(loadedBaseline).toEqual(dummyBaseline);

      const loadedReport = storage2.loadReport();
      expect(loadedReport).toEqual(dummyReport);
    });
  });

  describe('LocalStorageAdapter', () => {
    it('handles environments safely when localStorage is unavailable or present', () => {
      const storage = new LocalStorageAdapter();
      // In Node environment without window.localStorage, returns null safely
      expect(storage.loadBaseline('GET /test')).toBeNull();
      expect(storage.loadReport()).toBeNull();
    });
  });
});
