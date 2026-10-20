import type { SearchCriteria, TravelPackage } from '../../models/index.js';
import type { TravelProvider } from '../TravelProvider.js';
import { log } from '../../utils/logger.js';

/**
 * Provider fictício, determinístico, para desenvolvimento e testes.
 * - Não acessa a internet.
 * - Gera resultados previsíveis a partir de um hash simples do critério.
 * - Todos os pacotes têm isMock=true (nunca misturar com produção).
 */
export class MockTravelProvider implements TravelProvider {
  readonly name = 'mock';

  /** Hotéis fictícios por destino (nomes propositalmente "MOCK"). */
  private readonly hotelsByDestination: Record<string, string[]> = {
    'Porto Seguro': ['Mock Resort Arraial', 'Mock Praia Hotel'],
    'Praia do Forte': ['Mock Tivoli Simulado', 'Mock Iberostar Fake'],
    'Costa do Sauípe': ['Mock Grand Sauípe', 'Mock Village Teste'],
    Ilhéus: ['Mock Cana Brava Demo'],
    Salvador: ['Mock Deville Simulado', 'Mock Vila Galé Fake'],
  };

  private hash(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  async searchPackages(criteria: SearchCriteria): Promise<TravelPackage[]> {
    const hotels =
      this.hotelsByDestination[criteria.destination] ??
      [`Mock Resort ${criteria.destination}`];

    const now = new Date().toISOString();
    const packages: TravelPackage[] = hotels.map((hotelName, idx) => {
      const seed = this.hash(
        `${hotelName}|${criteria.destination}|${criteria.checkIn}`,
      );
      // Preço base determinístico entre ~R$ 4.000 e R$ 12.000 (em centavos).
      const basePriceCents = 400000 + (seed % 800000);
      // Pequena variação por janela de datas para gerar histórico realista.
      const dateFactor = (this.hash(criteria.checkIn) % 1000) - 500; // -500..499
      const totalPrice = Math.max(300000, basePriceCents + dateFactor * 100);

      return {
        provider: this.name,
        hotel: { name: hotelName, externalId: `mock-${seed}` },
        destination: criteria.destination,
        checkIn: criteria.checkIn,
        checkOut: criteria.checkOut,
        nights: criteria.nights,
        adults: criteria.adults,
        children: criteria.children.length,
        mealPlan: criteria.mealPlan,
        totalPrice,
        currency: 'BRL',
        installments: 10,
        flightIncluded: idx % 2 === 0,
        airline: idx % 2 === 0 ? 'Mock Airlines' : undefined,
        departureAirport: criteria.origin,
        url: `https://example.com/mock/${seed}`,
        collectedAt: now,
        isMock: true,
      };
    });

    log('MOCK', `${packages.length} pacotes fictícios gerados para ${criteria.destination}`);
    return packages;
  }
}
