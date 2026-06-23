import { HermesClient } from '../client';
import { parseWebhookPayload } from '../webhook';

// Route Handler para Next.js (App Router).
// Exemplo em `app/api/webhook/hermes/route.ts`:
// export const POST = nextWebhookHandler(hermes, 'SECRET');

export function nextWebhookHandler(client: HermesClient, secret: string) {
	return async (req: Request) => {
		try {
			const signature = req.headers.get('x-hermes-signature');

			if (!signature) {
				return new Response(JSON.stringify({ error: 'Assinatura ausente.' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Pega o raw body como string para validar o HMAC
			const rawBody = await req.text();

			const payload = parseWebhookPayload(rawBody, signature, secret);

			if (!payload) {
				return new Response(JSON.stringify({ error: 'Assinatura inválida.' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const processed = await client.processWebhookPayload(payload);

			if (processed) {
				return new Response(
					JSON.stringify({ success: true, message: 'Chave atualizada com sucesso.' }),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					},
				);
			}

			return new Response(JSON.stringify({ error: 'Payload não processado.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			client.emit('error', error);
			return new Response(JSON.stringify({ error: 'Erro interno ao processar webhook.' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	};
}
