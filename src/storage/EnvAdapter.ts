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

		// 1. Fallback: lê do process.env caso a aplicação (NextJS, etc) já tenha carregado
		if (process.env[this.envKeyName]) {
			this.currentKey = process.env[this.envKeyName] as string;
			return this.currentKey;
		}

		// 2. Fallback: Lê diretamente do arquivo .env físico, se existir
		if (fs.existsSync(this.envPath)) {
			const envContent = fs.readFileSync(this.envPath, 'utf-8');
			// Permite chaves com espaços como `HERMES_API_KEY = xyz`
			const regex = new RegExp(`^\\s*${this.envKeyName}\\s*=\\s*(.*)$`, 'm');
			const match = envContent.match(regex);
			if (match && match[1]) {
				const val = match[1].trim();
				this.currentKey = val;
				process.env[this.envKeyName] = val; // alimenta na memória
				return val;
			}
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

		const regex = new RegExp(`^\\s*${this.envKeyName}\\s*=.*$`, 'm');
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
