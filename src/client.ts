import { HermesClientConfig, SendEmailPayload } from './types';
import { MemoryAdapter } from './storage/MemoryAdapter';
import { LiteEventEmitter } from './emitter';
import { EmailBuilder } from './builder';

export class HermesClient extends LiteEventEmitter {
	private config: HermesClientConfig;

	constructor(config: HermesClientConfig) {
		super();
		this.config = {
			...config,
			storageAdapter: config.storageAdapter || new MemoryAdapter(config.initialApiKey),
		};
	}

	// Cria um novo EmailBuilder usando o padrão fluído.
	email(): EmailBuilder {
		return new EmailBuilder(this);
	}

	// Dispara o envio de um e-mail.
	// Utiliza a chave armazenada mais recente para evitar bloqueios por expiração.
	async sendEmail(payload: SendEmailPayload) {
		const apiKey = await this.config.storageAdapter?.getApiKey();

		if (!apiKey) {
			const err = new Error(
				'HermesClient: API Key is missing. Please provide it via StorageAdapter or initialApiKey.',
			);
			this.emit('error', err);
			throw err;
		}

		// Backward compatibility fallback for users passing the old property
		if (payload.service_template_id && !payload.template_id) {
			payload.template_id = payload.service_template_id;
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
			const err = new Error(
				`Hermes API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
			);
			this.emit('error', err);
			throw err;
		}

		return response.json();
	}

	// Permite atualizar a chave diretamente em tempo de execução
	async updateApiKey(newKey: string) {
		if (this.config.storageAdapter) {
			const oldKey = await this.config.storageAdapter.getApiKey();
			await this.config.storageAdapter.setApiKey(newKey);
			this.emit('keyRotated', newKey, oldKey);
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
