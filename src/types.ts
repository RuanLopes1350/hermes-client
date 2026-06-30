import { RetryConfig } from './retry';

export interface HermesClientConfig {
	// URL do seu servidor Hermes. Exemplo: https://hermes.example.com
	baseUrl: string;
	// Chave de API inicial para autenticação. Se não fornecida, o cliente tentará recuperar a chave de API do adaptador de armazenamento.
	initialApiKey?: string;
	// Adaptador de armazenamento para persistir a chave de API. Se não fornecido, o cliente tentará recuperar a chave de API do adaptador de armazenamento.
	storageAdapter?: StorageAdapter;
	// Configurações de retry para requisições HTTP. Se definido como `false`, desativa o retry.
	retry?: Partial<RetryConfig> | false;
	// Timeout em milissegundos para requisições HTTP. Se não fornecido, o valor padrão (30000ms) será usado.
	timeoutMs?: number;
}

export interface StorageAdapter {
	getApiKey(): string | null | Promise<string | null>;
	setApiKey(key: string): void | Promise<void>;
}

export type EmailPriority = 'high' | 'medium' | 'low';

export interface SendEmailPayload {
	recipient_to: string;
	subject: string;

	/**
	 * @deprecated Use `template_id` instead.
	 */
	service_template_id?: string;

	template_id?: string;
	body?: string;
	credential_id?: string;
	scheduled_at?: string;
	variables?: Record<string, any>;
	priority?: EmailPriority;
}

export interface WebhookPayload {
	serviceId: string;
	newApiKey: string;
	rotatedAt: string;
}
