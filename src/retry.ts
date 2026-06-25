export interface RetryConfig {
	// Número máximo de tentativas (inclui a primeira). Default: 3
	maxAttempts: number;
	// DElay base em milissegundos entre as tentativas. Default: 1000
	baseDelayMs: number;
	// Fator de multiplicação para aumento do delay entre as tentativas. Default: 2
	backoffFactor: number;
	// Delay máximo em milissegundos entre as tentativas. Default: 30000
	maxDelaysMs: number;
	// Lista de códigos de status HTTP que são considerados para retry. Default: [408, 429, 500, 502, 503, 504]
	retryableStatusCodes: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxAttempts: 3,
	baseDelayMs: 1000,
	backoffFactor: 2,
	maxDelaysMs: 30000,
	retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

export async function withRetry<T>(
	fn: () => Promise<T>,
	config: RetryConfig,
	onRetry?: (attempt: number, error: Error, delayMs: number) => void,
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error: any) {
			lastError = error;

			const isRetryable =
				!error.statusCode || config.retryableStatusCodes.includes(error.statusCode);

			if (attempt >= config.maxAttempts || !isRetryable) {
				throw lastError;
			}

			const delay = Math.min(
				config.baseDelayMs * Math.pow(config.backoffFactor, attempt - 1),
				config.maxDelaysMs,
			);

			// Jitter: +=25% para evitar thundering herd
			const jitter = delay * 0.25 * (Math.random() * 2 - 1);
			const finalDelay = Math.max(0, Math.round(delay + jitter));

			onRetry?.(attempt, error, finalDelay);
			await new Promise((resolve) => setTimeout(resolve, finalDelay));
		}
	}

	// Se chegou aqui, algo de errado não está certo, mas não deveria acontecer devido à lógica acima. Apenas para garantir.
	throw lastError;
}
