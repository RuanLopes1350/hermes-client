export class HermesError extends Error {
	public readonly code: string;
	public readonly statusCode?: number;
	public readonly details?: any;

	constructor(message: string, code: string, statusCode?: number, details?: any) {
		super(message);
		this.name = 'HermesError';
		this.code = code;
		this.statusCode = statusCode;
		this.details = details;
	}
}

// Erro de validação local (builder) - nunca chegou na API
export class HermesValidationError extends HermesError {
	public readonly fields: Record<string, string>;

	constructor(message: string, fields: Record<string, string>) {
		super(message, 'VALIDATION_ERROR', 422);
		this.name = 'HermesValidationError';
		this.fields = fields;
	}
}

// API retornou 401/403 - chave inválida, expirada ou inativa
export class HermesAuthError extends HermesError {
	constructor(message: string, statusCode: number = 401) {
		super(message, 'AUTH_ERROR', statusCode);
		this.name = 'HermesAuthError';
	}
}

// API retornou 429 - rate limit atingido
export class HermesRateLimitError extends HermesError {
	public readonly retryAfterMs?: number;

	constructor(message: string, retryAfterMs?: number) {
		super(message, 'RATE_LIMIT', 429);
		this.name = 'HermesRateLimitError';
		this.retryAfterMs = retryAfterMs;
	}
}

// Timeout na requisição
export class HermesTimeoutError extends HermesError {
	constructor(timeoutMs: number) {
		super(`Requisição excedeu o timeout de ${timeoutMs}ms`, 'TIMEOUT');
		this.name = 'HermesTimeoutError';
	}
}

// Falha de rede (DNS, conexão recusada, etc...)
export class HermesNetworkError extends HermesError {
	constructor(message: string, cause?: Error) {
		super(message, 'NETWORK_ERROR');
		this.name = 'HermesNetworkError';
		this.cause = cause;
	}
}
