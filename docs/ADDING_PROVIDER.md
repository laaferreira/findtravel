# Como adicionar um novo TravelProvider

O sistema foi desenhado para que adicionar um provider (ex.: Azul Viagens, CVC)
não exija mudanças no orquestrador, analyzer ou repositórios.

## Passo a passo

### 1. Implemente a interface `TravelProvider`

Crie `src/providers/azul/AzulViagensProvider.ts`:

```ts
import type { SearchCriteria, TravelPackage } from '../../models/index.js';
import type { TravelProvider } from '../TravelProvider.js';

export class AzulViagensProvider implements TravelProvider {
  readonly name = 'azul';

  async init(): Promise<void> {
    /* abrir navegador, etc. */
  }

  async searchPackages(criteria: SearchCriteria): Promise<TravelPackage[]> {
    /* coletar e mapear para TravelPackage (totalPrice em CENTAVOS, isMock:false) */
    return [];
  }

  async dispose(): Promise<void> {
    /* fechar navegador, etc. */
  }
}
```

### 2. Centralize seletores (se for scraping)

Crie `src/providers/azul/selectors.ts` com candidatos estáveis
(role / test-id / label). Evite XPath absoluto. Inclua sinais anti-bot.

### 3. Registre no factory

Em `src/providers/factory.ts`, adicione o caso ao `switch` e inclua o nome
em `ProviderName` (`src/config/env.ts`).

```ts
case 'azul':
  return new AzulViagensProvider(/* options */);
```

### 4. Pronto

- `TRAVEL_PROVIDER=azul npm run search` passa a usar o novo provider.
- Mapeie `hotel.externalId` quando o provider fornecer um id confiável —
  isso melhora a deduplicação (ver `src/repositories/dedup.ts`).

## Checklist de qualidade

- [ ] `totalPrice` em centavos (inteiro).
- [ ] `isMock: false` em dados reais.
- [ ] Timeouts e tratamento de erro.
- [ ] Screenshot de diagnóstico em falhas.
- [ ] Detecção de anti-bot/CAPTCHA → encerra com segurança (retorna `[]`).
- [ ] Sem segredos em logs.
- [ ] Respeita `delayBetweenSearchesMs` entre requisições.
