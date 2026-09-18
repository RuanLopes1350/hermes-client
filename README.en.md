# 🕊️ Hermes Client SDK

> 🇧🇷 **Versão em Português?** [README.md](README.md)

<div align="center">

[![npm](https://img.shields.io/badge/npm-%40ruanlopes1350%2Fhermes--client-red.svg)](https://www.npmjs.com/package/@ruanlopes1350/hermes-client)
[![Version](https://img.shields.io/badge/version-1.2.2-blue.svg)](https://www.npmjs.com/package/@ruanlopes1350/hermes-client)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

**Official Node.js/TypeScript SDK for integrating with Hermes - Transactional Email Gateway.**

[API Backend](https://github.com/RuanLopes1350/hermes-api) • [Admin Dashboard](https://github.com/RuanLopes1350/hermes-front)

</div>

---

## 📋 Table of Contents

- [Installation](#-installation)
- [Initialization](#-initialization)
- [Sending Emails](#-sending-emails-builder-pattern)
- [Bulk Email Sending](#-bulk-email-sending)
- [Status Streaming (SSE)](#-status-streaming-sse)
- [Health Check](#-health-check)
- [Typed Error Handling](#️-typed-error-handling)
- [Template Helpers](#-template-helpers)
- [Automatic Key Rotation (Webhooks)](#-automatic-key-rotation-webhooks)
- [Events (Lifecycle)](#-events-lifecycle)
- [Storage Adapters](#️-storage-adapters)
- [Retry Configuration](#️-retry-configuration)
- [Build & Distribution](#-build--distribution)
- [Type Reference](#-type-reference)

---

## 📦 Installation

```bash
npm install @ruanlopes1350/hermes-client
```

---

## 🚀 Initialization

The SDK requires the address of your Hermes server and a key storage strategy (Storage Adapter).

```typescript
import { HermesClient, MemoryAdapter } from '@ruanlopes1350/hermes-client';

const hermes = new HermesClient({
  baseUrl: 'https://your-hermes-api.com',
  timeoutMs: 30000,          // Optional: request timeout (default: 30000ms)
  logLevel: 'warn',          // Optional: 'debug' | 'info' | 'warn' | 'error' | 'silent'
  storageAdapter: new MemoryAdapter('hm_your_initial_key_here'),
  retry: {                   // Optional: retry config (or `false` to disable)
    maxAttempts: 3,
    baseDelayMs: 1000,
    backoffFactor: 2,
    maxDelaysMs: 30000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
});
```

> **Shortcut:** Pass the key directly via `initialApiKey` without manually instantiating a `MemoryAdapter`:
> ```typescript
> const hermes = new HermesClient({
>   baseUrl: 'https://your-hermes-api.com',
>   initialApiKey: 'hm_your_initial_key_here',
> });
> ```
> When no `storageAdapter` is provided, the SDK automatically creates a `MemoryAdapter` using the `initialApiKey`.

---

## ✉️ Sending Emails (Builder Pattern)

```typescript
// With an MJML template and dynamic variables
await hermes.email()
  .to('customer@company.com')
  .subject('Welcome to the System!')
  .useTemplate('template-uuid', { name: 'John Doe' })
  .priority('high')            // Optional: 'high' | 'medium' | 'low'
  .credential('credential-id') // Optional: overrides the key's default credential
  .send();

// With direct HTML body (no template)
await hermes.email()
  .to('alerts@company.com')
  .subject('Security Alert')
  .body('<h1>Warning</h1><p>A login attempt was detected.</p>')
  .send();

// With scheduled delivery (accepts Date or ISO 8601 string)
await hermes.email()
  .to('newsletter@company.com')
  .subject('Monthly Newsletter')
  .useTemplate('newsletter-tpl', { month: 'October' })
  .schedule(new Date('2026-10-01T09:00:00Z'))
  .send();

// Injecting variables separately with .variables()
await hermes.email()
  .to('customer@company.com')
  .subject('Report')
  .useTemplate('report-tpl')
  .variables({ period: 'Q3 2026', total: 42 })
  .send();
```

> **Backward compatibility:** The legacy `hermes.sendEmail(payload)` method and `service_template_id` property are still supported (automatically mapped to `template_id`).

---

## 📬 Bulk Email Sending

Bulk sending supports a maximum of **100 emails per call**.

```typescript
// Fluent builder
await hermes.bulk()
  .email()
    .to('alice@example.com')
    .subject('Welcome!')
    .useTemplate('onboarding-tpl', { name: 'Alice' })
    .done()
  .email()
    .to('bob@example.com')
    .subject('Welcome!')
    .useTemplate('onboarding-tpl', { name: 'Bob' })
    .done()
  .send();

// Adding payloads directly with .add()
const bulkBuilder = hermes.bulk();
bulkBuilder.add({
  recipient_to: 'alice@example.com',
  subject: 'Hello',
  template_id: 'tpl-1',
  variables: { name: 'Alice' },
});
bulkBuilder.add({
  recipient_to: 'bob@example.com',
  subject: 'Hello',
  template_id: 'tpl-1',
  variables: { name: 'Bob' },
});
console.log(`Sending ${bulkBuilder.count} emails...`);
await bulkBuilder.send();

// Direct array form
await hermes.sendBulkEmails([
  { recipient_to: 'alice@example.com', subject: 'Hello', template_id: 'tpl-1', variables: { name: 'Alice' } },
  { recipient_to: 'bob@example.com',   subject: 'Hello', template_id: 'tpl-1', variables: { name: 'Bob' } },
]);
```

---

## 📡 Status Streaming (SSE)

The SDK provides real-time email status streaming via Server-Sent Events:

```typescript
// onEmailStatus is async - it connects and holds the connection open while receiving events
await hermes.stream.onEmailStatus((event) => {
  // event.emailId   - email ID
  // event.status    - 'pending' | 'sent' | 'failed' | 'retrying'
  // event.timestamp - ISO 8601
  console.log(`Email ${event.emailId}: ${event.status}`);
});

// To disconnect before the stream ends:
hermes.stream.disconnect();
```

> **Note:** `onEmailStatus` is an async function that keeps the connection open and only resolves when the stream ends (or is aborted). Call it with `await` in a context that allows long-running waits, or call it without `await` to avoid blocking the main flow.

---

## 🏥 Health Check

```typescript
const status = await hermes.healthCheck();
// Returns the JSON object from the GET /api/health route of the Hermes API
console.log(status.message); // "Hermes API rodando. UpTime: 42.35s"
```

---

## ⚠️ Typed Error Handling

The SDK exposes a hierarchy of error classes for granular handling. All extend `HermesError`:

```typescript
import {
  HermesError,
  HermesAuthError,
  HermesRateLimitError,
  HermesNetworkError,
  HermesTimeoutError,
  HermesValidationError,
} from '@ruanlopes1350/hermes-client';

try {
  await hermes.email()
    .to('user@example.com')
    .subject('Password Recovery')
    .useTemplate('recovery-template', { link: 'https://...' })
    .send();
} catch (err) {
  if (err instanceof HermesValidationError) {
    // Local builder validation - the request was never sent
    console.error('Invalid fields:', err.fields);
  } else if (err instanceof HermesRateLimitError) {
    console.warn(`Rate limit reached. Retry in ${err.retryAfterMs}ms`);
  } else if (err instanceof HermesAuthError) {
    // 401 or 403
    console.error('Invalid or expired API Key');
  } else if (err instanceof HermesTimeoutError) {
    console.error('Request exceeded the configured timeout');
  } else if (err instanceof HermesNetworkError) {
    console.error('Connectivity issue:', err.cause);
  } else if (err instanceof HermesError) {
    // Generic API error
    console.error(`Error ${err.code} (HTTP ${err.statusCode}):`, err.details);
  }
}
```

| Class | Code | When it occurs |
|---|---|---|
| `HermesValidationError` | `VALIDATION_ERROR` | Local validation (available for use; the current builder throws a generic `Error`) |
| `HermesAuthError` | `AUTH_ERROR` | API returned 401 or 403 |
| `HermesRateLimitError` | `RATE_LIMIT` | API returned 429 |
| `HermesTimeoutError` | `TIMEOUT` | Request exceeded `timeoutMs` |
| `HermesNetworkError` | `NETWORK_ERROR` | DNS failure, connection refused, etc. |
| `HermesError` | `API_ERROR` / ... | Generic API errors |

> **Automatic retry:** The SDK automatically retries on configurable status codes (default: 408, 429, 500, 502, 503, 504) with **exponential backoff + jitter**. Status codes outside the list (e.g., 401, 403) are **never** retried.

---

## 🧰 Template Helpers

```typescript
import { templateHelpers } from '@ruanlopes1350/hermes-client';

await hermes.email()
  .to('customer@example.com')
  .subject('Order Confirmed')
  .useTemplate('order-confirmation', {
    greeting:  templateHelpers.greeting('John'),           // "Good afternoon, John"
    orderDate: templateHelpers.formatDate(new Date()),     // "September 20, 2026"
    total:     templateHelpers.formatCurrency(149.90, 'USD', 'en-US'), // "$149.90"
  })
  .send();
```

Helpers accept locale parameters:

```typescript
templateHelpers.formatDate(new Date(), 'pt-BR');              // "20 de setembro de 2026"
templateHelpers.formatCurrency(149.90, 'BRL', 'pt-BR');       // "R$ 149,90"
```

---

## 🔄 Automatic Key Rotation (Webhooks)

Hermes sends an **HMAC-SHA256** signed Webhook whenever an API Key is about to expire. The SDK provides **plug-and-play middleware** for the most popular frameworks:

### Express.js

```typescript
import express from 'express';
import { expressWebhookHandler } from '@ruanlopes1350/hermes-client/express';

const app = express();

// IMPORTANT: use express.raw() so the HMAC signature can be validated correctly
app.post(
  '/webhook/hermes',
  express.raw({ type: 'application/json' }),
  expressWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!),
);
```

### Next.js (App Router)

Create `app/api/webhook/hermes/route.ts`:

```typescript
import { nextWebhookHandler } from '@ruanlopes1350/hermes-client/next';
import { hermes } from '@/lib/hermes'; // the instance created earlier

export const POST = nextWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!);
```

> The Next.js handler uses the Web API `Request`/`Response`, making it compatible with Edge Runtime.

### Fastify

```typescript
import fastify from 'fastify';
import rawBody from 'fastify-raw-body';
import { fastifyWebhookHandler } from '@ruanlopes1350/hermes-client/fastify';

const app = fastify();

// IMPORTANT: fastify-raw-body is required for HMAC validation
await app.register(rawBody);

app.post(
  '/webhook/hermes',
  fastifyWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!),
);
```

### Manual Handling (unsupported frameworks)

```typescript
import { verifyHermesSignature, parseWebhookPayload } from '@ruanlopes1350/hermes-client';

// 1. Validate the signature only
const isValid = await verifyHermesSignature(rawBody, signature, secret);

// 2. Validate and extract the typed payload (returns null if invalid)
const payload = await parseWebhookPayload(rawBody, signature, secret);
// payload: { serviceId: string, newApiKey: string, rotatedAt: string } | null

// 3. Update the key in the client
if (payload) {
  await hermes.updateApiKey(payload.newApiKey);
}
```

> The signature header is sent as `x-hermes-signature`.

---

## 📣 Events (Lifecycle)

`HermesClient` extends `LiteEventEmitter`, a lightweight event emitter compatible with Edge Runtimes:

```typescript
hermes.on('keyRotated', (newKey, oldKey) => {
  console.log('✅ Key rotated!', { from: oldKey, to: newKey });
});

hermes.on('error', (err) => {
  console.error('❌ Hermes client error:', err);
});

hermes.on('retry', (attempt, error, delayMs) => {
  console.warn(`⏳ Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
});

// Listen only once
hermes.once('keyRotated', (newKey) => {
  console.log('First rotation:', newKey);
});

// Remove a listener
const handler = (err: Error) => console.error(err);
hermes.on('error', handler);
hermes.off('error', handler);
```

| Event | Callback | When emitted |
|---|---|---|
| `keyRotated` | `(newKey: string, oldKey: string \| null) => void` | Key rotated via webhook or `updateApiKey()` |
| `error` | `(error: Error) => void` | Any error during sending, webhook, or stream |
| `retry` | `(attempt: number, error: Error, delayMs: number) => void` | An attempt failed and a retry was scheduled |

---

## 🗄️ Storage Adapters

When the key changes (via webhook or manually), the SDK updates it through the configured Storage Adapter.

### `MemoryAdapter` (default)

Stores the key in the instance's RAM. Simple and ideal for testing and single-instance environments.

```typescript
import { HermesClient, MemoryAdapter } from '@ruanlopes1350/hermes-client';

const hermes = new HermesClient({
  baseUrl: 'https://your-hermes-api.com',
  storageAdapter: new MemoryAdapter('hm_initial_key'),
});
```

> **Warning:** In multi-instance environments (load balancers), `MemoryAdapter` does not propagate the new key between processes. Use `EnvAdapter` or a custom adapter instead.

### `EnvAdapter`

Reads and writes the key to a physical `.env` file **and** `process.env`. Ideal for VPS/Bare Metal servers.

```typescript
import { HermesClient } from '@ruanlopes1350/hermes-client';
import { EnvAdapter } from '@ruanlopes1350/hermes-client/node';

const hermes = new HermesClient({
  baseUrl: 'https://your-hermes-api.com',
  storageAdapter: new EnvAdapter('.env', 'HERMES_API_KEY'),
});
```

> `EnvAdapter` uses synchronous `fs` and is exclusive to Node.js environments. Imported via the `/node` sub-package.

### Custom Adapter (e.g., Redis - multi-instance)

Implement the `StorageAdapter` interface:

```typescript
import { StorageAdapter, HermesClient } from '@ruanlopes1350/hermes-client';
import redis from './redis-client';

export class RedisAdapter implements StorageAdapter {
  getApiKey(): Promise<string | null> {
    return redis.get('hermes_api_key');
  }

  setApiKey(key: string): Promise<void> {
    return redis.set('hermes_api_key', key);
  }
}

const hermes = new HermesClient({
  baseUrl: 'https://your-hermes-api.com',
  storageAdapter: new RedisAdapter(),
});
```

> The `StorageAdapter` interface accepts both synchronous and asynchronous return values.

---

## ⚙️ Retry Configuration

Retries use **exponential backoff with jitter (±25%)**:

```typescript
const hermes = new HermesClient({
  baseUrl: 'https://your-hermes-api.com',
  initialApiKey: 'hm_...',
  retry: {
    maxAttempts: 5,                                       // Default: 3
    baseDelayMs: 2000,                                    // Default: 1000ms
    backoffFactor: 2,                                     // Default: 2
    maxDelaysMs: 60000,                                   // Default: 30000ms
    retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Default
  },
});

// Or disable completely:
const hermes = new HermesClient({
  baseUrl: 'https://your-hermes-api.com',
  initialApiKey: 'hm_...',
  retry: false,
});
```

---

## 📦 Build & Distribution

The SDK is built with **tsup** and distributed in dual format (ESM + CJS):

| Format | File |
|---|---|
| ESM | `dist/index.mjs` |
| CJS | `dist/index.js` |
| Types | `dist/index.d.ts` |
| Source Maps | `dist/index.js.map` / `dist/index.mjs.map` |

### Sub-packages (Exports Map)

Webhook handlers and Node-only utilities are exported as separate sub-packages for efficient tree-shaking:

| Import Path | Contents |
|---|---|
| `@ruanlopes1350/hermes-client` | Core: `HermesClient`, builders, errors, types, helpers, `MemoryAdapter` |
| `@ruanlopes1350/hermes-client/node` | `EnvAdapter` (requires Node.js - uses `fs`) |
| `@ruanlopes1350/hermes-client/express` | `expressWebhookHandler` |
| `@ruanlopes1350/hermes-client/next` | `nextWebhookHandler` |
| `@ruanlopes1350/hermes-client/fastify` | `fastifyWebhookHandler` |

---

## 📝 Type Reference

### `SendEmailPayload`

```typescript
interface SendEmailPayload {
  recipient_to: string;              // Recipient email address
  subject: string;                   // Email subject
  body?: string;                     // Direct HTML body (alternative to template)
  template_id?: string;              // MJML template ID in Hermes
  variables?: Record<string, any>;   // Template variables
  priority?: 'high' | 'medium' | 'low';
  credential_id?: string;            // Specific SMTP credential to use
  scheduled_at?: string;             // ISO 8601 date for scheduled delivery
}
```

### `HermesResponse`

```typescript
interface HermesResponse<T = any> {
  error: boolean;
  code: number;
  message: string | null;
  data: T;
  errors: any[];
  metadata?: any;
}
```

### `WebhookPayload`

```typescript
interface WebhookPayload {
  serviceId: string;
  credentialId: string;  // ID of the rotated credential
  newApiKey: string;
  rotatedAt: string;     // ISO 8601
  expiresAt: string;     // ISO 8601 - new expiry date
}
```

---

## 📄 License

ISC - [Ruan Lopes](https://github.com/RuanLopes1350)
