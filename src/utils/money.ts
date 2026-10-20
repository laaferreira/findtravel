/**
 * Utilitários monetários. Valores são sempre inteiros em CENTAVOS.
 * Nunca usar float para armazenar dinheiro.
 */

/** Converte reais (ex.: 1234.56) para centavos (123456). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Converte centavos para string formatada (ex.: "R$ 1.234,56"). */
export function formatCents(cents: number, currency = 'BRL'): string {
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Faz o parse de um preço em texto brasileiro ("R$ 1.234,56", "1.234,56")
 * retornando centavos. Retorna null se não conseguir interpretar.
 */
export function parseBrlToCents(raw: string): number | null {
  const cleaned = raw
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
