import type { PriceStats } from '../models/index.js';

/**
 * PriceAnalyzer
 * -------------
 * Compara o preço atual com a média histórica e o menor preço histórico.
 *
 * Regra de queda (DOCUMENTADA):
 *   discountPercentage = (média - preçoAtual) / média * 100
 *   Positivo => preço atual ABAIXO da média (bom).
 *
 * Classificação por faixas (configuráveis em search.config.ts):
 *   queda >= interesting (10%) -> interessante
 *   queda >= good        (15%) -> boa
 *   queda >= excellent   (20%) -> excelente
 *
 * Histórico insuficiente:
 *   Se o nº de amostras históricas < minimumHistorySamples, NÃO marcamos
 *   como queda histórica (hasEnoughHistory=false). Isso evita falsos
 *   positivos quando ainda há poucos dados.
 */
export class PriceAnalyzer {
  constructor(private readonly minimumHistorySamples: number) {
    if (minimumHistorySamples < 1) {
      throw new Error('minimumHistorySamples deve ser >= 1');
    }
  }

  /**
   * @param currentPrice preço atual em centavos
   * @param historicalPrices preços históricos (centavos). NÃO inclui o atual.
   */
  analyze(currentPrice: number, historicalPrices: number[]): PriceStats {
    const sampleCount = historicalPrices.length;
    const hasEnoughHistory = sampleCount >= this.minimumHistorySamples;

    if (sampleCount === 0) {
      return {
        currentPrice,
        averagePrice: currentPrice,
        minimumHistoricalPrice: currentPrice,
        sampleCount,
        discountPercentage: 0,
        hasEnoughHistory,
      };
    }

    const sum = historicalPrices.reduce((acc, p) => acc + p, 0);
    const averagePrice = Math.round(sum / sampleCount);
    const minimumHistoricalPrice = Math.min(...historicalPrices);

    const discountPercentage =
      averagePrice > 0
        ? ((averagePrice - currentPrice) / averagePrice) * 100
        : 0;

    return {
      currentPrice,
      averagePrice,
      minimumHistoricalPrice,
      sampleCount,
      discountPercentage: Math.round(discountPercentage * 10) / 10, // 1 casa
      hasEnoughHistory,
    };
  }
}
