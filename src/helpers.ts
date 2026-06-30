export const templateHelpers = {
	/** Formata data para exibição em emails (ex: 10 de maio de 2026) */
	formatDate(date: Date | string, locale = 'pt-BR'): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString(locale, {
			day: '2-digit',
			month: 'long',
			year: 'numeric',
		});
	},

	/** Formata valor monetário (ex: R$ 149,90) */
	formatCurrency(value: number, currency = 'BRL', locale = 'pt-BR'): string {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency,
		}).format(value);
	},

	/** Gera saudação baseada na hora local (Bom dia, Boa tarde, Boa noite) */
	greeting(name: string): string {
		const hour = new Date().getHours();
		const period = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
		return `${period}, ${name}`;
	},
};
