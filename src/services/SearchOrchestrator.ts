import type { SearchConfig } from '../../config/search.config.js';
import type { SearchCriteria, SearchRun, TravelPackage } from '../models/index.js';
import type { TravelProvider } from '../providers/TravelProvider.js';
import type { RepositoryBundle } from '../repositories/Repository.js';
import { generateSampledWindows } from './DateRangeGenerator.js';
import { PriceAnalyzer } from './PriceAnalyzer.js';
import { OpportunityDetector } from './OpportunityDetector.js';
import { log, warn, error } from '../utils/logger.js';
import { formatCents } from '../utils/money.js';
import { sleep } from '../utils/sleep.js';

export interface OrchestratorOptions {
  /** Limita destinos a este subconjunto (ex.: CLI --destination). */
  destinationFilter?: string[];
  /** Limite de carga; sobrescreve o da config se informado. */
  maxSearchesPerRun?: number;
  /** Delay entre buscas (ms). */
  delayBetweenSearchesMs?: number;
}

export interface OrchestratorSummary {
  run: SearchRun;
  packagesFound: number;
  opportunitiesFound: number;
}

/**
 * SearchOrchestrator
 * ------------------
 * Coordena: geração de datas -> provider -> persistência -> análise ->
 * detecção de oportunidades. Independe da implementação concreta de provider
 * e de repositório (injeção de dependência simples).
 */
export class SearchOrchestrator {
  private readonly analyzer: PriceAnalyzer;
  private readonly detector: OpportunityDetector;

  constructor(
    private readonly config: SearchConfig,
    private readonly provider: TravelProvider,
    private readonly repos: RepositoryBundle,
  ) {
    this.analyzer = new PriceAnalyzer(config.analyzer.minimumHistorySamples);
    this.detector = new OpportunityDetector(config.analyzer.thresholds);
  }

  private buildCriteria(destination: string): SearchCriteria[] {
    const maxTotal = this.config.maxSearchesPerRun;
    const windows = generateSampledWindows(
      this.config.searchWindow.start,
      this.config.searchWindow.end,
      this.config.nights,
      maxTotal,
    );
    return windows.map((w) => ({
      origin: this.config.origin,
      destination,
      checkIn: w.checkIn,
      checkOut: w.checkOut,
      nights: w.nights,
      adults: this.config.adults,
      children: this.config.children,
      mealPlan: this.config.mealPlan,
    }));
  }

  async run(options: OrchestratorOptions = {}): Promise<OrchestratorSummary> {
    const maxSearches = options.maxSearchesPerRun ?? this.config.maxSearchesPerRun;
    const delay = options.delayBetweenSearchesMs ?? 0;

    const destinations = options.destinationFilter?.length
      ? this.config.destinations.filter((d) =>
          options.destinationFilter!.some(
            (f) => f.toLowerCase() === d.toLowerCase(),
          ),
        )
      : this.config.destinations;

    // Distribui o orçamento de buscas entre os destinos.
    const perDestination = Math.max(1, Math.floor(maxSearches / Math.max(1, destinations.length)));

    const run: SearchRun = {
      startedAt: new Date().toISOString(),
      provider: this.provider.name,
      status: 'RUNNING',
      searchesAttempted: 0,
      searchesCompleted: 0,
      resultsFound: 0,
    };
    const runId = await this.repos.searchRuns.start(run);

    log('SEARCH', `Starting search (provider=${this.provider.name})`);
    log('SEARCH', `Destinos: ${destinations.join(', ') || '(nenhum)'}`);

    let packagesFound = 0;
    let opportunitiesFound = 0;
    let searchesCompleted = 0;
    let searchesAttempted = 0;
    let failures = 0;

    if (this.provider.init) await this.provider.init();

    try {
      for (const destination of destinations) {
        const criteriaList = this.buildCriteria(destination).slice(0, perDestination);

        for (const criteria of criteriaList) {
          searchesAttempted++;
          log('SEARCH', `${criteria.origin} -> ${criteria.destination}`);
          log('SEARCH', `${criteria.checkIn} -> ${criteria.checkOut}`);

          try {
            const packages = await this.provider.searchPackages(criteria);
            searchesCompleted++;
            packagesFound += packages.length;
            await this.persistAndAnalyze(packages, runId, (n) => {
              opportunitiesFound += n;
            });
          } catch (err) {
            failures++;
            error('SEARCH', `Falha na busca ${destination}: ${(err as Error).message}`);
          }

          if (delay > 0) await sleep(delay);
        }
      }

      const status = failures === 0 ? 'SUCCESS' : searchesCompleted > 0 ? 'PARTIAL' : 'FAILED';
      const finished: SearchRun = {
        ...run,
        id: runId,
        finishedAt: new Date().toISOString(),
        status,
        searchesAttempted,
        searchesCompleted,
        resultsFound: packagesFound,
      };
      await this.repos.searchRuns.finish(runId, finished);
      log('SEARCH', `Concluído: ${packagesFound} pacotes, ${opportunitiesFound} oportunidades, status=${status}`);
      return { run: finished, packagesFound, opportunitiesFound };
    } finally {
      if (this.provider.dispose) await this.provider.dispose();
    }
  }

  private async persistAndAnalyze(
    packages: TravelPackage[],
    runId: string,
    onOpportunity: (count: number) => void,
  ): Promise<void> {
    if (packages.length > 0) log('DATABASE', 'Saving results');

    for (const pkg of packages) {
      const persisted = await this.repos.packages.upsertPackage(pkg);

      log('ANALYZER', 'Checking price history');
      const history = await this.repos.priceHistory.getHistoricalPrices(persisted.id);
      const stats = this.analyzer.analyze(pkg.totalPrice, history);

      // Insere a observação atual APÓS ler o histórico (não contamina a média).
      await this.repos.priceHistory.insertObservation({
        packageId: persisted.id,
        searchRunId: runId,
        pkg,
      });

      if (!stats.hasEnoughHistory) {
        warn(
          'ANALYZER',
          `${pkg.hotel.name}: histórico insuficiente (${stats.sampleCount}/${this.config.analyzer.minimumHistorySamples})`,
        );
        continue;
      }

      const opportunity = this.detector.detect(persisted.id, stats);
      if (opportunity) {
        onOpportunity(1);
        log(
          'OPPORTUNITY',
          `${pkg.hotel.name} - ${opportunity.discountPercentage}% abaixo da média ` +
            `(${formatCents(opportunity.currentPrice)} vs ${formatCents(opportunity.averagePrice)}, ` +
            `tier=${opportunity.tier}, score=${opportunity.score})`,
        );
        await this.repos.opportunities.insertOpportunity({ opportunity });
      }
    }
  }
}
