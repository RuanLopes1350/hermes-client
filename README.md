# Hermes Client SDK

SDK oficial em Node.js/TypeScript para integrar com o **Hermes - Gateway de E-mails Transacionais**. Este SDK fornece uma interface moderna e encadeada (Builder pattern) para o envio de e-mails, além de gerenciar **automaticamente a rotação de API Keys** em tempo real usando Webhooks assinados com HMAC-SHA256.

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
  logLevel: 'warn',          // Opcional: 'debug' | 'info' | 'warn' | 'error' | 'silent' (padrão)
  storageAdapter: new MemoryAdapter('hm_sua_chave_inicial_aqui'),
});
```

> **Nota:** A chave inicial pode ser passada diretamente ao `MemoryAdapter` ou via `initialApiKey` na configuração:
> ```typescript
> const hermes = new HermesClient({
>   baseUrl: 'https://seu-hermes-api.com',
>   initialApiKey: 'hm_sua_chave_inicial_aqui',
> });
> ```

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

// Com envio agendado
await hermes.email()
  .to('newsletter@empresa.com')
  .subject('Newsletter Mensal')
  .useTemplate('newsletter-tpl', { mes: 'Julho' })
  .schedule(new Date('2026-08-01T09:00:00Z'))
  .send();
```

> **Retrocompatibilidade:** O método legado `hermes.sendEmail(payload)` ainda é suportado.

### 3. Enviando E-mails em Bulk

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

// Forma direta com array
await hermes.sendBulkEmails([
  { recipient_to: 'alice@example.com', subject: 'Olá', template_id: 'tpl-1', variables: { name: 'Alice' } },
  { recipient_to: 'bob@example.com',   subject: 'Olá', template_id: 'tpl-1', variables: { name: 'Bob' } },
]);
```

### 4. Health Check

```typescript
const status = await hermes.healthCheck();
console.log(status.status); // "ok"
```

### 5. Tratamento de Erros Tipados

O SDK expõe classes de erro específicas para tratamento granular:

```typescript
import { HermesRateLimitError, HermesAuthError, HermesNetworkError } from '@ruanlopes1350/hermes-client';

try {
  await hermes.email()
    .to('user@example.com')
    .subject('Recuperação de Senha')
    .useTemplate('recovery-template', { link: 'https://...' })
    .send();
} catch (err) {
  if (err instanceof HermesRateLimitError) {
    console.warn(`Rate limit atingido. Tente novamente em ${err.retryAfterMs}ms`);
  } else if (err instanceof HermesAuthError) {
    console.error('API Key inválida ou expirada');
  } else if (err instanceof HermesNetworkError) {
    console.error('Problema de conectividade ao chamar a API');
  }
}
```

> **Retry automático:** O SDK retenta automaticamente em erros de indisponibilidade (502, 503, 504) e Rate Limit com backoff exponencial. Configure via `retry` em `HermesClientConfig`.

### 6. Helpers para Templates

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

---

## 🔄 Rotação Automática de Chaves (Webhooks)

O Hermes enviará um Webhook assinado com **HMAC-SHA256** sempre que uma API Key estiver prestes a expirar, contendo a nova chave. O SDK oferece **middlewares plug-and-play** para os principais frameworks:

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

### Fastify

```typescript
import fastify from 'fastify';
import { fastifyWebhookHandler } from '@ruanlopes1350/hermes-client/fastify';

const app = fastify();

app.post(
  '/webhook/hermes',
  fastifyWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!),
);
```

---

## 📡 Eventos (Ciclo de Vida)

O `HermesClient` é um emissor de eventos leve, 100% compatível com Edge Runtimes:

```typescript
hermes.on('keyRotated', (newKey, oldKey) => {
  console.log('✅ Chave rotacionada automaticamente pelo Hermes!');
});

hermes.on('error', (err) => {
  console.error('❌ Erro no cliente Hermes:', err);
});
```

---

## 🛠️ Storage Adapters

Quando o webhook chega e a chave muda, o SDK atualiza a chave via o Storage Adapter configurado:

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
Lê e escreve a chave diretamente em um arquivo `.env` físico. Ideal para servidores VPS/Bare Metal.

```typescript
import { HermesClient, EnvAdapter } from '@ruanlopes1350/hermes-client';

const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  // Procura a variável HERMES_API_KEY no arquivo .env da raiz do projeto
  storageAdapter: new EnvAdapter('.env', 'HERMES_API_KEY'),
});
```

### Adapter Customizado (ex: Redis — para multi-instância)

```typescript
import { StorageAdapter, HermesClient } from '@ruanlopes1350/hermes-client';
import redis from './redis-client';

export class RedisAdapter implements StorageAdapter {
  async getApiKey() {
    return await redis.get('hermes_api_key');
  }

  async setApiKey(key: string) {
    await redis.set('hermes_api_key', key);
  }
}

const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  storageAdapter: new RedisAdapter(),
});
```

---

## 📦 Build e Distribuição

O SDK é construído com **tsup** e distribuído em formato dual:

| Formato | Arquivo |
|---|---|
| ESM | `dist/index.mjs` |
| CJS | `dist/index.js` |
| Types | `dist/index.d.ts` |

Handlers de webhook são exportados como sub-pacotes separados (`/express`, `/next`, `/fastify`) para tree-shaking eficiente.

---

## 📄 Licença
ISC — Ruan Lopes
