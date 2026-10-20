# Arquitetura — resort-price-hunter

## Visão geral

```
GitHub Actions (cron / workflow_dispatch)
        │
        ▼
  CLI (src/cli/search.ts)
        │
        ▼
  SearchOrchestrator ──── lê config/search.config.ts
        │
        ├─► DateRangeGenerator      (janelas de datas + amostragem)
        │
        ▼
  TravelProvider (interface)
        ├─ MockTravelProvider       (determinístico, offline)
        └─ DecolarProvider          (Playwright + Chromium)
        │
        ▼
  PriceAnalyzer                     (média / mínimo / desconto)
        │
        ▼
  OpportunityDetector               (classificação + score)
        │
        ▼
  RepositoryBundle (interface)
        ├─ InMemoryRepositoryBundle (dry-run, sem banco)
        └─ SupabaseRepositoryBundle (produção)
        │
        ▼
  Supabase / PostgreSQL
```

## Princípios

- **Desacoplamento por interfaces.** `TravelProvider` isola o acesso a qualquer
  site/API. `RepositoryBundle` isola a persistência. Trocar provider ou banco
  não afeta o orquestrador.
- **Injeção de dependência simples.** O `SearchOrchestrator` recebe config,
  provider e repositórios no construtor. Sem container/framework de DI.
- **Configuração centralizada.** Nada de busca é hardcoded em providers;
  tudo vem de `config/search.config.ts` e variáveis de ambiente.
- **Dinheiro em centavos.** Valores monetários são inteiros (BIGINT/number).
  Nunca float.
- **Segurança por padrão.** Service role só no backend/CI. Logs sem segredos.
  Schema pronto para RLS.

## Camadas e responsabilidades

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Config | `config/search.config.ts`, `src/config/env.ts` | Parâmetros de busca e env validado |
| Modelos | `src/models/index.ts` | Interfaces de domínio |
| Datas | `src/services/DateRangeGenerator.ts` | Geração e amostragem de janelas |
| Providers | `src/providers/**` | Coleta de pacotes (mock/decolar) |
| Análise | `src/services/PriceAnalyzer.ts` | Estatísticas de preço |
| Oportunidades | `src/services/OpportunityDetector.ts` | Classificação e score |
| Persistência | `src/repositories/**` | Supabase / in-memory + dedup |
| Orquestração | `src/services/SearchOrchestrator.ts` | Fluxo completo |
| CLI | `src/cli/**` | Entradas `search` / `search:dry` |

## Fluxo de dados (uma busca)

1. Orchestrator gera critérios (destino × janela de datas amostrada).
2. Provider retorna `TravelPackage[]`.
3. Para cada pacote: `upsertPackage` (dedup) → lê histórico →
   `PriceAnalyzer.analyze` → insere observação → `OpportunityDetector.detect`.
4. Oportunidades qualificadas são persistidas.
5. `search_runs` registra métricas e status final.

## Frontend futuro (não implementado)

```
Angular ──(anon key / RLS)──► Supabase
   ├─ melhores ofertas (opportunities)
   ├─ histórico (price_history)
   ├─ gráfico de preços
   ├─ última execução (search_runs)
   ├─ resorts (packages)
   └─ destinos
```

O frontend usará apenas a **anon key** com políticas RLS de leitura.
`SUPABASE_SERVICE_ROLE_KEY` nunca é exposta ao cliente.
