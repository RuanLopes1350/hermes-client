export interface HermesClientConfig {
	baseUrl: string;
	initialApiKey?: string;
	storageAdapter?: StorageAdapter;
}

export interface StorageAdapter {
	getApiKey(): string | null | Promise<string | null>;
	setApiKey(key: string): void | Promise<void>;
}

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
}

export interface WebhookPayload {
	serviceId: string;
	newApiKey: string;
	rotatedAt: string;
}
