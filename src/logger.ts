export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	silent: 4,
};

export class HermesLogger {
	private level: number;
	private prefix = '[hermes-client]';

	constructor(level: LogLevel = 'silent') {
		this.level = LOG_LEVELS[level];
	}

	debug(...args: any[]): void {
		if (this.level <= 0) console.debug(this.prefix, ...args);
	}

	info(...args: any[]): void {
		if (this.level <= 1) console.info(this.prefix, ...args);
	}

	warn(...args: any[]): void {
		if (this.level <= 2) console.warn(this.prefix, ...args);
	}

	error(...args: any[]): void {
		if (this.level <= 3) console.error(this.prefix, ...args);
	}
}
