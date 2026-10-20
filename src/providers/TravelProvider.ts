import type { SearchCriteria, TravelPackage } from '../models/index.js';

/**
 * Abstração de um provedor de viagem.
 * Todo acesso a um site/API específico fica encapsulado atrás desta interface.
 * Adicionar um novo provider (Azul, CVC, etc.) não deve exigir alterações
 * no restante da aplicação.
 */
export interface TravelProvider {
  readonly name: string;

  /** Executa a busca de pacotes para um único critério. */
  searchPackages(criteria: SearchCriteria): Promise<TravelPackage[]>;

  /** Inicialização opcional (abrir navegador, etc.). */
  init?(): Promise<void>;

  /** Liberação opcional de recursos (fechar navegador, etc.). */
  dispose?(): Promise<void>;
}
