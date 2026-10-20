import { describe, expect, it } from 'vitest';
import { PriceAnalyzer } from '../src/services/PriceAnalyzer.js';

describe('PriceAnalyzer', () => {
  it('rejeita minimumHistorySamples inválido', () => {
    expect(() => new PriceAnalyzer(0)).toThrow();
  });

  it('marca hasEnoughHistory=false com poucas amostras', () => {
    const analyzer = new PriceAnalyzer(5);
    const stats = analyzer.analyze(100000, [110000, 120000]);
    expect(stats.hasEnoughHistory).toBe(false);
    expect(stats.sampleCount).toBe(2);
  });

  it('calcula média, mínimo e desconto corretamente', () => {
    const analyzer = new PriceAnalyzer(3);
    // histórico média = 120000; atual = 100000 => queda 16.7%
    const stats = analyzer.analyze(100000, [110000, 120000, 130000]);
    expect(stats.averagePrice).toBe(120000);
    expect(stats.minimumHistoricalPrice).toBe(110000);
    expect(stats.discountPercentage).toBeCloseTo(16.7, 1);
    expect(stats.hasEnoughHistory).toBe(true);
  });

  it('desconto negativo quando preço acima da média', () => {
    const analyzer = new PriceAnalyzer(1);
    const stats = analyzer.analyze(150000, [100000]);
    expect(stats.discountPercentage).toBeLessThan(0);
  });

  it('sem histórico retorna desconto 0 e usa o próprio preço', () => {
    const analyzer = new PriceAnalyzer(1);
    const stats = analyzer.analyze(100000, []);
    expect(stats.averagePrice).toBe(100000);
    expect(stats.discountPercentage).toBe(0);
  });
});
