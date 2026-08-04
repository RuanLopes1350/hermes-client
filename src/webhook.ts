import type { WebhookPayload } from './types';

/**
 * Valida a assinatura de um Webhook recebido do Hermes
 * Funciona em Edge runtimes utilizando a Web Crypto API
 * @param rawBody - O corpo da requisição exatamente como recebido (Uint8Array ou string pura)
 * @param signature - O cabeçalho 'x-hermes-signature'
 * @param secret - A senha secreta do webhook configurada no painel do Hermes
 */
export async function verifyHermesSignature(
	rawBody: string | Uint8Array,
	signature: string,
	secret: string,
): Promise<boolean> {
	if (!signature || !secret || !rawBody) return false;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const data = typeof rawBody === 'string' ? encoder.encode(rawBody) : rawBody;
	const signatureBytes = await crypto.subtle.sign('HMAC', key, data as any);
	
	const computedHex = Array.from(new Uint8Array(signatureBytes))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');

	// Comparação timing-safe básica
	if (computedHex.length !== signature.length) return false;
	let isEqual = true;
	for (let i = 0; i < computedHex.length; i++) {
		if (computedHex[i] !== signature[i]) isEqual = false;
	}
	return isEqual;
}

// Utilitário completo para extrair o payload validado. Retorna null se for fraudulento.
export async function parseWebhookPayload(
	rawBody: string | Uint8Array,
	signature: string,
	secret: string,
): Promise<WebhookPayload | null> {
	if (!(await verifyHermesSignature(rawBody, signature, secret))) {
		return null;
	}
	const bodyStr = typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody);
	return JSON.parse(bodyStr) as WebhookPayload;
}
