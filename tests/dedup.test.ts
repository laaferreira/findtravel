import { describe, expect, it } from 'vitest';
import { dedupKey, normalize } from '../src/repositories/dedup.js';

describe('dedup', () => {
  it('normaliza removendo acentos, caixa e espaços', () => {
    expect(normalize('  Costa do Sauípe  ')).toBe('costa do sauipe');
  });

  it('usa externalId quando disponível', () => {
    const key = dedupKey({
      provider: 'decolar',
      hotel: { name: 'Resort X', externalId: 'ABC-123' },
      destination: 'Salvador',
    });
    expect(key).toContain('::id::');
    expect(key).toContain('abc-123');
  });

  it('cai para provider+hotel+destino sem externalId', () => {
    const key = dedupKey({
      provider: 'decolar',
      hotel: { name: 'Resort X' },
      destination: 'Salvador',
    });
    expect(key).toBe('decolar::resort x::salvador');
  });

  it('gera a mesma chave para variações de acento/caixa', () => {
    const a = dedupKey({ provider: 'mock', hotel: { name: 'Vila Galé' }, destination: 'Ilhéus' });
    const b = dedupKey({ provider: 'MOCK', hotel: { name: 'vila gale' }, destination: 'ilheus' });
    expect(a).toBe(b);
  });
});
