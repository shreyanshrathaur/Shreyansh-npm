#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { compareObservation } from './compare.js';
import type { EndpointBaseline, Report } from './types.js';

export const pkg = { version: '0.1.0' };

export function printHelp(): void {
  console.log(`
Shapewatch CLI v${pkg.version}
Runtime API response shape drift detection

Usage:
  shapewatch <command> [options]

Commands:
  init                     Initialize a .shapewatch configuration and directory
  report                   Inspect and output detected drift reports
  diff                     Compare a JSON sample against a baseline

Options:
  --help, -h               Show help
  --version, -v            Show version
  --json                   Output in JSON format
  --format <table|json>    Output format for report
  --baseline <path>        Path to baseline JSON file (for diff)
  --sample <path>          Path to response sample JSON file (for diff)
  --endpoint <key>         Endpoint key (for diff, e.g. "GET /users/:id")
  --input <path>           Input report file (for report)
  --config <path>          Config file path (for init)
  --force, -f              Overwrite existing files
`);
}

export function handleInit(args: string[]): number {
  const force = args.includes('--force') || args.includes('-f');
  let configPath = path.resolve('.shapewatch/shapewatch.json');

  const configIdx = args.indexOf('--config');
  if (configIdx !== -1 && args[configIdx + 1]) {
    configPath = path.resolve(args[configIdx + 1]!);
  }

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(configPath) && !force) {
    console.error(`Config file already exists at ${configPath}. Use --force to overwrite.`);
    return 2;
  }

  const defaultConfig = {
    learnSamples: 20,
    mode: 'watch',
    sampleRate: 1.0,
    requiredThreshold: 0.95,
    ignorePaths: ['$.meta.requestId', '$.timestamp'],
  };

  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  console.log(`Initialized Shapewatch config at ${configPath}`);
  return 0;
}

export function handleReport(args: string[]): number {
  let reportPath = path.resolve('.shapewatch/report.json');
  const inputIdx = args.indexOf('--input');
  if (inputIdx !== -1 && args[inputIdx + 1]) {
    reportPath = path.resolve(args[inputIdx + 1]!);
  }

  const jsonOutput = args.includes('--json') || args.includes('json');

  if (!fs.existsSync(reportPath)) {
    console.error(`Report file not found: ${reportPath}`);
    return 2;
  }

  let report: Report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse report file: ${(err as Error).message}`);
    return 2;
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nShapewatch Report — ${report.generatedAt}`);
    console.log(`Total Drifts: ${report.summary.total} (Breaking: ${report.summary.breaking}, Warning: ${report.summary.warning}, Info: ${report.summary.info})\n`);
    if (report.drifts.length > 0) {
      console.table(
        report.drifts.map((d) => ({
          Endpoint: d.endpoint,
          Severity: d.severity,
          Kind: d.kind,
          Path: d.path,
          Expected: d.expected || '',
          Actual: d.actual || '',
          Count: d.count,
        }))
      );
    } else {
      console.log('No shape drift detected.');
    }
  }

  return report.drifts.length > 0 ? 1 : 0;
}

export function handleDiff(args: string[]): number {
  const baselineIdx = args.indexOf('--baseline');
  const sampleIdx = args.indexOf('--sample');
  const endpointIdx = args.indexOf('--endpoint');

  if (baselineIdx === -1 || !args[baselineIdx + 1] || sampleIdx === -1 || !args[sampleIdx + 1]) {
    console.error('Missing required arguments: --baseline <path> --sample <path>');
    return 2;
  }

  const baselinePath = path.resolve(args[baselineIdx + 1]!);
  const samplePath = path.resolve(args[sampleIdx + 1]!);
  const endpointKey = (endpointIdx !== -1 && args[endpointIdx + 1]) || 'SAMPLE';

  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline file not found: ${baselinePath}`);
    return 2;
  }
  if (!fs.existsSync(samplePath)) {
    console.error(`Sample file not found: ${samplePath}`);
    return 2;
  }

  let baselineData: Record<string, EndpointBaseline> | EndpointBaseline;
  let sampleData: unknown;

  try {
    baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
  } catch (err) {
    console.error(`JSON read error: ${(err as Error).message}`);
    return 2;
  }

  let baseline: EndpointBaseline | undefined;
  if ('fields' in baselineData) {
    baseline = baselineData as EndpointBaseline;
  } else {
    baseline = (baselineData as Record<string, EndpointBaseline>)[endpointKey];
  }

  if (!baseline) {
    console.error(`No baseline found for endpoint: ${endpointKey}`);
    return 2;
  }

  const drifts = compareObservation(endpointKey, baseline, sampleData);
  const jsonOutput = args.includes('--json');

  if (jsonOutput) {
    console.log(JSON.stringify(drifts, null, 2));
  } else {
    if (drifts.length === 0) {
      console.log('✓ No drift detected against baseline.');
    } else {
      console.log(`Found ${drifts.length} drift(s):`);
      for (const d of drifts) {
        console.log(`  [${d.severity.toUpperCase()}] ${d.kind} at ${d.path} (expected: ${d.expected}, actual: ${d.actual})`);
      }
    }
  }

  return drifts.length > 0 ? 1 : 0;
}

export function runCli(args: string[]): number {
  const command = args[0];

  if (!command || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`v${pkg.version}`);
    return 0;
  }

  switch (command) {
    case 'init':
      return handleInit(args.slice(1));
    case 'report':
      return handleReport(args.slice(1));
    case 'diff':
      return handleDiff(args.slice(1));
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      return 2;
  }
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('cli.ts') || process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.cjs'));

if (isMain) {
  const code = runCli(process.argv.slice(2));
  process.exit(code);
}
