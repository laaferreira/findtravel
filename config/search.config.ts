import type { MealPlan } from '../src/models/index.js';

/**
 * Configuração centralizada da pesquisa.
 * Nada relacionado à busca deve ser hardcoded nos providers/scrapers.
 * Datas são facilmente modificáveis aqui.
 */

export interface AnalyzerThresholds {
  /** Queda mínima (%) para considerar "interessante". */
  interesting: number;
  /** Queda mínima (%) para considerar "boa". */
  good: number;
  /** Queda mínima (%) para considerar "excelente". */
  excellent: number;
}

export interface SearchConfig {
  origin: string;
  adults: number;
  children: { age: number }[];
  nights: number;
  destinations: string[];
  mealPlan: MealPlan;
  searchWindow: {
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
  };
  /** Nº máximo de pesquisas por execução (controle de carga). */
  maxSearchesPerRun: number;
  analyzer: {
    /** Mínimo de amostras de histórico para considerar queda válida. */
    minimumHistorySamples: number;
    thresholds: AnalyzerThresholds;
  };
}

export const searchConfig: SearchConfig = {
  origin: 'CNF', // Belo Horizonte / Confins
  adults: 2,
  children: [{ age: 6 }],
  nights: 6,
  destinations: [
    'Porto Seguro',
    'Praia do Forte',
    'Costa do Sauípe',
    'Ilhéus',
    'Salvador',
  ],
  mealPlan: 'ALL_INCLUSIVE',
  searchWindow: {
    start: '2027-03-01',
    end: '2027-03-31',
  },
  maxSearchesPerRun: 20,
  analyzer: {
    minimumHistorySamples: 5,
    thresholds: {
      interesting: 10,
      good: 15,
      excellent: 20,
    },
  },
};

export default searchConfig;
