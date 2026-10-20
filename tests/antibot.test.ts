import { describe, expect, it } from 'vitest';
import { selectors } from '../src/providers/decolar/selectors.js';

/**
 * Garante que os padrões de texto anti-bot reconhecem a tela real de bloqueio
 * observada na Decolar ("O acesso está temporariamente restrito"), bem como
 * variações comuns. Não aciona navegador.
 */
function matchesAnyAntiBot(text: string): boolean {
  return selectors.antiBotText.some((p) => p.test(text));
}

describe('DecolarProvider anti-bot detection (texto)', () => {
  it('reconhece a tela real de bloqueio da Decolar', () => {
    const real =
      'O acesso está temporariamente restrito. Algo no comportamento do seu ' +
      'navegador chamou nossa atenção. Há um robô na mesma rede (IP ...) que você.';
    expect(matchesAnyAntiBot(real)).toBe(true);
  });

  it('reconhece variações de acesso negado/bloqueado', () => {
    expect(matchesAnyAntiBot('Acesso negado')).toBe(true);
    expect(matchesAnyAntiBot('Access Denied')).toBe(true);
    expect(matchesAnyAntiBot('unusual traffic from your network')).toBe(true);
  });

  it('não gera falso positivo em conteúdo normal de resultados', () => {
    const ok =
      'Resort All Inclusive em Porto Seguro - 6 diárias a partir de R$ 7.357,82';
    expect(matchesAnyAntiBot(ok)).toBe(false);
  });
});
