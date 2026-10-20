import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SearchRun, TravelPackage } from '../models/index.js';
import { log } from '../utils/logger.js';
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
 * Implementação Supabase/PostgreSQL. Usa a service role key (somente backend/CI).
 * Toda inserção é parametrizada pelo client oficial (sem SQL por string).
 */
export class SupabaseRepositoryBundle implements RepositoryBundle {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  packages: PackageRepository = {
    upsertPackage: async (pkg: TravelPackage): Promise<PersistedPackage> => {
      const key = dedupKeyFromPackage(pkg);
      const { data, error } = await this.client
        .from('packages')
        .upsert(
          {
            provider: pkg.provider,
            external_identifier: pkg.hotel.externalId ?? null,
            dedup_key: key,
            hotel_name: pkg.hotel.name,
            destination: pkg.destination,
            meal_plan: pkg.mealPlan,
            url: pkg.url ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'dedup_key' },
        )
        .select('id')
        .single();

      if (error) throw new Error(`upsertPackage falhou: ${error.message}`);
      return { id: data.id as string, dedupKey: key };
    },
  };

  priceHistory: PriceHistoryRepository = {
    insertObservation: async ({ packageId, searchRunId, pkg }): Promise<void> => {
      const { error } = await this.client.from('price_history').insert({
        package_id: packageId,
        search_run_id: searchRunId,
        check_in: pkg.checkIn,
        check_out: pkg.checkOut,
        nights: pkg.nights,
        adults: pkg.adults,
        children: pkg.children,
        departure_airport: pkg.departureAirport ?? null,
        total_price: pkg.totalPrice,
        currency: pkg.currency,
        installments: pkg.installments ?? null,
        flight_included: pkg.flightIncluded,
        airline: pkg.airline ?? null,
        collected_at: pkg.collectedAt,
      });
      if (error) throw new Error(`insertObservation falhou: ${error.message}`);
    },
    getHistoricalPrices: async (packageId: string): Promise<number[]> => {
      const { data, error } = await this.client
        .from('price_history')
        .select('total_price')
        .eq('package_id', packageId)
        .order('collected_at', { ascending: true });
      if (error) throw new Error(`getHistoricalPrices falhou: ${error.message}`);
      return (data ?? []).map((row) => Number(row.total_price));
    },
  };

  opportunities: OpportunityRepository = {
    insertOpportunity: async ({ opportunity, priceHistoryId }): Promise<void> => {
      const { error } = await this.client.from('opportunities').insert({
        package_id: opportunity.packageId,
        price_history_id: priceHistoryId ?? null,
        current_price: opportunity.currentPrice,
        average_price: opportunity.averagePrice,
        minimum_historical_price: opportunity.minimumHistoricalPrice,
        discount_percentage: opportunity.discountPercentage,
        score: opportunity.score,
        tier: opportunity.tier,
        created_at: opportunity.createdAt,
      });
      if (error) throw new Error(`insertOpportunity falhou: ${error.message}`);
    },
  };

  searchRuns: SearchRunRepository = {
    start: async (run: SearchRun): Promise<string> => {
      const { data, error } = await this.client
        .from('search_runs')
        .insert({
          started_at: run.startedAt,
          provider: run.provider,
          status: run.status,
          searches_attempted: run.searchesAttempted,
          searches_completed: run.searchesCompleted,
          results_found: run.resultsFound,
        })
        .select('id')
        .single();
      if (error) throw new Error(`searchRuns.start falhou: ${error.message}`);
      log('DATABASE', `search_run criado (id=${data.id})`);
      return data.id as string;
    },
    finish: async (id: string, update: Partial<SearchRun>): Promise<void> => {
      const { error } = await this.client
        .from('search_runs')
        .update({
          finished_at: update.finishedAt ?? new Date().toISOString(),
          status: update.status,
          searches_attempted: update.searchesAttempted,
          searches_completed: update.searchesCompleted,
          results_found: update.resultsFound,
          error_message: update.errorMessage ?? null,
        })
        .eq('id', id);
      if (error) throw new Error(`searchRuns.finish falhou: ${error.message}`);
    },
  };

  static build(url: string, serviceRoleKey: string): RepositoryBundle {
    return new SupabaseRepositoryBundle(url, serviceRoleKey);
  }
}
