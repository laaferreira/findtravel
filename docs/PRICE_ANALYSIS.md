# Análise de preços e detecção de oportunidades

## Objetivo

Identificar quedas relevantes comparando o preço atual com o histórico de cada
pacote (resort + datas + ocupação).

## Entradas

- `currentPrice`: preço atual observado (centavos).
- `historicalPrices`: observações anteriores do mesmo pacote (centavos),
  obtidas de `price_history`. A observação atual é inserida **após** a leitura,
  para não contaminar a média.

## Métricas (PriceAnalyzer)

```
averagePrice            = média(historicalPrices)
minimumHistoricalPrice  = min(historicalPrices)
discountPercentage      = (averagePrice - currentPrice) / averagePrice * 100
```

- `discountPercentage` positivo ⇒ preço atual **abaixo** da média (bom).
- Arredondado para 1 casa decimal.

## Histórico insuficiente

Para evitar falsos positivos com poucos dados:

```
hasEnoughHistory = sampleCount >= minimumHistorySamples   (padrão: 5)
```

Se `hasEnoughHistory` é falso, **nenhuma** oportunidade é gerada, mesmo que a
queda pareça grande. O valor é configurável em
`config/search.config.ts → analyzer.minimumHistorySamples`.

## Classificação (OpportunityDetector)

Faixas configuráveis em `analyzer.thresholds`:

| Queda vs média | Tier |
| --- | --- |
| ≥ 10% | `INTERESTING` |
| ≥ 15% | `GOOD` |
| ≥ 20% | `EXCELLENT` |

Abaixo de 10% (padrão) não gera oportunidade.

## Opportunity Score (0–100)

```
bônusMínimo = 10 se currentPrice <= minimumHistoricalPrice, senão 0
score       = clamp( discountPercentage * 3 + bônusMínimo , 0, 100 )
```

Interpretação: quanto maior a queda e quanto mais próximo (ou abaixo) do mínimo
histórico, maior o score. O fator `* 3` faz uma queda de ~30% já atingir o teto,
o que é adequado para "oportunidades fortes".

## Exemplo

```
histórico = [11.500, 11.800, 11.200, 12.000, 11.600, 11.750]  (R$)
média     = 11.641,67
atual     = 5.624,23
queda     = 51,7%  → EXCELLENT, score 100
```

## Ajustes recomendados ao coletar mais dados

- Elevar `minimumHistorySamples` conforme o histórico cresce.
- Considerar sazonalidade (comparar com a mesma semana de meses anteriores)
  numa versão futura do analyzer.
