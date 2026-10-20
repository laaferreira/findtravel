import { describe, expect, it } from 'vitest';
import {
  generateAllWindows,
  sampleWindows,
  generateSampledWindows,
} from '../src/services/DateRangeGenerator.js';

describe('DateRangeGenerator', () => {
  it('gera janelas deslizantes respeitando o limite final', () => {
    const windows = generateAllWindows('2027-03-01', '2027-03-10', 6);
    expect(windows[0]).toEqual({ checkIn: '2027-03-01', checkOut: '2027-03-07', nights: 6 });
    expect(windows.at(-1)).toEqual({
      checkIn: '2027-03-04',
      checkOut: '2027-03-10',
      nights: 6,
    });
    expect(windows).toHaveLength(4);
  });

  it('não ultrapassa a data final', () => {
    // check-in 01/03 + 6 noites = 07/03; end=07/03 cabe exatamente 1 janela.
    const windows = generateAllWindows('2027-03-01', '2027-03-07', 6);
    expect(windows).toHaveLength(1);
    expect(windows[0]!.checkOut).toBe('2027-03-07');
    // end=06/03 não comporta nenhuma janela de 6 noites a partir de 01/03.
    expect(generateAllWindows('2027-03-01', '2027-03-06', 6)).toHaveLength(0);
  });

  it('lança erro para nights inválido', () => {
    expect(() => generateAllWindows('2027-03-01', '2027-03-10', 0)).toThrow();
  });

  it('lança erro quando start > end', () => {
    expect(() => generateAllWindows('2027-03-10', '2027-03-01', 6)).toThrow();
  });

  it('retorna todas as janelas quando total <= max', () => {
    const all = generateAllWindows('2027-03-01', '2027-03-10', 6);
    expect(sampleWindows(all, 100)).toHaveLength(all.length);
  });

  it('amostra uniformemente incluindo primeira e última janela', () => {
    const all = generateAllWindows('2027-03-01', '2027-03-31', 6);
    const sampled = sampleWindows(all, 5);
    expect(sampled.length).toBeLessThanOrEqual(5);
    expect(sampled[0]).toEqual(all[0]);
    expect(sampled.at(-1)).toEqual(all.at(-1));
  });

  it('generateSampledWindows respeita o máximo', () => {
    const sampled = generateSampledWindows('2027-03-01', '2027-03-31', 6, 10);
    expect(sampled.length).toBeLessThanOrEqual(10);
  });

  it('sampleWindows com max 0 retorna vazio', () => {
    const all = generateAllWindows('2027-03-01', '2027-03-10', 6);
    expect(sampleWindows(all, 0)).toHaveLength(0);
  });
});
