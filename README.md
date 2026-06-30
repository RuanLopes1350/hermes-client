# Hermes Client SDK

SDK oficial em Node.js/TypeScript para integrar com o **Hermes - Gateway de E-mails Transacionais**. Este SDK fornece uma interface moderna e encadeada (fluida) para o envio de e-mails, além de gerenciar **automaticamente a rotação de API Keys** em tempo real usando Webhooks.

## 📦 Instalação

```bash
npm install @ruanlopes1350/hermes-client
```

---

## 🚀 Como Usar

### 1. Inicialização Básica
O SDK precisa de um endereço do seu servidor Hermes e de uma estratégia de armazenamento para a chave (Storage Adapter).

```typescript
import { HermesClient, MemoryAdapter } from '@ruanlopes1350/hermes-client';

const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  timeoutMs: 30000, // <-- Opcional: timeout para os requests (padrão é 30000ms)
  logLevel: 'warn', // <-- Opcional: níveis possíveis: 'debug', 'info', 'warn', 'error', 'silent' (padrão)
  // O MemoryAdapter é usado por padrão, mas você pode usar o seu próprio (ex: RedisAdapter)
  storageAdapter: new MemoryAdapter('sk_live_sua_chave_inicial_aqui')
});
```

### 2. Enviando E-mails (Padrão Fluido - Recomendado)
A nova versão do SDK introduz o *Email Builder*, que oferece autocomplete avançado e encadeamento de métodos para uma experiência de desenvolvimento (DX) impecável.

```typescript
// Exemplo com Template do Hermes
await hermes.email()
  .to('cliente@empresa.com')
  .subject('Bem-vindo ao Sistema!')
  .useTemplate('1234-uuid-do-template', { nome: 'João da Silva' })
  .priority('high') // <-- Opcional
  .credential('minha-credencial-id') // <-- Opcional
  .send();

// Exemplo com envio de HTML direto
await hermes.email()
  .to('alerta@empresa.com')
  .subject('Alerta de Segurança')
  .body('<h1>Aviso</h1><p>Houve uma tentativa de login.</p>')
  .send();
```

*(Nota: O método legado `hermes.sendEmail(payload)` ainda é suportado para garantir retrocompatibilidade com aplicações já integradas).*

### 3. Enviando E-mails em Bulk
Para o envio de múltiplos e-mails em uma mesma chamada.
```typescript
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
  { recipient_to: 'bob@example.com', subject: 'Olá', template_id: 'tpl-1', variables: { name: 'Bob' } },
]);
```

### 4. Verificando o Health Check
Para aplicações que necessitam validar se a infraestrutura está online antes de processar filas, o SDK disponibiliza um método direto de ping para a API:
```typescript
const isHermesOk = await hermes.healthCheck();
console.log(isHermesOk.status); // "ok"
```

### 5. Tratamento de Erros e Retentativas Automáticas
O Hermes SDK possui suporte inteligente para retry automático (Backoff Exponencial) e expõe classes de erros tipadas. Dessa forma, você pode diferenciar os cenários e aplicar lógicas exclusivas.

```typescript
import { HermesRateLimitError, HermesAuthError, HermesNetworkError } from '@ruanlopes1350/hermes-client';

try {
  await hermes.email()
    .to('user@example.com')
    .subject('Recuperação de Senha')
    .useTemplate('recovery-template', { link: '...' })
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
**Nota:** Por padrão, o SDK irá tentar realizar *retry* caso a API retorne erros de indisponibilidade (502, 503, 504) ou Rate Limit. Isso pode ser configurado via `retry` em `HermesClientConfig`.

---

## 🔄 Rotação Automática de Chaves (Webhooks)

O Hermes enviará um Webhook contendo uma nova API Key sempre que a chave atual estiver prestes a expirar. O SDK oferece **middlewares plug-and-play** para tratar esse webhook e validar criptografia HMAC automaticamente, sem dor de cabeça.

### Opção A: Usando com Express.js
Basta importar o handler oficial para Express.

```typescript
import express from 'express';
import { expressWebhookHandler } from '@ruanlopes1350/hermes-client/express';

const app = express();

// IMPORTANTE: O Express precisa ler o body cru (raw) para a assinatura HMAC funcionar.
app.post(
  '/webhook/hermes', 
  express.raw({ type: 'application/json' }), 
  expressWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET)
);
```

### Opção B: Usando com Next.js (App Router)
Crie um arquivo em `app/api/webhook/hermes/route.ts`:

```typescript
import { nextWebhookHandler } from '@ruanlopes1350/hermes-client/next';
import { hermes } from '@/lib/hermes'; // A instância que você criou no passo 1

export const POST = nextWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!);
```

### Opção C: Usando com Fastify
Importe o handler oficial para Fastify (lembre-se de configurar a leitura de body cru / `rawBody` no seu framework caso necessário).

```typescript
import fastify from 'fastify';
import { fastifyWebhookHandler } from '@ruanlopes1350/hermes-client/fastify';

const app = fastify();

app.post(
  '/webhook/hermes', 
  fastifyWebhookHandler(hermes, process.env.HERMES_WEBHOOK_SECRET!)
);
```

---

## 📡 Eventos (Ciclo de Vida)

O `HermesClient` é um emissor de eventos (*Lightweight Event Emitter* 100% compatível com Edge Runtimes). Você pode escutar eventos cruciais da aplicação, como a rotação de chaves ou erros do webhook.

```typescript
hermes.on('keyRotated', (newKey, oldKey) => {
  console.log('✅ A chave foi rotacionada magicamente pelo webhook!');
});

hermes.on('error', (err) => {
  console.error('❌ Ocorreu um erro no cliente Hermes:', err);
});
```

---

## 🛠️ Storage Adapters (Armazenando a Chave)

Quando o webhook chega e a chave muda, onde o SDK guarda essa nova chave?
Para isso servem os *Adapters*:

* **`MemoryAdapter` (Padrão)**: Guarda a chave na RAM da instância que está rodando. Se o servidor for reiniciado e houver Load Balancing, outras instâncias não saberão da chave nova. Ideal para testes rápidos.
* **`EnvAdapter`**: Lê e escreve a chave dinamicamente em um arquivo `.env` físico. Ideal para rodar em *Bare Metal* ou servidores VPS tradicionais sem que você precise abrir o `.env` e alterar na mão!

```typescript
import { HermesClient, EnvAdapter } from '@ruanlopes1350/hermes-client';

const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com',
  // Ele vai procurar a variável HERMES_API_KEY no arquivo .env
  storageAdapter: new EnvAdapter('.env', 'HERMES_API_KEY') 
});
```

* **Crie o seu Próprio**: Para aplicações Serverless/Vercel ou Load-Balancers, é vital compartilhar a chave entre todas as instâncias. Você pode criar facilmente um adaptador usando Redis.

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

// Inicialize o Hermes com seu adaptador:
const hermes = new HermesClient({ baseUrl: '...', storageAdapter: new RedisAdapter() });
```

---

## 📄 Licença
ISC
