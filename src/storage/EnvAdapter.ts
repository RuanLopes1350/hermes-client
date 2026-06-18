import * as fs from 'fs';
import * as path from 'path';
import type { StorageAdapter } from '../types';

export class EnvAdapter implements StorageAdapter {
	private envPath: string;
	private envKeyName: string;
	private currentKey: string | null = null;

	constructor(envFilePath: string = '.env', envKeyName: string = 'HERMES_API_KEY') {
		this.envPath = path.resolve(process.cwd(), envFilePath);
		this.envKeyName = envKeyName;
	}

	getApiKey(): string | null {
		if (this.currentKey) return this.currentKey;

		// Fallback: lê do process.env caso já exista na memória global da aplicação
		if (process.env[this.envKeyName]) {
			this.currentKey = process.env[this.envKeyName] as string;
			return this.currentKey;
		}

		return null;
	}

	setApiKey(newKey: string): void {
		this.currentKey = newKey;

		// Atualiza o arquivo físico .env
		let envContent = '';
		if (fs.existsSync(this.envPath)) {
			envContent = fs.readFileSync(this.envPath, 'utf-8');
		}

		const regex = new RegExp(`^${this.envKeyName}=.*$`, 'm');
		if (regex.test(envContent)) {
			envContent = envContent.replace(regex, `${this.envKeyName}=${newKey}`);
		} else {
			envContent += `\n${this.envKeyName}=${newKey}\n`;
		}

		fs.writeFileSync(this.envPath, envContent.trim() + '\n', 'utf-8');

		// Atualiza a memória de execução atual (process.env) para não quebrar outras rotas
		process.env[this.envKeyName] = newKey;
	}
}
