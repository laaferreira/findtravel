import 'dotenv/config';

/**
 * Carrega e valida variáveis de ambiente.
 * Falha cedo se uma variável obrigatória estiver ausente.
 * NUNCA loga valores sensíveis.
 */

export type ProviderName = 'mock' | 'decolar';

export interface AppEnv {
  provider: ProviderName;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  headless: boolean;
  maxSearchesPerRun: number;
  delayBetweenSearchesMs: number;
  navigationTimeoutMs: number;
  artifactsDir: string;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseIntOr(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseProvider(value: string | undefined): ProviderName {
  const v = (value ?? 'mock').toLowerCase();
  if (v === 'mock' || v === 'decolar') return v;
  throw new Error(
    `TRAVEL_PROVIDER inválido: "${value}". Use "mock" ou "decolar".`,
  );
}

export function loadEnv(): AppEnv {
  const provider = parseProvider(process.env.TRAVEL_PROVIDER);

  return {
    provider,
    supabaseUrl: process.env.SUPABASE_URL || undefined,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    headless: parseBool(process.env.HEADLESS, true),
    maxSearchesPerRun: parseIntOr(process.env.MAX_SEARCHES_PER_RUN, 20),
    delayBetweenSearchesMs: parseIntOr(process.env.DELAY_BETWEEN_SEARCHES_MS, 4000),
    navigationTimeoutMs: parseIntOr(process.env.NAVIGATION_TIMEOUT_MS, 45000),
    artifactsDir: process.env.ARTIFACTS_DIR || 'artifacts',
  };
}

/**
 * Valida que as credenciais do Supabase existem.
 * Usado apenas quando a persistência real é requerida (não no dry-run).
 */
export function assertSupabaseConfig(env: AppEnv): asserts env is AppEnv & {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
} {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push('SUPABASE_URL');
  if (!env.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    throw new Error(
      `Variáveis Supabase ausentes: ${missing.join(', ')}. ` +
        `Configure no .env (local) ou GitHub Secrets (CI).`,
    );
  }
}
