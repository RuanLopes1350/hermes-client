import * as crypto from 'crypto';
import type { WebhookPayload } from './types';

/**
 * Valida a assinatura de um Webhook recebido do Hermes
 * @param rawBody - O corpo da requisição exatamente como recebido (string pura para garantir o HMAC)
 * @param signature - O cabeçalho 'x-hermes-signature'
 * @param secret - A senha secreta do webhook configurada no painel do Hermes
 */
export function verifyHermesSignature(
	rawBody: string | Buffer,
	signature: string,
	secret: string,
): boolean {
	if (!signature || !secret || !rawBody) return false;

	const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

	return signature === expectedSignature;
}

// Utilitário completo para extrair o payload validado. Retorna null se for fraudulento.
export function parseWebhookPayload(
	rawBody: string,
	signature: string,
	secret: string,
): WebhookPayload | null {
	if (!verifyHermesSignature(rawBody, signature, secret)) {
		return null;
	}
	return JSON.parse(rawBody.toString()) as WebhookPayload;
}
