import type { AppEnv } from '../config/env.js';
import { MockTravelProvider } from './mock/MockTravelProvider.js';
import { DecolarProvider } from './decolar/DecolarProvider.js';
import type { TravelProvider } from './TravelProvider.js';

/**
 * Seleciona o provider conforme TRAVEL_PROVIDER.
 * Adicionar um novo provider resume-se a estender este switch.
 */
export function createProvider(env: AppEnv): TravelProvider {
  switch (env.provider) {
    case 'mock':
      return new MockTravelProvider();
    case 'decolar':
      return new DecolarProvider({
        headless: env.headless,
        navigationTimeoutMs: env.navigationTimeoutMs,
        artifactsDir: env.artifactsDir,
      });
    default: {
      const never: never = env.provider;
      throw new Error(`Provider não suportado: ${never}`);
    }
  }
}
