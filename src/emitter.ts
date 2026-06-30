export interface HermesEventMap {
	keyRotated: (newKey: string, oldKey: string | null) => void;
	error: (error: Error) => void;
	retry: (attempt: number, error: Error, delayMs: number) => void;
	requestStart: (method: string, url: string) => void;
	requestEnd: (method: string, url: string, status: number, durationMs: number) => void;
}

export type HermesEvent = keyof HermesEventMap;

export class LiteEventEmitter {
	private listeners = new Map<string, Set<Function>>();

	on<K extends HermesEvent>(event: K, callback: HermesEventMap[K]): this {
		if (!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event)!.add(callback);
		return this;
	}

	once<K extends HermesEvent>(event: K, callback: HermesEventMap[K]): this {
		const wrapper = (...args: any[]) => {
			this.off(event, wrapper as any);
			(callback as Function)(...args);
		};
		return this.on(event, wrapper as any);
	}

	off<K extends HermesEvent>(event: K, callback: HermesEventMap[K]): this {
		this.listeners.get(event)?.delete(callback);
		return this;
	}

	emit<K extends HermesEvent>(event: K, ...args: Parameters<HermesEventMap[K]>): boolean {
		const set = this.listeners.get(event);
		if (!set || set.size === 0) return false;
		for (const fn of set) fn(...args);
		return true;
	}
}
