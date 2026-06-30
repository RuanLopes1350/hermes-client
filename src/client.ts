import { HermesClientConfig, SendEmailPayload } from './types';
import { MemoryAdapter } from './storage/MemoryAdapter';
import { LiteEventEmitter } from './emitter';
import { EmailBuilder } from './builder';
import { BulkEmailBuilder } from './bulkEmailBuilder';
import { withRetry, DEFAULT_RETRY_CONFIG, RetryConfig } from './retry';
import {
	HermesError,
	HermesAuthError,
	HermesRateLimitError,
	HermesNetworkError,
	HermesTimeoutError,
} from './errors';
import { HermesLogger } from './logger';

export class HermesClient extends LiteEventEmitter {
	public logger: HermesLogger;
	private config: HermesClientConfig;

	constructor(config: HermesClientConfig) {
		super();
		this.config = {
			...config,
			storageAdapter: config.storageAdapter || new MemoryAdapter(config.initialApiKey),
		};
		this.logger = new HermesLogger(config.logLevel);
		this.logger.debug('HermesClient initialized');
	}

	// Cria um novo EmailBuilder usando o padrão fluído.
	email(): EmailBuilder {
		return new EmailBuilder(this);
	}

	// Cria um novo BulkEmailBuilder para envio em massa.
	bulk(): BulkEmailBuilder {
		return new BulkEmailBuilder(this);
	}

	private async parseErrorResponse(response: Response): Promise<Error> {
		const errorData = await response.json().catch(() => null);
		const message = errorData?.message || errorData?.error || response.statusText;

		if (response.status === 401 || response.status === 403) {
			return new HermesAuthError(message, response.status);
		}
		if (response.status === 429) {
			const retryAfter = response.headers.get('retry-after');
			const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
			return new HermesRateLimitError(message, retryAfterMs);
		}

		return new HermesError(
			`Hermes API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
			'API_ERROR',
			response.status,
			errorData
		);
	}

	// Dispara o envio de um e-mail.
	// Utiliza a chave armazenada mais recente para evitar bloqueios por expiração.
	async sendEmail(payload: SendEmailPayload) {
		const apiKey = await this.config.storageAdapter?.getApiKey();

		if (!apiKey) {
			const err = new HermesError(
				'HermesClient: API Key is missing. Please provide it via StorageAdapter or initialApiKey.',
				'AUTH_MISSING_KEY'
			);
			this.emit('error', err);
			throw err;
		}

		// Backward compatibility fallback for users passing the old property
		if (payload.service_template_id && !payload.template_id) {
			payload.template_id = payload.service_template_id;
		}

		const url = `${this.config.baseUrl}/api/emails`;

		const fn = async () => {
			const timeoutMs = this.config.timeoutMs ?? 30000;
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': apiKey,
					},
					body: JSON.stringify(payload),
					signal: controller.signal,
				});

				if (!response.ok) {
					throw await this.parseErrorResponse(response);
				}

				return response.json();
			} catch (err: any) {
				if (err.name === 'AbortError') {
					throw new HermesTimeoutError(timeoutMs);
				}
				if (err instanceof HermesError) throw err;
				throw new HermesNetworkError('Falha de rede ao conectar com Hermes API', err);
			} finally {
				clearTimeout(timeoutId);
			}
		};

		if (this.config.retry === false) {
			return fn().catch((err) => {
				this.emit('error', err);
				throw err;
			});
		}

		const retryConfig: RetryConfig = {
			...DEFAULT_RETRY_CONFIG,
			...(this.config.retry || {}),
		};

		return withRetry(fn, retryConfig, (attempt, error, delayMs) => {
			this.emit('retry', attempt, error, delayMs);
		}).catch((err) => {
			this.emit('error', err);
			throw err;
		});
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

	async sendBulkEmails(emails: SendEmailPayload[]): Promise<any> {
		const apiKey = await this.config.storageAdapter!.getApiKey();
		if (!apiKey) {
			const err = new HermesError(
				'HermesClient: API Key is missing. Please provide it via StorageAdapter or initialApiKey.',
				'AUTH_MISSING_KEY'
			);
			this.emit('error', err);
			throw err;
		}

		const fn = async () => {
			const timeoutMs = this.config.timeoutMs ?? 30000;
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			try {
				const response = await fetch(`${this.config.baseUrl}/api/emails/bulk`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-API-Key': apiKey,
					},
					body: JSON.stringify({ emails }),
					signal: controller.signal,
				});

				if (!response.ok) {
					throw await this.parseErrorResponse(response);
				}

				return response.json();
			} catch (err: any) {
				if (err.name === 'AbortError') {
					throw new HermesTimeoutError(timeoutMs);
				}
				if (err instanceof HermesError) throw err;
				throw new HermesNetworkError('Falha de rede ao conectar com Hermes API', err);
			} finally {
				clearTimeout(timeoutId);
			}
		};

		if (this.config.retry === false) {
			return fn().catch((err) => {
				this.emit('error', err);
				throw err;
			});
		}

		const retryConfig: RetryConfig = {
			...DEFAULT_RETRY_CONFIG,
			...(this.config.retry || {}),
		};

		return withRetry(fn, retryConfig, (attempt, error, delayMs) => {
			this.emit('retry', attempt, error, delayMs);
		}).catch((err) => {
			this.emit('error', err);
			throw err;
		});
	}
}
