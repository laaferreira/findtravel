import { describe, expect, it } from 'vitest';
import { MockTravelProvider } from '../src/providers/mock/MockTravelProvider.js';
import type { SearchCriteria } from '../src/models/index.js';

const criteria: SearchCriteria = {
  origin: 'CNF',
  destination: 'Porto Seguro',
  checkIn: '2027-03-10',
  checkOut: '2027-03-16',
  nights: 6,
  adults: 2,
  children: [{ age: 6 }],
  mealPlan: 'ALL_INCLUSIVE',
};

describe('MockTravelProvider', () => {
  const provider = new MockTravelProvider();

  it('gera pacotes claramente marcados como mock', async () => {
    const packages = await provider.searchPackages(criteria);
    expect(packages.length).toBeGreaterThan(0);
    expect(packages.every((p) => p.isMock)).toBe(true);
    expect(packages.every((p) => p.provider === 'mock')).toBe(true);
  });

  it('é determinístico para o mesmo critério', async () => {
    const a = await provider.searchPackages(criteria);
    const b = await provider.searchPackages(criteria);
    expect(a.map((p) => p.totalPrice)).toEqual(b.map((p) => p.totalPrice));
  });

  it('usa preços inteiros em centavos', async () => {
    const packages = await provider.searchPackages(criteria);
    expect(packages.every((p) => Number.isInteger(p.totalPrice))).toBe(true);
  });

  it('fornece externalId para deduplicação confiável', async () => {
    const packages = await provider.searchPackages(criteria);
    expect(packages.every((p) => !!p.hotel.externalId)).toBe(true);
  });
});
