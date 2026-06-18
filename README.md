# Hermes Client SDK

SDK oficial em Node.js/TypeScript para integrar com o **Hermes - Gateway de E-mails Transacionais**. Este SDK simplifica o envio de e-mails e a **gestão automática de rotação de API Keys** usando Webhooks.

## 📦 Instalação

```bash
npm install hermes-client
```

## 🚀 Como Funciona

O Hermes possui um recurso nativo de **Rotação de Chaves** onde envia um Webhook para a sua aplicação pouco antes de uma chave expirar. Este SDK abstrai a complexidade desse fluxo: ele recebe o Webhook validando a criptografia e já armazena a nova chave no seu ambiente.

---

## 📖 Como Usar

### 1. Inicializando o Cliente de Envio

Você pode configurar o Hermes para buscar a chave na sua memória atual ou ler dinamicamente de arquivos `.env`.

```typescript
import { HermesClient, EnvAdapter } from 'hermes-client';

const hermes = new HermesClient({
  baseUrl: 'https://seu-hermes-api.com', // URL do seu servidor Hermes
  
  // Opcional: Se quiser que ele se atualize automaticamente num arquivo .env local:
  storageAdapter: new EnvAdapter('.env', 'HERMES_API_KEY') 
});

// Envio de E-mail Transacional
await hermes.sendEmail({
  recipient_to: 'usuario@exemplo.com',
  subject: 'Bem-vindo ao Sistema',
  service_template_id: 'tmpl_xxxxxxxx',
  variables: {
    nome: 'John Doe',
    link: 'https://app.com/ativar'
  }
});
```

### 2. Tratando o Webhook de Rotação de Chave

Quando sua API Key for expirar, o Hermes chamará o seu servidor. Com este SDK, é seguro e fácil tratar esse payload.

**Exemplo no Express.js:**

```typescript
import express from 'express';
import { parseWebhookPayload, EnvAdapter } from 'hermes-client';

const app = express();
const adapter = new EnvAdapter('.env', 'HERMES_API_KEY');

// IMPORTANTE: Para o Webhook criptografado funcionar, você deve pegar o body no formato bruto (RAW)
app.post('/webhooks/hermes', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hermes-signature'];
  const webhookSecret = process.env.HERMES_WEBHOOK_SECRET;

  // Valida e extrai o payload com segurança (validação HMAC SHA-256 embutida)
  const payload = parseWebhookPayload(req.body.toString(), signature as string, webhookSecret);

  if (!payload) {
    return res.status(401).send('Assinatura inválida! Possível tentativa de fraude.');
  }

  // Se for válido, atualize a chave usando o Adapter!
  console.log(`Nova chave recebida para o serviço ${payload.serviceId}`);
  adapter.setApiKey(payload.newApiKey);

  res.status(200).send('Chave rotacionada com sucesso!');
});
```

## 🛠️ Adapters Disponíveis

* **`MemoryAdapter`**: Guarda a chave na RAM da instância que está rodando. Se o servidor for reiniciado, a chave é perdida (usada principalmente para testes).
* **`EnvAdapter`**: Lê e escreve a chave dinamicamente em um arquivo `.env` físico. Ideal para rodar em *Bare Metal* ou servidores VPS tradicionais sem que você precise abrir o `.env` e alterar na mão.

> Você pode criar o seu próprio adapter (ex: AWS Secrets Manager, Vercel ou Redis) implementando a interface \`StorageAdapter\`!

## 📄 Licença

ISC
