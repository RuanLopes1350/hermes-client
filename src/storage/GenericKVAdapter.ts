import type { StorageAdapter } from '../types';

export interface GenericKVAdapter {
	get: () => string | null | Promise<string | null>;
	set: (key: string) => void | Promise<void>;
}

export class GenericKVAdapter implements StorageAdapter {
	private getter: () => string | null | Promise<string | null>;
	private setter: (key: string) => void | Promise<void>;

	constructor(options: GenericKVAdapter) {
		this.getter = options.get;
		this.setter = options.set;
	}

	async getApiKey(): Promise<string | null> {
		return await this.getter();
	}

	async setApiKey(newKey: string): Promise<void> {
		return await this.setter(newKey);
	}
}
