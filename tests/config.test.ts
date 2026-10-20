import { describe, expect, it } from 'vitest';
import searchConfig from '../config/search.config.js';

describe('search.config', () => {
  it('reflete o cenário inicial (CNF, 2 adultos, 1 criança de 6, 6 diárias)', () => {
    expect(searchConfig.origin).toBe('CNF');
    expect(searchConfig.adults).toBe(2);
    expect(searchConfig.children).toEqual([{ age: 6 }]);
    expect(searchConfig.nights).toBe(6);
    expect(searchConfig.mealPlan).toBe('ALL_INCLUSIVE');
  });

  it('lista os destinos da Bahia', () => {
    expect(searchConfig.destinations).toContain('Porto Seguro');
    expect(searchConfig.destinations).toContain('Salvador');
  });

  it('define limites e thresholds do analyzer', () => {
    expect(searchConfig.maxSearchesPerRun).toBeGreaterThan(0);
    expect(searchConfig.analyzer.minimumHistorySamples).toBe(5);
    expect(searchConfig.analyzer.thresholds.interesting).toBe(10);
    expect(searchConfig.analyzer.thresholds.good).toBe(15);
    expect(searchConfig.analyzer.thresholds.excellent).toBe(20);
  });

  it('a janela de busca é uma data ISO válida e coerente', () => {
    const { start, end } = searchConfig.searchWindow;
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(start).getTime()).toBeLessThanOrEqual(new Date(end).getTime());
  });
});
