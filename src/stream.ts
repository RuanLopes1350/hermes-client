import { HermesClient } from './client';

export type EmailStatusEvent = {
	emailId: string;
	status: 'pending' | 'sent' | 'failed' | 'retrying';
	timestamp: string;
};

export class HermesStream {
	private client: HermesClient;
	private abortController?: AbortController;
	private connected: boolean = false;
	private intentionalDisconnect: boolean = false; // Flag para parar o loop de reconexão

	constructor(client: HermesClient) {
		this.client = client;
	}

	async onEmailStatus(callback: (event: EmailStatusEvent) => void, autoReconnect: boolean = true) {
		if (this.connected) return;

		this.intentionalDisconnect = false;
		let retryDelay = 1000; // Começa tentando reconectar em 1s

		while (!this.intentionalDisconnect) {
			const apiKey = await this.client.getConfig().storageAdapter?.getApiKey();
			if (!apiKey) {
				throw new Error('API Key is required to connect to the SSE stream.');
			}

			this.abortController = new AbortController();
			const streamUrl = `${this.client.getConfig().baseUrl}/api/emails/stream`;

			this.connected = true;
			this.client.logger.debug('Connecting to Hermes SSE stream...');

			try {
				const response = await fetch(streamUrl, {
					headers: { 'X-API-Key': apiKey },
					signal: this.abortController.signal,
				});

				if (!response.ok) {
					throw new Error(`Stream connection failed: ${response.statusText}`);
				}

				if (!response.body) {
					throw new Error('No body in stream response');
				}

				// Se conectou com sucesso, reseta o delay
				retryDelay = 1000;
				this.client.logger.info('Hermes SSE Stream connected.');

				const reader = response.body.getReader();
				const decoder = new TextDecoder('utf-8');
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break; // Stream encerrado pelo servidor

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							try {
								const data = JSON.parse(line.slice(6));
								callback(data);
							} catch (e) {
								// Ignora parse errors pontuais
							}
						}
					}
				}
			} catch (error: any) {
				this.connected = false;
				if (error.name === 'AbortError') {
					this.client.logger.debug('Hermes SSE Stream manually aborted.');
					break; // Quebra o loop principal, foi intencional
				}
				this.client.logger.error(`Hermes Stream Error: ${error.message}`);
			} finally {
				this.connected = false;
			}

			// Se o loop chegou aqui, a conexão caiu mas não foi intencional
			if (!this.intentionalDisconnect && autoReconnect) {
				this.client.logger.warn(`Connection lost. Reconnecting in ${retryDelay}ms...`);
				await new Promise((res) => setTimeout(res, retryDelay));
				// Backoff simples: até 30 segundos
				retryDelay = Math.min(retryDelay * 2, 30000);
			} else {
				break; // Sai do loop se autoReconnect for falso
			}
		}
	}

	disconnect() {
		this.intentionalDisconnect = true;
		if (this.abortController) {
			this.abortController.abort();
		}
		this.connected = false;
		this.client.logger.debug('Disconnected from Hermes SSE stream.');
	}
}
