import { HermesClientConfig, SendEmailPayload } from './types';
import { MemoryAdapter } from './storage/MemoryAdapter';

export class HermesClient {
	private config: HermesClientConfig;

	constructor(config: HermesClientConfig) {
		this.config = {
			...config,
			storageAdapter: config.storageAdapter || new MemoryAdapter(config.initialApiKey),
		};
	}

	// Dispara o envio de um e-mail.
	// Utiliza a chave armazenada mais recente para evitar bloqueios por expiração.
	async sendEmail(payload: SendEmailPayload) {
		const apiKey = await this.config.storageAdapter?.getApiKey();

		if (!apiKey) {
			throw new Error(
				'HermesClient: API Key is missing. Please provide it via StorageAdapter or initialApiKey.',
			);
		}

		const url = `${this.config.baseUrl}/api/emails`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => null);
			throw new Error(
				`Hermes API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
			);
		}

		return response.json();
	}

	// Permite atualizar a chave diretamente em tempo de execução
	async updateApiKey(newKey: string) {
		if (this.config.storageAdapter) {
			await this.config.storageAdapter.setApiKey(newKey);
		}
	}

	// Facilita o processamento de um webhook recebido
	async processWebhookPayload(payload: any) {
		if (payload && payload.newApiKey) {
			await this.updateApiKey(payload.newApiKey);
			return true;
		}
		return false;
	}
}
