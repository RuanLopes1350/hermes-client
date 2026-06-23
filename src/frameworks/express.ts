import { HermesClient } from '../client';
import { parseWebhookPayload } from '../webhook';

// Middleware para Express.js que processa o Webhook do Hermes automaticamente.
// IMPORTANTE: Você DEVE usar `express.raw({ type: 'application/json' })`
// nesta rota para que a assinatura HMAC seja validada corretamente.

// Exemplo:
// app.post('/webhook/hermes', express.raw({ type: 'application/json' }), expressWebhookHandler(hermes, 'SECRET'));

export function expressWebhookHandler(client: HermesClient, secret: string) {
	return async (req: any, res: any) => {
		try {
			const signature = req.headers['x-hermes-signature'];

			if (!signature) {
				return res.status(401).json({ error: 'Assinatura ausente.' });
			}

			// O raw body deve ser um Buffer (via express.raw) ou string.
			const rawBody = req.body;

			if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') {
				return res.status(400).json({
					error:
						'Corpo da requisição inválido. Certifique-se de usar express.raw({ type: "application/json" })',
				});
			}

			const payload = parseWebhookPayload(rawBody.toString('utf-8'), signature, secret);

			if (!payload) {
				return res.status(401).json({ error: 'Assinatura inválida.' });
			}

			const processed = await client.processWebhookPayload(payload);

			if (processed) {
				return res.status(200).json({ success: true, message: 'Chave atualizada com sucesso.' });
			}

			return res.status(400).json({ error: 'Payload não processado.' });
		} catch (error: any) {
			client.emit('error', error);
			return res.status(500).json({ error: 'Erro interno ao processar webhook.' });
		}
	};
}
