import type { Opportunity, SearchRun, TravelPackage } from '../models/index.js';
import { dedupKeyFromPackage } from './dedup.js';
import type {
  OpportunityRepository,
  PackageRepository,
  PersistedPackage,
  PriceHistoryRepository,
  RepositoryBundle,
  SearchRunRepository,
} from './Repository.js';

/**
 * Implementação em memória. Usada no dry-run (NÃO toca no banco de produção).
 * Pode ser pré-carregada com histórico para demonstrar o PriceAnalyzer.
 */
export class InMemoryRepositoryBundle implements RepositoryBundle {
  private readonly packagesByKey = new Map<string, PersistedPackage>();
  private readonly historyByPackage = new Map<string, number[]>();
  readonly capturedOpportunities: Opportunity[] = [];
  readonly runs = new Map<string, SearchRun>();
  private idCounter = 0;

  packages: PackageRepository = {
    upsertPackage: async (pkg: TravelPackage): Promise<PersistedPackage> => {
      const key = dedupKeyFromPackage(pkg);
      const existing = this.packagesByKey.get(key);
      if (existing) return existing;
      const created: PersistedPackage = { id: `pkg-${++this.idCounter}`, dedupKey: key };
      this.packagesByKey.set(key, created);
      return created;
    },
  };

  priceHistory: PriceHistoryRepository = {
    insertObservation: async ({ packageId, pkg }): Promise<void> => {
      const list = this.historyByPackage.get(packageId) ?? [];
      list.push(pkg.totalPrice);
      this.historyByPackage.set(packageId, list);
    },
    getHistoricalPrices: async (packageId: string): Promise<number[]> => {
      return [...(this.historyByPackage.get(packageId) ?? [])];
    },
  };

  opportunities: OpportunityRepository = {
    insertOpportunity: async ({ opportunity }): Promise<void> => {
      this.capturedOpportunities.push(opportunity);
    },
  };

  searchRuns: SearchRunRepository = {
    start: async (run: SearchRun): Promise<string> => {
      const id = `run-${++this.idCounter}`;
      this.runs.set(id, { ...run, id });
      return id;
    },
    finish: async (id: string, update: Partial<SearchRun>): Promise<void> => {
      const current = this.runs.get(id);
      if (current) this.runs.set(id, { ...current, ...update });
    },
  };

  /** Helper de teste/demo: injeta histórico para um dedupKey. */
  seedHistory(key: string, prices: number[]): void {
    const persisted: PersistedPackage = this.packagesByKey.get(key) ?? {
      id: `pkg-${++this.idCounter}`,
      dedupKey: key,
    };
    this.packagesByKey.set(key, persisted);
    this.historyByPackage.set(persisted.id, [...prices]);
  }
}
