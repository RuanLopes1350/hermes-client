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

	constructor(client: HermesClient) {
		this.client = client;
	}

	async onEmailStatus(callback: (event: EmailStatusEvent) => void) {
		if (this.connected) return;

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
				this.connected = false;
				throw new Error(`Stream connection failed: ${response.statusText}`);
			}
			
			if (!response.body) {
				this.connected = false;
				throw new Error('No body in stream response');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder('utf-8');
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const data = JSON.parse(line.slice(6));
							callback(data);
						} catch (e) {
							// Ignora parse errors
						}
					}
				}
			}
		} catch (error: any) {
			this.connected = false;
			if (error.name !== 'AbortError') {
				this.client.logger.error(`Hermes Stream Error: ${error.message}`);
				throw error; // Let the consumer handle it if they want
			}
		} finally {
			this.connected = false;
		}
	}

	disconnect() {
		if (this.abortController) {
			this.abortController.abort();
		}
		this.connected = false;
		this.client.logger.debug('Disconnected from Hermes SSE stream.');
	}
}
