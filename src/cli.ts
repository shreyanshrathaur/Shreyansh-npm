#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { compareObservation } from './compare.js';
import { generateTypeScriptTypes, generateJsonSchema } from './generators.js';
import type { EndpointBaseline, Report } from './types.js';

export const pkg = { version: '0.2.0' };

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
  generate-types           Generate TypeScript interfaces or JSON schema from baseline
  ui                       Start interactive local web dashboard

Options:
  --help, -h               Show help
  --version, -v            Show version
  --json                   Output in JSON format
  --format <table|json|ts> Output format
  --baseline <path>        Path to baseline JSON file
  --sample <path>          Path to response sample JSON file
  --endpoint <key>         Endpoint key (e.g. "GET /users/:id")
  --name <string>          Interface name for TypeScript output (default: ApiResponse)
  --input <path>           Input report file
  --config <path>          Config file path
  --port <number>          Port for local UI server (default: 4000)
  --dir <path>             Base directory containing .shapewatch data
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
    minDriftConfirmations: 1,
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

export function handleGenerateTypes(args: string[]): number {
  let baselinePath = path.resolve('.shapewatch/baselines.json');
  const baseIdx = args.indexOf('--baseline');
  if (baseIdx !== -1 && args[baseIdx + 1]) {
    baselinePath = path.resolve(args[baseIdx + 1]!);
  }

  const endpointIdx = args.indexOf('--endpoint');
  const nameIdx = args.indexOf('--name');
  const formatIdx = args.indexOf('--format');

  const interfaceName = (nameIdx !== -1 && args[nameIdx + 1]) || 'ApiResponse';
  const format = (formatIdx !== -1 && args[formatIdx + 1]) || 'ts';

  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline file not found: ${baselinePath}`);
    return 2;
  }

  let fileContent: Record<string, EndpointBaseline> | EndpointBaseline;
  try {
    fileContent = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  } catch (err) {
    console.error(`Error reading baseline file: ${(err as Error).message}`);
    return 2;
  }

  let baseline: EndpointBaseline | undefined;
  if ('fields' in fileContent) {
    baseline = fileContent as EndpointBaseline;
  } else {
    const epKey = endpointIdx !== -1 && args[endpointIdx + 1] ? args[endpointIdx + 1]! : Object.keys(fileContent)[0];
    if (epKey) {
      baseline = fileContent[epKey];
    }
  }

  if (!baseline) {
    console.error('No baseline found in file.');
    return 2;
  }

  if (format === 'json' || args.includes('--json')) {
    const schema = generateJsonSchema(baseline);
    console.log(JSON.stringify(schema, null, 2));
  } else {
    const tsCode = generateTypeScriptTypes(baseline, interfaceName);
    console.log(tsCode);
  }

  return 0;
}

export function handleUiServer(args: string[], testServerOnly: boolean = false): { close: () => void } | number {
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1]!, 10) : 4000;

  const dirIdx = args.indexOf('--dir');
  const baseDir = dirIdx !== -1 && args[dirIdx + 1] ? path.resolve(args[dirIdx + 1]!) : path.resolve('.shapewatch');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Shapewatch Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; display: flex; align-items: center; gap: 10px; margin-top: 0; }
    .badge { background: #3b82f6; font-size: 13px; padding: 4px 10px; border-radius: 9999px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-size: 12px; text-transform: uppercase; }
    .tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
    .tag-breaking { background: #7f1d1d; color: #fca5a5; }
    .tag-warning { background: #78350f; color: #fde68a; }
    .tag-info { background: #1e3a8a; color: #93c5fd; }
  </style>
</head>
<body>
  <h1>Shapewatch Dashboard <span class="badge">Live</span></h1>
  <div class="card">
    <h3>Active Endpoints & Baselines</h3>
    <div id="endpointsList">Scanning .shapewatch directory...</div>
  </div>
  <div class="card">
    <h3>Recent Drift Report</h3>
    <div id="reportList">Loading report data...</div>
  </div>
  <script>
    async function loadData() {
      try {
        const res = await fetch('/api/data');
        const data = await res.json();
        
        let epHtml = '<table><thead><tr><th>Endpoint</th><th>Samples</th><th>Fields</th><th>Status</th></tr></thead><tbody>';
        const endpoints = Object.keys(data.baselines || {});
        if (endpoints.length === 0) {
          epHtml = '<p>No baselines learned yet. Run requests to start learning.</p>';
        } else {
          for (const ep of endpoints) {
            const b = data.baselines[ep];
            epHtml += '<tr><td><strong>' + ep + '</strong></td><td>' + b.samples + '</td><td>' + Object.keys(b.fields || {}).length + '</td><td>' + (b.frozen ? 'Frozen' : 'Learning') + '</td></tr>';
          }
          epHtml += '</tbody></table>';
        }
        document.getElementById('endpointsList').innerHTML = epHtml;

        let rHtml = '<table><thead><tr><th>Endpoint</th><th>Severity</th><th>Kind</th><th>Path</th><th>Violations</th></tr></thead><tbody>';
        const drifts = data.report?.drifts || [];
        if (drifts.length === 0) {
          rHtml = '<p style="color: #4ade80;">✓ Zero drifts detected across all endpoints.</p>';
        } else {
          for (const d of drifts) {
            rHtml += '<tr><td>' + d.endpoint + '</td><td><span class="tag tag-' + d.severity + '">' + d.severity + '</span></td><td>' + d.kind + '</td><td><code>' + d.path + '</code></td><td>' + d.count + '</td></tr>';
          }
          rHtml += '</tbody></table>';
        }
        document.getElementById('reportList').innerHTML = rHtml;
      } catch (err) {
        document.getElementById('endpointsList').textContent = 'Error loading data: ' + err.message;
      }
    }
    loadData();
    setInterval(loadData, 5000);
  </script>
</body>
</html>`;

  const server = http.createServer((req, res) => {
    if (req.url === '/api/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const baselinesPath = path.join(baseDir, 'baselines.json');
      const reportPath = path.join(baseDir, 'report.json');

      const baselines = fs.existsSync(baselinesPath) ? JSON.parse(fs.readFileSync(baselinesPath, 'utf-8')) : {};
      const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf-8')) : { drifts: [] };
      res.end(JSON.stringify({ baselines, report }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  server.listen(port, () => {
    if (!testServerOnly) {
      console.log(`\n  🚀 Shapewatch Dashboard running at: http://localhost:${port}\n`);
    }
  });

  if (testServerOnly) {
    return { close: () => server.close() };
  }

  return 0;
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
    case 'generate-types':
      return handleGenerateTypes(args.slice(1));
    case 'ui':
      return typeof handleUiServer(args.slice(1)) === 'number' ? 0 : 0;
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
