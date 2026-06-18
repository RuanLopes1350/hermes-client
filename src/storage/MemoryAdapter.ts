import type { StorageAdapter } from '../types';

export class MemoryAdapter implements StorageAdapter {
	private key: string | null = null;

	constructor(initialKey?: string) {
		if (initialKey) this.key = initialKey;
	}

	getApiKey(): string | null {
		return this.key;
	}

	setApiKey(newKey: string): void {
		this.key = newKey;
	}
}
