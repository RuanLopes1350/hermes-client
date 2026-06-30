import { HermesClient } from './client';
import { SendEmailPayload, EmailPriority } from './types';

export class EmailBuilder {
	private payload: Partial<SendEmailPayload> = {};
	private client: HermesClient;

	constructor(client: HermesClient) {
		this.client = client;
	}

	// Destinatário do e-mail.
	to(email: string): this {
		this.payload.recipient_to = email;
		return this;
	}

	// Assunto do e-mail.
	subject(text: string): this {
		this.payload.subject = text;
		return this;
	}

	// Conteúdo em texto ou HTML direto.
	// Alternativa ao uso de template.
	body(content: string): this {
		this.payload.body = content;
		return this;
	}

	// Utiliza um template MJML pré-configurado no Hermes.
	// Opcionalmente, injeta variáveis.
	useTemplate(templateId: string, variables?: Record<string, any>): this {
		this.payload.template_id = templateId;
		if (variables) {
			this.payload.variables = { ...this.payload.variables, ...variables };
		}
		return this;
	}

	// Injeta variáveis adicionais.
	variables(vars: Record<string, any>): this {
		this.payload.variables = { ...this.payload.variables, ...vars };
		return this;
	}

	// Agenda o e-mail para ser enviado no futuro (ISO 8601 string ou Date object).
	schedule(date: string | Date): this {
		this.payload.scheduled_at = typeof date === 'string' ? date : date.toISOString();
		return this;
	}

	// Opcional: Define qual credencial (conta SMTP configurada no Hermes) utilizar para o envio.
	credential(id: string): this {
		this.payload.credential_id = id;
		return this;
	}

	// Opcional: Define a prioridade na fila de processamento.
	priority(level: EmailPriority): this {
		this.payload.priority = level;
		return this;
	}

	// Dispara o envio chamando o HermesClient.
	async send() {
		if (!this.payload.recipient_to) throw new Error("O campo 'to' é obrigatório.");
		if (!this.payload.subject) throw new Error("O campo 'subject' é obrigatório.");
		if (!this.payload.body && !this.payload.template_id) {
			throw new Error("Você deve fornecer um 'body' ou um 'template_id'.");
		}

		return this.client.sendEmail(this.payload as SendEmailPayload);
	}
}
