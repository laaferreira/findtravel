import type { TravelPackage } from '../models/index.js';

/**
 * Estratégia de deduplicação de pacotes/resorts.
 *
 * Chave preferencial: provider + externalId (quando o provider fornece um
 * identificador confiável).
 * Fallback: provider + hotel + destination (normalizados).
 *
 * Isso evita criar resorts duplicados a cada execução.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function dedupKey(pkg: {
  provider: string;
  hotel: { name: string; externalId?: string };
  destination: string;
}): string {
  if (pkg.hotel.externalId) {
    return `${normalize(pkg.provider)}::id::${normalize(pkg.hotel.externalId)}`;
  }
  return `${normalize(pkg.provider)}::${normalize(pkg.hotel.name)}::${normalize(
    pkg.destination,
  )}`;
}

export function dedupKeyFromPackage(pkg: TravelPackage): string {
  return dedupKey(pkg);
}
