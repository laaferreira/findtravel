# resort-price-hunter

Monitor diário de preços de pacotes de viagem, focado em resorts **All Inclusive
na Bahia**. Pesquisa ofertas automaticamente, mantém histórico de preços,
identifica quedas relevantes e persiste tudo no Supabase — sem depender de uma
máquina local ligada (execução via GitHub Actions).

## 1. Objetivo

- Coletar preços de pacotes (resort + voo) periodicamente.
- Manter histórico por pacote.
- Detectar oportunidades (quedas relevantes vs média histórica).
- Disponibilizar dados para um dashboard futuro (Angular + GitHub Pages).

## 2. Arquitetura

```
GitHub Actions ─► CLI ─► SearchOrchestrator
                               ├─ DateRangeGenerator
                               ├─ TravelProvider (Mock | Decolar)
                               ├─ PriceAnalyzer
                               ├─ OpportunityDetector
                               └─ RepositoryBundle (InMemory | Supabase)
                                         └─► Supabase / PostgreSQL
```

Detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 3. Tecnologias

- Node.js 20+ / TypeScript (strict)
- Playwright + Chromium headless
- Supabase / PostgreSQL
- GitHub Actions (cron + manual)
- Vitest, ESLint, Prettier
- dotenv (local) + GitHub Secrets (CI)

## 4. Estrutura de pastas

```
resort-price-hunter/
├── .github/workflows/daily-search.yml
├── config/search.config.ts
├── docs/{ARCHITECTURE,ADDING_PROVIDER,PRICE_ANALYSIS}.md
├── supabase/migrations/0001_init.sql
├── src/
│   ├── cli/{args.ts, search.ts}
│   ├── config/env.ts
│   ├── models/index.ts
│   ├── providers/
│   │   ├── TravelProvider.ts
│   │   ├── factory.ts
│   │   ├── mock/MockTravelProvider.ts
│   │   └── decolar/{DecolarProvider.ts, selectors.ts}
│   ├── repositories/
│   │   ├── Repository.ts
│   │   ├── InMemoryRepository.ts
│   │   ├── SupabaseRepository.ts
│   │   └── dedup.ts
│   ├── services/
│   │   ├── DateRangeGenerator.ts
│   │   ├── PriceAnalyzer.ts
│   │   ├── OpportunityDetector.ts
│   │   └── SearchOrchestrator.ts
│   └── utils/{logger.ts, money.ts, sleep.ts}
├── tests/*.test.ts
├── .env.example  .gitignore  package.json  tsconfig.json
├── vitest.config.ts  .eslintrc.cjs  .prettierrc.json
```

## 5. Configuração

Parâmetros de busca ficam em `config/search.config.ts` (origem, viajantes,
noites, destinos, regime, janela de datas, limites e thresholds do analyzer).
Datas são facilmente modificáveis em `searchWindow`.

Variáveis de ambiente ficam no `.env` (copie de `.env.example`).

## 6. Execução local

```bash
npm install
npm run search:dry      # fluxo completo simulado (mock + memória)
npm test                # testes unitários
npm run search          # execução real (requer TRAVEL_PROVIDER + Supabase)
```

Filtrar destino:

```bash
npm run search -- --destination="Porto Seguro"
npm run search -- --destination="Salvador" --max=5
```

## 7. Configuração Supabase

1. Crie um projeto em https://supabase.com.
2. Copie `Project URL` → `SUPABASE_URL`.
3. Copie a `service_role` key (em Settings → API) → `SUPABASE_SERVICE_ROLE_KEY`.
   - **Nunca** exponha a service role no frontend.

## 8. Execução das migrations

Opção A — SQL Editor do Supabase: cole o conteúdo de
`supabase/migrations/0001_init.sql` e execute.

Opção B — Supabase CLI:

```bash
supabase db push
# ou
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
```

## 9. Configuração de GitHub Secrets

Em `Settings → Secrets and variables → Actions`:

Secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Variables (opcionais, sobrescrevem defaults):
- `MAX_SEARCHES_PER_RUN`, `DELAY_BETWEEN_SEARCHES_MS`, `NAVIGATION_TIMEOUT_MS`

## 10. Configuração do GitHub Actions

Workflow: `.github/workflows/daily-search.yml`.

- Agendado via `cron: '0 9 * * *'` → **09:00 UTC = 06:00 America/Sao_Paulo** (UTC-3).
- Instala Chromium (`npx playwright install --with-deps chromium`).
- Roda testes e depois o monitor.
- Em falha, faz upload de `artifacts/` e `*.log`.

## 11. Execução manual

Aba **Actions → daily-search → Run workflow**. É possível escolher o provider
(`mock` ou `decolar`) via input `provider`.

## 12. Troubleshooting Playwright

- **Chromium ausente localmente:** `npx playwright install chromium`.
- **Timeout em navegação:** aumente `NAVIGATION_TIMEOUT_MS`.
- **Seletores quebrados:** ajuste `src/providers/decolar/selectors.ts`
  (vários candidatos por campo; prefira role/test-id/label).
- **Falhas no CI:** baixe o artifact `diagnostics-*` com screenshots/logs.
- **Anti-bot/CAPTCHA:** o provider detecta e encerra com segurança (não burla).

## 13. Modo mock

```bash
TRAVEL_PROVIDER=mock npm run search     # ou simplesmente npm run search:dry
```

- Dados fictícios determinísticos, marcados com `isMock: true`.
- Nunca misturados com produção.
- Permite validar Actions, Supabase, analyzer e detector sem acessar a Decolar.

## 14. Como adicionar um novo TravelProvider

Ver [`docs/ADDING_PROVIDER.md`](docs/ADDING_PROVIDER.md). Resumo: implemente
`TravelProvider`, centralize seletores e registre no `factory.ts`.

## 15. Limitações conhecidas

- **Proteção anti-bot da Decolar (confirmada).** Em inspeção real, a Decolar
  respondeu com a tela "O acesso está temporariamente restrito" (bloqueio por
  reputação de IP / comportamento), renderizada dentro de um `iframe`. Conforme
  a especificação, o sistema **não burla** esse mecanismo: o `DecolarProvider`
  detecta a mensagem (na página e em frames), registra a ocorrência, salva
  screenshot de diagnóstico e encerra a busca com segurança (retorna `[]`).
  - Por isso os **seletores de formulário/resultados ainda não puderam ser
    validados** contra o DOM real logado — eles permanecem como candidatos
    tolerantes a falha em `src/providers/decolar/selectors.ts` e exigem ajuste
    quando/se o acesso ocorrer a partir de um IP não bloqueado.
  - Mitigações legítimas possíveis (sem burlar proteção): executar a partir de
    um IP/residencial não sinalizado, reduzir frequência, respeitar
    `delayBetweenSearchesMs`. O modo mock cobre todo o fluxo nesse ínterim.
- Amostragem de datas é **uniforme** (não considera sazonalidade ainda).
- Sem notificações (e-mail/Telegram) — planejado para o futuro.
- Frontend Angular ainda **não** implementado (arquitetura preparada).
- RLS está habilitado mas as policies de leitura pública ficam comentadas até
  o frontend existir.

## Segurança

- Secrets apenas via environment; variáveis obrigatórias validadas.
- Service role nunca no frontend.
- Inserts parametrizados (sem SQL por string) — sem SQL injection.
- Logs sanitizados (sem password/API key/service key/token).
- Schema pronto para políticas RLS.
