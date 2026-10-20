import { describe, expect, it } from 'vitest';
import { OpportunityDetector } from '../src/services/OpportunityDetector.js';
import type { PriceStats } from '../src/models/index.js';

const thresholds = { interesting: 10, good: 15, excellent: 20 };

function stats(partial: Partial<PriceStats>): PriceStats {
  return {
    currentPrice: 100000,
    averagePrice: 120000,
    minimumHistoricalPrice: 110000,
    sampleCount: 6,
    discountPercentage: 16.7,
    hasEnoughHistory: true,
    ...partial,
  };
}

describe('OpportunityDetector', () => {
  const detector = new OpportunityDetector(thresholds);

  it('não gera oportunidade sem histórico suficiente', () => {
    const op = detector.detect('pkg-1', stats({ hasEnoughHistory: false }));
    expect(op).toBeNull();
  });

  it('não gera oportunidade abaixo do limiar "interesting"', () => {
    const op = detector.detect('pkg-1', stats({ discountPercentage: 5 }));
    expect(op).toBeNull();
  });

  it('classifica como INTERESTING', () => {
    const op = detector.detect('pkg-1', stats({ discountPercentage: 12 }));
    expect(op?.tier).toBe('INTERESTING');
  });

  it('classifica como GOOD', () => {
    const op = detector.detect('pkg-1', stats({ discountPercentage: 16.7 }));
    expect(op?.tier).toBe('GOOD');
  });

  it('classifica como EXCELLENT e dá bônus por mínimo histórico', () => {
    const op = detector.detect(
      'pkg-1',
      stats({ discountPercentage: 25, currentPrice: 90000, minimumHistoricalPrice: 95000 }),
    );
    expect(op?.tier).toBe('EXCELLENT');
    expect(op?.score).toBeLessThanOrEqual(100);
    expect(op?.score).toBeGreaterThan(80);
  });
});
