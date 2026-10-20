/**
 * Gera janelas de datas (check-in -> check-out) dentro de um período,
 * com estratégia de amostragem para respeitar `maxSearches`.
 */

export interface DateWindow {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((p) => Number.parseInt(p, 10));
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function formatISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Gera TODAS as janelas possíveis deslizando o check-in dia a dia.
 * Ex.: start=01/03, end=10/03, nights=6 =>
 *   01/03->07/03, 02/03->08/03, 03/03->09/03, 04/03->10/03
 * (o check-out não pode ultrapassar `end`).
 */
export function generateAllWindows(
  startDate: string,
  endDate: string,
  nights: number,
): DateWindow[] {
  if (nights <= 0) throw new Error('nights deve ser > 0');
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (start.getTime() > end.getTime()) {
    throw new Error('startDate deve ser <= endDate');
  }

  const windows: DateWindow[] = [];
  let checkIn = start;
  let checkOut = addDays(checkIn, nights);
  while (checkOut.getTime() <= end.getTime()) {
    windows.push({
      checkIn: formatISODate(checkIn),
      checkOut: formatISODate(checkOut),
      nights,
    });
    checkIn = addDays(checkIn, 1);
    checkOut = addDays(checkIn, nights);
  }
  return windows;
}

/**
 * Estratégia de amostragem: distribuição UNIFORME.
 *
 * Em vez de pegar as primeiras N janelas (viés para o início do período),
 * selecionamos N janelas espaçadas igualmente ao longo de toda a lista.
 * Isso cobre começo, meio e fim do período configurado.
 *
 * Algoritmo:
 *   - se total <= max, retorna todas;
 *   - caso contrário, escolhe índices i * (total-1) / (max-1), i=0..max-1,
 *     garantindo que a primeira e a última janela sempre entrem.
 */
export function sampleWindows(windows: DateWindow[], maxSearches: number): DateWindow[] {
  if (maxSearches <= 0) return [];
  if (windows.length <= maxSearches) return [...windows];
  if (maxSearches === 1) return [windows[0]!];

  const result: DateWindow[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < maxSearches; i++) {
    const idx = Math.round((i * (windows.length - 1)) / (maxSearches - 1));
    if (!seen.has(idx)) {
      seen.add(idx);
      result.push(windows[idx]!);
    }
  }
  return result;
}

/** Gera janelas já amostradas conforme o limite de carga. */
export function generateSampledWindows(
  startDate: string,
  endDate: string,
  nights: number,
  maxSearches: number,
): DateWindow[] {
  const all = generateAllWindows(startDate, endDate, nights);
  return sampleWindows(all, maxSearches);
}
