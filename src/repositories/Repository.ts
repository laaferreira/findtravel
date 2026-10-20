import type {
  Opportunity,
  SearchRun,
  TravelPackage,
} from '../models/index.js';

/**
 * Contratos de persistência. Isolam o Supabase do restante da aplicação.
 * O dry-run usa uma implementação in-memory; produção usa Supabase.
 */

export interface PersistedPackage {
  id: string;
  dedupKey: string;
}

export interface PackageRepository {
  /**
   * Retorna o pacote persistido (criando se necessário) a partir da chave de
   * deduplicação. Garante que resorts não sejam duplicados entre execuções.
   */
  upsertPackage(pkg: TravelPackage): Promise<PersistedPackage>;
}

export interface PriceHistoryRepository {
  /** Insere uma observação de preço ligada a um pacote e a uma execução. */
  insertObservation(input: {
    packageId: string;
    searchRunId: string;
    pkg: TravelPackage;
  }): Promise<void>;

  /** Retorna preços históricos (centavos) de um pacote, mais antigos primeiro. */
  getHistoricalPrices(packageId: string): Promise<number[]>;
}

export interface OpportunityRepository {
  insertOpportunity(input: {
    opportunity: Opportunity;
    priceHistoryId?: string;
  }): Promise<void>;
}

export interface SearchRunRepository {
  start(run: SearchRun): Promise<string>;
  finish(id: string, update: Partial<SearchRun>): Promise<void>;
}

/** Agregado de repositórios usado pelo orquestrador. */
export interface RepositoryBundle {
  packages: PackageRepository;
  priceHistory: PriceHistoryRepository;
  opportunities: OpportunityRepository;
  searchRuns: SearchRunRepository;
}
