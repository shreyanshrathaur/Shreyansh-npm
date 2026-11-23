# @shreyanshrathaur/shapewatch

> Zero-dependency runtime API response shape drift detection, TypeScript interface generator, and monitoring engine.

[![npm version](https://img.shields.io/npm/v/@shreyanshrathaur/shapewatch.svg)](https://www.npmjs.com/package/@shreyanshrathaur/shapewatch)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)

**Shapewatch** learns API response contracts from live traffic at runtime, establishes baseline schemas per normalized endpoint, and detects silent breaking changes—without ever retaining private payload values.

---

## ⚡ Quick Start

### Installation

```bash
npm install @shreyanshrathaur/shapewatch
```

### Basic Usage with `fetch`

```typescript
import { createShapewatch } from '@shreyanshrathaur/shapewatch';

const sw = createShapewatch({
  learnSamples: 20, // Learn first 20 responses per endpoint
  mode: 'watch',    // 'learn' | 'watch' | 'strict' | 'off'
  webhookUrl: 'https://hooks.slack.com/services/...', // Slack/Discord/Webhook alerts
  onDrift: (drift) => {
    console.warn(`[${drift.severity}] ${drift.kind} at ${drift.path}`);
  },
});

// Wrap native fetch
const api = sw.wrapFetch(fetch);
const response = await api('https://api.example.com/users/123');
const data = await response.json();
```

---

## 🚀 What's New in v0.2.0

### 1. Generate TypeScript & JSON Schema
Automatically convert your learned API baselines into production-grade TypeScript interfaces or JSON Schemas:

```bash
# Generate TypeScript interface
npx shapewatch generate-types --endpoint "GET /users/:id" --name UserDTO

# Generate JSON Schema
npx shapewatch generate-types --endpoint "GET /users/:id" --format json
```

Or programmatically:
```typescript
const tsInterface = sw.generateTypeScript('GET /users/:id', 'UserDTO');
const jsonSchema = sw.generateJsonSchema('GET /users/:id');
```

### 2. Built-in Local UI Dashboard
Inspect endpoints, baseline health, and drift timelines in an interactive browser dashboard:

```bash
npx shapewatch ui --port 4000
```
Open [http://localhost:4000](http://localhost:4000) to view live schemas and test payloads!

### 3. Express & Server Middleware
Monitor outgoing API responses before they reach your frontend:

```typescript
import express from 'express';
import { createShapewatch, createExpressMiddleware } from '@shreyanshrathaur/shapewatch';

const app = express();
const sw = createShapewatch();

app.use(createExpressMiddleware(sw));
```

### 4. TanStack Query (React Query) Wrapper
```typescript
import { wrapQueryFn } from '@shreyanshrathaur/shapewatch';

const fetchUser = wrapQueryFn(sw, 'GET /users/:id', async () => {
  const res = await fetch('/api/users/123');
  return res.json();
});

useQuery({ queryKey: ['user', 123], queryFn: fetchUser });
```

### 5. Format & Pattern Intelligence
Automatically detects and monitors string patterns (`date-time`, `email`, `uuid`, `uri`). If a timestamp suddenly reverts to plain text, Shapewatch flags a `FORMAT_CHANGED` warning!

---

## 🔍 Drift Classifications

| Kind | Severity | Description |
|---|---|---|
| `FIELD_REMOVED` | **breaking** | A required baseline field is absent |
| `TYPE_CHANGED` | **breaking** | Observed non-null type is incompatible with baseline |
| `UNEXPECTED_NULL` | **warning** | A field previously never null is null |
| `FORMAT_CHANGED` | **warning** | String pattern changed (e.g. ISO-8601 date to text) |
| `FIELD_ADDED` | **info** | A previously unseen field appears |

---

## 🛠️ CLI Reference

```bash
# Initialize project config
npx shapewatch init

# Inspect detected drift report
npx shapewatch report --format json

# Compare a JSON payload directly against a baseline in CI/CD
npx shapewatch diff --baseline .shapewatch/baselines.json --sample payload.json --endpoint "GET /users/:id"

# Generate TypeScript interfaces
npx shapewatch generate-types --baseline .shapewatch/baselines.json --name MyDto

# Launch the visual dashboard
npx shapewatch ui
```

---

## 🔒 Security & Privacy

- **Zero Runtime Dependencies**: Zero supply chain bloat or third-party vulnerabilities.
- **Privacy First**: Only field paths, types, counts, and formats are recorded. Raw body values, tokens, credentials, and query strings are never stored or exposed.

---

## License

MIT © [Shreyansh](https://github.com/shreyanshrathaur)
