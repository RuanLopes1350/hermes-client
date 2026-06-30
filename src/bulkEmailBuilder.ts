import type { HermesClient } from './client';
import type { SendEmailPayload, EmailPriority } from './types';
import { EmailBuilder } from './builder';

export class BulkEmailBuilder {
	private emails: SendEmailPayload[] = [];
	private client: HermesClient;

	constructor(client: HermesClient) {
		this.client = client;
	}

	// Adiciona um email já montado
	add(payload: SendEmailPayload): this {
		this.emails.push(payload);
		return this;
	}

	// Abre um novo EmailBuilder; ao chamar .done(), o email volta para o bulk
	email(): BulkItemBuilder {
		return new BulkItemBuilder(this);
	}

	// @internal — chamado pelo BulkItemBuilder
	_push(payload: SendEmailPayload): void {
		this.emails.push(payload);
	}

	// Quantidade de emails na fila
	get count(): number {
		return this.emails.length;
	}

	// Envia todos os emails
	async send(): Promise<any> {
		if (this.emails.length === 0) {
			throw new Error('Nenhum email para enviar. Adicione emails antes de chamar send().');
		}
		if (this.emails.length > 100) {
			throw new Error('O envio em massa suporta no máximo 100 emails por vez.');
		}
        return this.client.sendBulkEmails(this.emails);
	}
}

class BulkItemBuilder {
	private payload: Partial<SendEmailPayload> = {};
	private parent: BulkEmailBuilder;

	constructor(parent: BulkEmailBuilder) {
		this.parent = parent;
	}

	to(email: string): this {
		this.payload.recipient_to = email;
		return this;
	}
	subject(text: string): this {
		this.payload.subject = text;
		return this;
	}
	body(content: string): this {
		this.payload.body = content;
		return this;
	}
	useTemplate(id: string, vars?: Record<string, any>): this {
		this.payload.template_id = id;
		if (vars) this.payload.variables = vars;
		return this;
	}
	variables(vars: Record<string, any>): this {
		this.payload.variables = { ...this.payload.variables, ...vars };
		return this;
	}
	credential(id: string): this {
		this.payload.credential_id = id;
		return this;
	}
	priority(level: EmailPriority): this {
		this.payload.priority = level;
		return this;
	}
	schedule(date: Date | string): this {
		this.payload.scheduled_at = date instanceof Date ? date.toISOString() : date;
		return this;
	}

	/** Finaliza este email e retorna ao BulkEmailBuilder */
	done(): BulkEmailBuilder {
		if (!this.payload.recipient_to || !this.payload.subject) {
			throw new Error('Cada email precisa de "to" e "subject".');
		}
		if (!this.payload.body && !this.payload.template_id) {
			throw new Error('Cada email precisa de "body" ou "template_id".');
		}
		this.parent._push(this.payload as SendEmailPayload);
		return this.parent;
	}
}
