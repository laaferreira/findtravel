import searchConfig from '../../config/search.config.js';
import { assertSupabaseConfig, loadEnv } from '../config/env.js';
import { createProvider } from '../providers/factory.js';
import { MockTravelProvider } from '../providers/mock/MockTravelProvider.js';
import { InMemoryRepositoryBundle } from '../repositories/InMemoryRepository.js';
import { dedupKeyFromPackage } from '../repositories/dedup.js';
import { SupabaseRepositoryBundle } from '../repositories/SupabaseRepository.js';
import type { RepositoryBundle } from '../repositories/Repository.js';
import type { TravelProvider } from '../providers/TravelProvider.js';
import { SearchOrchestrator } from '../services/SearchOrchestrator.js';
import { log, error } from '../utils/logger.js';
import { parseArgs } from './args.js';

/**
 * Ponto de entrada da CLI.
 *   npm run search         -> provider conforme TRAVEL_PROVIDER + Supabase
 *   npm run search:dry     -> MockTravelProvider + repositório em memória
 *   npm run search -- --destination="Porto Seguro"
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();

  let provider: TravelProvider;
  let repos: RepositoryBundle;
  const demoBundle = new InMemoryRepositoryBundle();

  if (args.dryRun) {
    log('CLI', 'DRY RUN — MockTravelProvider + repositório em memória (NÃO toca no banco)');
    provider = new MockTravelProvider();
    repos = demoBundle;
    await seedDemoHistory(demoBundle);
  } else {
    provider = createProvider(env);
    assertSupabaseConfig(env);
    repos = SupabaseRepositoryBundle.build(env.supabaseUrl, env.supabaseServiceRoleKey);
    log('CLI', `Execução real — provider=${env.provider}, persistindo no Supabase`);
  }

  const orchestrator = new SearchOrchestrator(searchConfig, provider, repos);
  const summary = await orchestrator.run({
    destinationFilter: args.destinations.length ? args.destinations : undefined,
    maxSearchesPerRun: args.max ?? env.maxSearchesPerRun,
    delayBetweenSearchesMs: args.dryRun ? 0 : env.delayBetweenSearchesMs,
  });

  log('CLI', '==================== RESUMO ====================');
  log('CLI', `Provider: ${summary.run.provider}`);
  log('CLI', `Status: ${summary.run.status}`);
  log('CLI', `Buscas tentadas/concluídas: ${summary.run.searchesAttempted}/${summary.run.searchesCompleted}`);
  log('CLI', `Pacotes encontrados: ${summary.packagesFound}`);
  log('CLI', `Oportunidades: ${summary.opportunitiesFound}`);

  if (args.dryRun && demoBundle.capturedOpportunities.length > 0) {
    log('CLI', '---------- Oportunidades (dry-run) ----------');
    for (const op of demoBundle.capturedOpportunities) {
      log('CLI', `  ${op.tier} | score ${op.score} | -${op.discountPercentage}% | pkg ${op.packageId}`);
    }
  }
}

/**
 * Semente de histórico para o dry-run demonstrar o PriceAnalyzer.
 *
 * Roda o MockTravelProvider sobre a config para descobrir os dedupKeys reais
 * dos pacotes que aparecerão, e injeta um histórico "caro" para cada um.
 * Assim o preço atual (menor) gera oportunidades e o fluxo completo é provado.
 */
async function seedDemoHistory(bundle: InMemoryRepositoryBundle): Promise<void> {
  const mock = new MockTravelProvider();
  const expensiveHistory = [1150000, 1180000, 1120000, 1200000, 1160000, 1175000];

  for (const destination of searchConfig.destinations) {
    const packages = await mock.searchPackages({
      origin: searchConfig.origin,
      destination,
      checkIn: searchConfig.searchWindow.start,
      checkOut: searchConfig.searchWindow.end,
      nights: searchConfig.nights,
      adults: searchConfig.adults,
      children: searchConfig.children,
      mealPlan: searchConfig.mealPlan,
    });
    for (const pkg of packages) {
      bundle.seedHistory(dedupKeyFromPackage(pkg), expensiveHistory);
    }
  }
}

main().catch((err) => {
  error('CLI', (err as Error).message);
  process.exitCode = 1;
});
