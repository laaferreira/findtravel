-- ======================================================
-- resort-price-hunter — schema inicial
-- Valores monetários em CENTAVOS (BIGINT). Nunca usar float.
-- ======================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------
-- search_runs: uma linha por execução do monitor
-- ------------------------------------------------------
create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  provider text not null,
  status text not null default 'RUNNING'
    check (status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')),
  searches_attempted integer not null default 0,
  searches_completed integer not null default 0,
  results_found integer not null default 0,
  error_message text
);

create index if not exists idx_search_runs_started_at
  on public.search_runs (started_at desc);

-- ------------------------------------------------------
-- packages: resort/pacote único (deduplicado)
-- ------------------------------------------------------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_identifier text,
  -- chave de deduplicação: provider+externalId OU provider+hotel+destination
  dedup_key text not null,
  hotel_name text not null,
  destination text not null,
  meal_plan text not null,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_packages_dedup_key unique (dedup_key)
);

create index if not exists idx_packages_destination
  on public.packages (destination);
create index if not exists idx_packages_provider
  on public.packages (provider);

-- ------------------------------------------------------
-- price_history: uma observação de preço por busca
-- ------------------------------------------------------
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  search_run_id uuid references public.search_runs (id) on delete set null,
  check_in date not null,
  check_out date not null,
  nights integer not null check (nights > 0),
  adults integer not null check (adults >= 0),
  children integer not null default 0 check (children >= 0),
  departure_airport text,
  total_price bigint not null check (total_price >= 0), -- centavos
  currency text not null default 'BRL',
  installments integer,
  flight_included boolean not null default false,
  airline text,
  collected_at timestamptz not null default now()
);

create index if not exists idx_price_history_package
  on public.price_history (package_id, collected_at desc);
create index if not exists idx_price_history_run
  on public.price_history (search_run_id);

-- ------------------------------------------------------
-- opportunities: quedas relevantes detectadas
-- ------------------------------------------------------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  price_history_id uuid references public.price_history (id) on delete set null,
  current_price bigint not null check (current_price >= 0),      -- centavos
  average_price bigint not null check (average_price >= 0),      -- centavos
  minimum_historical_price bigint not null check (minimum_historical_price >= 0),
  discount_percentage numeric(5, 2) not null,
  score integer not null check (score between 0 and 100),
  tier text not null check (tier in ('INTERESTING', 'GOOD', 'EXCELLENT')),
  created_at timestamptz not null default now()
);

create index if not exists idx_opportunities_package
  on public.opportunities (package_id, created_at desc);
create index if not exists idx_opportunities_score
  on public.opportunities (score desc);

-- ------------------------------------------------------
-- RLS: habilitado desde já. O frontend usará a anon key (somente leitura).
-- A service role (backend/CI) ignora RLS por padrão no Supabase.
-- As policies de leitura pública ficam comentadas até o frontend existir.
-- ------------------------------------------------------
alter table public.search_runs enable row level security;
alter table public.packages enable row level security;
alter table public.price_history enable row level security;
alter table public.opportunities enable row level security;

-- Exemplo de policy de leitura pública (habilitar quando o frontend existir):
-- create policy "public read packages" on public.packages
--   for select using (true);
-- create policy "public read price_history" on public.price_history
--   for select using (true);
-- create policy "public read opportunities" on public.opportunities
--   for select using (true);
-- create policy "public read search_runs" on public.search_runs
--   for select using (true);
