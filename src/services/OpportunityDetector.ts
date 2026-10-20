import type { AnalyzerThresholds } from '../../config/search.config.js';
import type { Opportunity, OpportunityTier, PriceStats } from '../models/index.js';

/**
 * OpportunityDetector
 * -------------------
 * Converte estatísticas de preço em oportunidades classificadas.
 *
 * Score (0..100): combina a queda percentual vs média com um bônus por
 * estar no/ou próximo do mínimo histórico.
 *   score = clamp( discount% * 3 + bônusMínimo , 0, 100 )
 *   bônusMínimo = 10 se o preço atual <= mínimo histórico, senão 0.
 *
 * Só gera oportunidade quando:
 *   - há histórico suficiente (hasEnoughHistory);
 *   - a queda atinge pelo menos o limiar "interesting".
 */
export class OpportunityDetector {
  constructor(private readonly thresholds: AnalyzerThresholds) {}

  private tierFor(discount: number): OpportunityTier | null {
    if (discount >= this.thresholds.excellent) return 'EXCELLENT';
    if (discount >= this.thresholds.good) return 'GOOD';
    if (discount >= this.thresholds.interesting) return 'INTERESTING';
    return null;
  }

  private computeScore(stats: PriceStats): number {
    const atOrBelowMin = stats.currentPrice <= stats.minimumHistoricalPrice;
    const bonus = atOrBelowMin ? 10 : 0;
    const raw = stats.discountPercentage * 3 + bonus;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  /** Retorna uma Opportunity ou null se não qualificar. */
  detect(packageId: string, stats: PriceStats): Opportunity | null {
    if (!stats.hasEnoughHistory) return null;
    const tier = this.tierFor(stats.discountPercentage);
    if (!tier) return null;

    return {
      packageId,
      currentPrice: stats.currentPrice,
      averagePrice: stats.averagePrice,
      minimumHistoricalPrice: stats.minimumHistoricalPrice,
      discountPercentage: stats.discountPercentage,
      score: this.computeScore(stats),
      tier,
      createdAt: new Date().toISOString(),
    };
  }
}
