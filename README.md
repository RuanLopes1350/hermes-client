# Hermes Client SDK

SDK oficial em Node.js/TypeScript para integrar com o **Hermes - Gateway de E-mails Transacionais**. Este SDK fornece uma interface moderna e encadeada (Builder pattern) para o envio de e-mails, streaming de status em tempo real via SSE, e **rotação automática de API Keys** via Webhooks assinados com HMAC-SHA256.

---

[API Backend](https://github.com/RuanLopes1350/hermes-api) • [Painel Frontend](https://github.com/RuanLopes1350/hermes-front)

---

## 📦 Instalação

```bash
npm install @ruanlopes1350/hermes-client
```

---

## 🚀 Como Usar

### 1. Inicialização

O SDK precisa de um endereço do seu servidor Hermes e de uma estratégia de armazenamento para a chave (Storage Adapter).

```typescript
import { HermesClient, MemoryAdapter } from '@ruanlopes1350/hermes-client';

const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  timeoutMs: 30000,          // Opcional: timeout para os requests (padrão: 30000ms)
  logLevel: 'warn',          // Opcional: 'debug' | 'info' | 'warn' | 'error' | 'silent' (padrão: 'silent')
  storageAdapter: new MemoryAdapter('hm_sua_chave_inicial_aqui'),
  retry: {                   // Opcional: configuração de retry (ou `false` para desabilitar)
    maxAttempts: 3,
    baseDelayMs: 1000,
    backoffFactor: 2,
    maxDelaysMs: 30000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
});
```

> **Nota:** A chave inicial pode ser passada diretamente ao `MemoryAdapter` ou via `initialApiKey` na configuração:
> ```typescript
> const hermes = new HermesClient({
>   baseUrl: 'https://seu-hermes-api.com',
>   initialApiKey: 'hm_sua_chave_inicial_aqui',
> });
> ```
> Quando nenhum `storageAdapter` é fornecido, o SDK cria automaticamente um `MemoryAdapter` usando a `initialApiKey`.

### 2. Enviando E-mails (Builder Pattern — Recomendado)

```typescript
// Com template do Hermes e variáveis dinâmicas
await hermes.email()
  .to('cliente@empresa.com')
  .subject('Bem-vindo ao Sistema!')
  .useTemplate('uuid-do-template', { nome: 'João da Silva' })
  .priority('high')            // Opcional: 'high' | 'medium' | 'low'
  .credential('credencial-id') // Opcional: substitui a credencial padrão da key
  .send();

// Com body HTML direto (sem template)
await hermes.email()
  .to('alerta@empresa.com')
  .subject('Alerta de Segurança')
  .body('<h1>Aviso</h1><p>Houve uma tentativa de login.</p>')
  .send();

// Com envio agendado (aceita Date ou string ISO 8601)
await hermes.email()
  .to('newsletter@empresa.com')
  .subject('Newsletter Mensal')
  .useTemplate('newsletter-tpl', { mes: 'Julho' })
  .schedule(new Date('2026-08-01T09:00:00Z'))
  .send();

// Injetando variáveis separadamente
await hermes.email()
  .to('cliente@empresa.com')
  .subject('Relatório')
  .useTemplate('report-tpl')
  .variables({ periodo: 'Q3 2026', total: 42 })
  .send();
```

> **Retrocompatibilidade:** O método legado `hermes.sendEmail(payload)` ainda é suportado, assim como a propriedade `service_template_id` (que é mapeada automaticamente para `template_id`).

### 3. Enviando E-mails em Bulk

O envio em massa suporta no máximo **100 e-mails por chamada**.

```typescript
// Builder fluido
await hermes.bulk()
  .email()
    .to('alice@example.com')
    .subject('Bem-vinda!')
    .useTemplate('onboarding-tpl', { name: 'Alice' })
    .done()
  .email()
    .to('bob@example.com')
    .subject('Bem-vindo!')
    .useTemplate('onboarding-tpl', { name: 'Bob' })
    .done()
  .send();

// Adicionando payloads diretamente com .add()
const bulkBuilder = hermes.bulk();
bulkBuilder.add({
  recipient_to: 'alice@example.com',
  subject: 'Olá',
  template_id: 'tpl-1',
  variables: { name: 'Alice' },
});
bulkBuilder.add({
  recipient_to: 'bob@example.com',
  subject: 'Olá',
  template_id: 'tpl-1',
  variables: { name: 'Bob' },
});
console.log(`Enviando ${bulkBuilder.count} emails...`);
await bulkBuilder.send();

// Forma direta com array
await hermes.sendBulkEmails([
  { recipient_to: 'alice@example.com', subject: 'Olá', template_id: 'tpl-1', variables: { name: 'Alice' } },
  { recipient_to: 'bob@example.com',   subject: 'Olá', template_id: 'tpl-1', variables: { name: 'Bob' } },
]);
```

### 4. Streaming de Status (SSE)

O SDK oferece streaming em tempo real do status dos e-mails via Server-Sent Events:

```typescript
// Conectar ao stream de status
hermes.stream.onEmailStatus((event) => {
  // event.emailId  — ID do email
  // event.status   — 'pending' | 'sent' | 'failed' | 'retrying'
  // event.timestamp — ISO 8601
  console.log(`Email ${event.emailId}: ${event.status}`);
});

// Desconectar quando não precisar mais
hermes.stream.disconnect();
```

### 5. Health Check

```typescript
const status = await hermes.healthCheck();
console.log(status.status); // "ok"
console.log(status.uptime); // uptime em segundos
```

### 6. Tratamento de Erros Tipados

O SDK expõe uma hierarquia de classes de erro para tratamento granular. Todas estendem `HermesError`:

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
    .subject('Recuperação de Senha')
    .useTemplate('recovery-template', { link: 'https://...' })
    .send();
} catch (err) {
  if (err instanceof HermesValidationError) {
    // Validação local (builder) — a requisição nem foi enviada
    console.error('Campos inválidos:', err.fields);
  } else if (err instanceof HermesRateLimitError) {
    console.warn(`Rate limit atingido. Tente novamente em ${err.retryAfterMs}ms`);
  } else if (err instanceof HermesAuthError) {
    // 401 ou 403
    console.error('API Key inválida ou expirada');
  } else if (err instanceof HermesTimeoutError) {
    console.error('Requisição excedeu o timeout configurado');
  } else if (err instanceof HermesNetworkError) {
    console.error('Problema de conectividade:', err.cause);
  } else if (err instanceof HermesError) {
    // Erro genérico da API
    console.error(`Erro ${err.code} (HTTP ${err.statusCode}):`, err.details);
  }
}
```

| Classe | Código | Quando ocorre |
|---|---|---|
| `HermesValidationError` | `VALIDATION_ERROR` | Validação no builder (ex: `to` ou `subject` ausente) |
| `HermesAuthError` | `AUTH_ERROR` | API retornou 401 ou 403 |
| `HermesRateLimitError` | `RATE_LIMIT` | API retornou 429 |
| `HermesTimeoutError` | `TIMEOUT` | Requisição excedeu `timeoutMs` |
| `HermesNetworkError` | `NETWORK_ERROR` | Falha de DNS, conexão recusada, etc. |
| `HermesError` | `API_ERROR` / `AUTH_MISSING_KEY` / ... | Erros genéricos da API |

> **Retry automático:** O SDK retenta automaticamente em status codes configuráveis (padrão: 408, 429, 500, 502, 503, 504) com backoff exponencial + jitter. Erros com `statusCode` definido que não estão na lista de retryable **não** são retentados. Configure via `retry` em `HermesClientConfig` ou use `retry: false` para desabilitar.

### 7. Helpers para Templates

```typescript
import { templateHelpers } from '@ruanlopes1350/hermes-client';

await hermes.email()
  .to('cliente@x.com')
  .subject('Pedido confirmado')
  .useTemplate('order-confirmation', {
    greeting:  templateHelpers.greeting('João'),         // "Boa tarde, João"
    orderDate: templateHelpers.formatDate(new Date()),   // "20 de maio de 2026"
    total:     templateHelpers.formatCurrency(149.90),   // "R$ 149,90"
  })
  .send();
```

Os helpers aceitam parâmetros de localidade:

```typescript
templateHelpers.formatDate(new Date(), 'en-US');           // "May 20, 2026"
templateHelpers.formatCurrency(149.90, 'USD', 'en-US');    // "$149.90"
```

---

## 🔄 Rotação Automática de Chaves (Webhooks)

O Hermes enviará um Webhook assinado com **HMAC-SHA256** sempre que uma API Key estiver prestes a expirar. O payload contém a nova chave, o ID do serviço e o timestamp da rotação. O SDK oferece **middlewares plug-and-play** para os principais frameworks:

### Express.js

```typescript
import express from 'express';
import { expressWebhookHandler } from '@ruanlopes1350/hermes-client/express';

const app = express();

// IMPORTANTE: use express.raw() para que a assinatura HMAC seja validada corretamente
app.post(
  '/webhook/hermes',
  express.raw({ type: 'application/json' }),
  expressWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!),
);
```

### Next.js (App Router)

Crie `app/api/webhook/hermes/route.ts`:

```typescript
import { nextWebhookHandler } from '@ruanlopes1350/hermes-client/next';
import { hermes } from '@/lib/hermes'; // a instância criada anteriormente

export const POST = nextWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!);
```

> O handler do Next.js usa a Web API `Request`/`Response`, sendo compatível com Edge Runtime.

### Fastify

```typescript
import fastify from 'fastify';
import rawBody from 'fastify-raw-body';
import { fastifyWebhookHandler } from '@ruanlopes1350/hermes-client/fastify';

const app = fastify();

// IMPORTANTE: O plugin fastify-raw-body é obrigatório para validação HMAC
await app.register(rawBody);

app.post(
  '/webhook/hermes',
  fastifyWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!),
);
```

### Uso Manual do Webhook

Para frameworks não suportados, use os utilitários diretamente:

```typescript
import { verifyHermesSignature, parseWebhookPayload } from '@ruanlopes1350/hermes-client';

// 1. Apenas validar a assinatura
const isValid = await verifyHermesSignature(rawBody, signature, secret);

// 2. Validar e extrair o payload tipado (retorna null se inválido)
const payload = await parseWebhookPayload(rawBody, signature, secret);
// payload: { serviceId: string, newApiKey: string, rotatedAt: string } | null

// 3. Atualizar a chave no client
if (payload) {
  await hermes.updateApiKey(payload.newApiKey);
}
```

O cabeçalho de assinatura é enviado como `x-hermes-signature`.

---

## 📡 Eventos (Ciclo de Vida)

O `HermesClient` estende `LiteEventEmitter`, um emissor de eventos leve e 100% compatível com Edge Runtimes:

```typescript
hermes.on('keyRotated', (newKey, oldKey) => {
  console.log('✅ Chave rotacionada!', { de: oldKey, para: newKey });
});

hermes.on('error', (err) => {
  console.error('❌ Erro no cliente Hermes:', err);
});

hermes.on('retry', (attempt, error, delayMs) => {
  console.warn(`⏳ Tentativa ${attempt} falhou. Retentando em ${delayMs}ms...`);
});

// Ouvir apenas uma vez
hermes.once('keyRotated', (newKey) => {
  console.log('Primeira rotação:', newKey);
});

// Remover listener
const handler = (err: Error) => console.error(err);
hermes.on('error', handler);
hermes.off('error', handler);
```

| Evento | Callback | Quando emitido |
|---|---|---|
| `keyRotated` | `(newKey: string, oldKey: string \| null) => void` | Chave foi rotacionada via webhook ou `updateApiKey()` |
| `error` | `(error: Error) => void` | Qualquer erro no envio, webhook ou stream |
| `retry` | `(attempt: number, error: Error, delayMs: number) => void` | Uma tentativa falhou e o retry foi agendado |

---

## 🛠️ Storage Adapters

Quando a chave muda (via webhook ou manualmente), o SDK atualiza a chave via o Storage Adapter configurado.

### `MemoryAdapter` (padrão)
Guarda a chave na RAM da instância. Simples e ideal para testes rápidos.

```typescript
import { HermesClient, MemoryAdapter } from '@ruanlopes1350/hermes-client';

const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  storageAdapter: new MemoryAdapter('hm_chave_inicial'),
});
```

> **Atenção:** Em ambientes com múltiplas instâncias (load balancers), a `MemoryAdapter` não propaga a nova chave entre processos. Use `EnvAdapter` ou um adapter customizado (ex: `RedisAdapter`).

### `EnvAdapter`
Lê e escreve a chave diretamente em um arquivo `.env` físico **e** em `process.env`. Ideal para servidores VPS/Bare Metal. Importado via sub-pacote `/node`:

```typescript
import { HermesClient } from '@ruanlopes1350/hermes-client';
import { EnvAdapter } from '@ruanlopes1350/hermes-client/node';

const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  // Procura a variável HERMES_API_KEY no arquivo .env da raiz do projeto
  storageAdapter: new EnvAdapter('.env', 'HERMES_API_KEY'),
});
```

> O `EnvAdapter` usa `fs` síncrono e `process.env`, sendo exclusivo para ambientes Node.js. Ele também faz fallback para `process.env` caso a aplicação (Next.js, etc.) já tenha carregado as variáveis.

### Adapter Customizado (ex: Redis — para multi-instância)

Implemente a interface `StorageAdapter`:

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
  baseUrl: 'https://seu-hermes-api.com',
  storageAdapter: new RedisAdapter(),
});
```

> A interface `StorageAdapter` aceita retornos síncronos ou assíncronos (`string | null | Promise<string | null>` e `void | Promise<void>`).

---

## ⚙️ Configuração de Retry

O retry é configurável por request e usa **backoff exponencial com jitter (±25%)**:

```typescript
const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  initialApiKey: 'hm_...',
  retry: {
    maxAttempts: 5,                                    // Padrão: 3
    baseDelayMs: 2000,                                 // Padrão: 1000ms
    backoffFactor: 2,                                  // Padrão: 2
    maxDelaysMs: 60000,                                // Padrão: 30000ms
    retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Padrão
  },
});

// Ou desabilitar completamente:
const hermes2 = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  initialApiKey: 'hm_...',
  retry: false,
});
```

Erros com `statusCode` definido que **não** estão na lista `retryableStatusCodes` (ex: 401, 403) **nunca** são retentados.

---

## 📦 Build e Distribuição

O SDK é construído com **tsup** e distribuído em formato dual:

| Formato | Arquivo |
|---|---|
| ESM | `dist/index.mjs` |
| CJS | `dist/index.js` |
| Types | `dist/index.d.ts` |
| Source Maps | `dist/index.js.map` / `dist/index.mjs.map` |

### Sub-pacotes (Exports Map)

Handlers de webhook e utilitários Node-only são exportados como sub-pacotes separados para tree-shaking eficiente:

| Import Path | Conteúdo |
|---|---|
| `@ruanlopes1350/hermes-client` | Core: `HermesClient`, builders, erros, tipos, helpers, storage (Memory) |
| `@ruanlopes1350/hermes-client/node` | `EnvAdapter` (requer Node.js — usa `fs`) |
| `@ruanlopes1350/hermes-client/express` | `expressWebhookHandler` |
| `@ruanlopes1350/hermes-client/next` | `nextWebhookHandler` |
| `@ruanlopes1350/hermes-client/fastify` | `fastifyWebhookHandler` |

---

## 📝 Referência de Tipos

### `SendEmailPayload`

```typescript
interface SendEmailPayload {
  recipient_to: string;        // Destinatário
  subject: string;             // Assunto
  body?: string;               // HTML direto (alternativa a template)
  template_id?: string;        // ID do template MJML no Hermes
  variables?: Record<string, any>;  // Variáveis para o template
  priority?: 'high' | 'medium' | 'low';
  credential_id?: string;     // Credencial SMTP específica
  scheduled_at?: string;      // Data ISO 8601 para envio agendado
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
  newApiKey: string;
  rotatedAt: string;
}
```

---

## 📄 Licença
ISC — Ruan Lopes
