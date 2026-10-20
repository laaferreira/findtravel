/**
 * Modelos de domínio (interfaces TypeScript).
 *
 * Valores monetários são representados em CENTAVOS (inteiros) para evitar
 * imprecisão de ponto flutuante. Ex.: R$ 1.234,56 => 123456.
 */

export type MealPlan =
  | 'ALL_INCLUSIVE'
  | 'FULL_BOARD'
  | 'HALF_BOARD'
  | 'BREAKFAST'
  | 'ROOM_ONLY'
  | 'UNKNOWN';

export type Currency = 'BRL' | 'USD' | 'EUR';

/** Criança viajante — a idade afeta a composição da busca. */
export interface Child {
  age: number;
}

/** Critério de uma única pesquisa (uma janela de datas para um destino). */
export interface SearchCriteria {
  origin: string;
  destination: string;
  checkIn: string; // ISO date (YYYY-MM-DD)
  checkOut: string; // ISO date (YYYY-MM-DD)
  nights: number;
  adults: number;
  children: Child[];
  mealPlan: MealPlan;
}

/** Hotel/resort identificado em um resultado. */
export interface Hotel {
  name: string;
  /** Identificador externo confiável do provider, quando disponível. */
  externalId?: string;
}

/**
 * Pacote de viagem retornado por um provider.
 * `isMock` sinaliza claramente dados fictícios (nunca misturar com produção).
 */
export interface TravelPackage {
  provider: string;
  hotel: Hotel;
  destination: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  mealPlan: MealPlan;
  /** Preço total em CENTAVOS. */
  totalPrice: number;
  currency: Currency;
  installments?: number;
  flightIncluded: boolean;
  airline?: string;
  departureAirport?: string;
  url?: string;
  collectedAt: string; // ISO datetime
  isMock: boolean;
}

/** Resultado de uma execução de busca por critério. */
export interface SearchResult {
  criteria: SearchCriteria;
  packages: TravelPackage[];
  provider: string;
  collectedAt: string;
}

/** Observação de preço persistida (espelha price_history). */
export interface PriceObservation {
  packageId: string;
  totalPrice: number; // centavos
  collectedAt: string;
}

/** Estatísticas calculadas pelo PriceAnalyzer. */
export interface PriceStats {
  currentPrice: number; // centavos
  averagePrice: number; // centavos
  minimumHistoricalPrice: number; // centavos
  sampleCount: number;
  /** Percentual de queda vs média, ex.: 18.4 (%). Positivo = abaixo da média. */
  discountPercentage: number;
  hasEnoughHistory: boolean;
}

export type OpportunityTier = 'INTERESTING' | 'GOOD' | 'EXCELLENT';

/** Oportunidade detectada. */
export interface Opportunity {
  packageId: string;
  currentPrice: number; // centavos
  averagePrice: number; // centavos
  minimumHistoricalPrice: number; // centavos
  discountPercentage: number;
  score: number;
  tier: OpportunityTier;
  createdAt: string;
}

export type SearchRunStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';

/** Metadados de uma execução completa (espelha search_runs). */
export interface SearchRun {
  id?: string;
  startedAt: string;
  finishedAt?: string;
  provider: string;
  status: SearchRunStatus;
  searchesAttempted: number;
  searchesCompleted: number;
  resultsFound: number;
  errorMessage?: string;
}
