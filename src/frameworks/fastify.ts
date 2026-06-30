import type { HermesClient } from '../client';
import { parseWebhookPayload } from '../webhook';

export function fastifyWebhookHandler(client: HermesClient, secret: string) {
	return async function handler(request: any, reply: any) {
		try {
			const signature = request.headers['x-hermes-signature'];
			if (!signature) {
				return reply.status(401).send({ error: 'Assinatura ausente.' });
			}

			// Fastify com rawBody habilitado
			const rawBody =
				typeof request.body === 'string'
					? request.body
					: JSON.stringify(request.body);

			const payload = parseWebhookPayload(rawBody, signature, secret);
			if (!payload) {
				return reply.status(401).send({ error: 'Assinatura inválida.' });
			}

			const processed = await client.processWebhookPayload(payload);
			if (!processed) {
				return reply.status(400).send({ error: 'Payload não processado.' });
			}

			return reply.status(200).send({ success: true });
		} catch (err: any) {
			client.emit('error', err);
			return reply.status(500).send({ error: 'Erro interno.' });
		}
	};
}
